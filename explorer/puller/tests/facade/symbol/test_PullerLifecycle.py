# pylint: disable=invalid-name

import asyncio

import pytest
from aiohttp import web
from common.symbol.NodeConfiguration import SymbolNodeConfiguration

from puller.facade.SymbolPuller import SymbolPuller
from puller.facade.SymbolPullerConnector import SymbolPullerConnector, SymbolPullerConnectorStateError

from .puller_test_utils import NODE_URL, RecordingCleanupLogger, create_db_config, set_symbol_connector


class RecordingDatabase:
	def __init__(self, enter_error=None, exit_error=None):
		self.enter_error = enter_error
		self.exit_error = exit_error
		self.enter_call_count = 0
		self.exit_call_count = 0

	def __enter__(self):
		self.enter_call_count += 1
		if self.enter_error:
			raise self.enter_error
		return self

	def __exit__(self, *_):
		self.exit_call_count += 1
		if self.exit_error:
			raise self.exit_error

	@staticmethod
	def create_tables():
		return None


class RecordingConnector:
	def __init__(self, open_error=None, close_error=None):
		self.open_error = open_error
		self.close_error = close_error
		self.open_call_count = 0
		self.close_call_count = 0

	async def open(self):
		self.open_call_count += 1
		if self.open_error:
			raise self.open_error

	async def close(self):
		self.close_call_count += 1
		if self.close_error:
			raise self.close_error


class BlockingCloseConnector(RecordingConnector):
	def __init__(self):
		super().__init__()
		self.close_started = asyncio.Event()
		self.allow_close = asyncio.Event()
		self.close_completed = asyncio.Event()
		self.operation_started = asyncio.Event()

	async def close(self):
		self.close_call_count += 1
		self.close_started.set()
		close_task = asyncio.create_task(self.allow_close.wait())
		try:
			await asyncio.shield(close_task)
		except asyncio.CancelledError:
			await asyncio.shield(close_task)
			self.close_completed.set()
			raise
		self.close_completed.set()


class ConnectorFactory:
	def __init__(self, connector):
		self.connector = connector
		self.calls = []

	def __call__(self, *args):
		self.calls.append(args)
		return self.connector


def _create_puller(
	tmp_path,
	database,
	connector=None,
	connector_factory=None,
	node_url=f'{NODE_URL}/',
	**puller_kwargs
):
	db_config_path = create_db_config(tmp_path)
	puller = SymbolPuller(
		node_url,
		db_config_path,
		'testnet',
		SymbolNodeConfiguration.from_url(node_url, allow_loopback=True, timeout_seconds=17),
		connector=connector,
		connector_factory=connector_factory,
		**puller_kwargs)
	puller.symbol_db = database
	return puller


async def test_closes_owned_connector_after_success(tmp_path):
	# Arrange:
	database = RecordingDatabase()
	connector = RecordingConnector()
	factory = ConnectorFactory(connector)
	puller = _create_puller(tmp_path, database, connector_factory=factory)

	# Act:
	async with puller:
		database.create_tables()

	# Assert:
	assert [(NODE_URL, 17, 100)] == factory.calls
	assert 1 == connector.open_call_count
	assert 1 == connector.close_call_count
	assert 1 == database.enter_call_count
	assert 1 == database.exit_call_count


async def test_closes_owned_connector_when_operation_fails(tmp_path):
	# Arrange:
	connector = RecordingConnector()
	puller = _create_puller(tmp_path, RecordingDatabase(), connector_factory=ConnectorFactory(connector))

	# Act:
	with pytest.raises(RuntimeError, match='operation failed'):
		async with puller:
			raise RuntimeError('operation failed')

	# Assert:
	assert 1 == connector.close_call_count


async def test_preserves_operation_error_when_owned_close_fails(tmp_path):
	# Arrange:
	connector = RecordingConnector(close_error=RuntimeError('close failed'))
	puller = _create_puller(tmp_path, RecordingDatabase(), connector_factory=ConnectorFactory(connector))

	# Act:
	with pytest.raises(RuntimeError, match='operation failed'):
		async with puller:
			raise RuntimeError('operation failed')

	# Assert:
	assert 1 == connector.close_call_count


@pytest.mark.parametrize('cleanup_error, expected_type', [
	(KeyboardInterrupt('connector close interrupted'), KeyboardInterrupt),
	(SystemExit('connector close exited'), SystemExit)
])
async def test_propagates_connector_cleanup_control_flow_after_operation_failure(tmp_path, cleanup_error, expected_type):
	# Arrange:
	operation_error = RuntimeError('operation failed')
	connector = RecordingConnector(close_error=cleanup_error)
	puller = _create_puller(tmp_path, RecordingDatabase(), connector_factory=ConnectorFactory(connector))

	# Act:
	with pytest.raises(expected_type) as exception_info:
		async with puller:
			raise operation_error

	# Assert:
	assert cleanup_error is exception_info.value
	assert operation_error is exception_info.value.__context__
	assert 1 == connector.close_call_count


@pytest.mark.parametrize('cleanup_error, database_error', [
	(KeyboardInterrupt('connector close interrupted'), None),
	(SystemExit('connector close exited'), None),
	(KeyboardInterrupt('connector close interrupted'), RuntimeError('database cleanup failed'))
])
async def test_preserves_operation_cancellation_over_connector_control_flow(tmp_path, cleanup_error, database_error):
	# Arrange:
	operation_error = asyncio.CancelledError('operation cancelled')
	connector = RecordingConnector(close_error=cleanup_error)
	database = RecordingDatabase(exit_error=database_error)
	puller = _create_puller(tmp_path, database, connector_factory=ConnectorFactory(connector))

	# Act:
	with pytest.raises(asyncio.CancelledError) as exception_info:
		async with puller:
			raise operation_error

	# Assert:
	assert operation_error is exception_info.value
	assert 1 == connector.close_call_count


@pytest.mark.parametrize('cleanup_error', [
	KeyboardInterrupt('connector close interrupted'),
	SystemExit('connector close exited')
])
async def test_preserves_operation_control_flow_over_same_rank_cleanup(tmp_path, cleanup_error):
	# Arrange:
	operation_error = KeyboardInterrupt('operation interrupted')
	connector = RecordingConnector(close_error=cleanup_error)
	puller = _create_puller(tmp_path, RecordingDatabase(), connector_factory=ConnectorFactory(connector))

	# Act:
	with pytest.raises(KeyboardInterrupt) as exception_info:
		async with puller:
			raise operation_error

	# Assert:
	assert operation_error is exception_info.value
	assert 1 == connector.close_call_count


async def test_connector_cleanup_cancellation_precedes_operation_control_flow(tmp_path):
	# Arrange:
	operation_error = KeyboardInterrupt('operation interrupted')
	connector_error = asyncio.CancelledError('connector cleanup cancelled')
	connector = RecordingConnector(close_error=connector_error)
	puller = _create_puller(tmp_path, RecordingDatabase(), connector_factory=ConnectorFactory(connector))

	# Act:
	with pytest.raises(asyncio.CancelledError) as exception_info:
		async with puller:
			raise operation_error

	# Assert:
	assert connector_error is exception_info.value
	assert 1 == connector.close_call_count


async def test_preserves_operation_error_when_cleanup_logging_fails(tmp_path):
	# Arrange:
	connector = RecordingConnector(close_error=RuntimeError('close failed'))
	cleanup_logger = RecordingCleanupLogger(RuntimeError('logger failed'))
	puller = _create_puller(
		tmp_path,
		RecordingDatabase(),
		connector_factory=ConnectorFactory(connector),
		cleanup_logger=cleanup_logger)

	# Act:
	with pytest.raises(RuntimeError, match='operation failed'):
		async with puller:
			raise RuntimeError('operation failed')

	# Assert:
	assert 1 == connector.close_call_count
	assert ['Failed to clean up Symbol puller after operation failure: close failed'] == cleanup_logger.messages


async def test_propagates_owned_close_failure_after_success(tmp_path):
	# Arrange:
	connector = RecordingConnector(close_error=RuntimeError('close failed'))
	puller = _create_puller(tmp_path, RecordingDatabase(), connector_factory=ConnectorFactory(connector))

	# Act:
	with pytest.raises(RuntimeError, match='close failed'):
		async with puller:
			pass

	# Assert:
	assert 1 == connector.close_call_count


@pytest.mark.parametrize('close_error, body_error, expected_type', [
	(KeyboardInterrupt('connector close interrupted'), ValueError('body failed'), KeyboardInterrupt),
	(SystemExit('connector close exited'), ValueError('body failed'), SystemExit),
	(KeyboardInterrupt('connector close interrupted'), None, KeyboardInterrupt),
	(KeyboardInterrupt('connector close interrupted'), KeyboardInterrupt('body interrupted'), KeyboardInterrupt)
])
async def test_connector_context_propagates_close_control_flow_after_body_failure(
	close_error, body_error, expected_type):
	# Arrange:
	class FailingSession:
		def __init__(self, error):
			self.error = error
			self.close_call_count = 0

		async def close(self):
			self.close_call_count += 1
			raise self.error

	class RecordingPool:
		def __init__(self):
			self.close_call_count = 0

		async def close(self):
			self.close_call_count += 1

	session = FailingSession(close_error)
	tcp_connector = RecordingPool()
	connector = SymbolPullerConnector(
		NODE_URL,
		13,
		100,
		session_factory=lambda **_: session,
		tcp_connector_factory=lambda **_: tcp_connector)

	# Act:
	with pytest.raises(expected_type) as exception_info:
		async with connector:
			if body_error is not None:
				raise body_error

	# Assert:
	expected_error = body_error if isinstance(body_error, KeyboardInterrupt) else close_error
	assert expected_error is exception_info.value
	if isinstance(body_error, ValueError):
		assert body_error is exception_info.value.__context__
	assert 1 == session.close_call_count
	assert 1 == tcp_connector.close_call_count
	with pytest.raises(SymbolPullerConnectorStateError, match='closed state'):
		await connector.get('after-close')


@pytest.mark.parametrize('close_error', [
	KeyboardInterrupt('connector close interrupted'),
	SystemExit('connector close exited')
])
async def test_connector_context_preserves_body_cancellation_over_close_control_flow(close_error):
	# Arrange:
	body_error = asyncio.CancelledError('body cancelled')

	class FailingSession:
		def __init__(self, error):
			self.error = error
			self.close_call_count = 0

		async def close(self):
			self.close_call_count += 1
			raise self.error

	class RecordingPool:
		def __init__(self):
			self.close_call_count = 0

		async def close(self):
			self.close_call_count += 1

	session = FailingSession(close_error)
	tcp_connector = RecordingPool()
	connector = SymbolPullerConnector(
		NODE_URL,
		13,
		100,
		session_factory=lambda **_: session,
		tcp_connector_factory=lambda **_: tcp_connector)

	# Act:
	with pytest.raises(asyncio.CancelledError) as exception_info:
		async with connector:
			raise body_error

	# Assert:
	assert body_error is exception_info.value
	assert 1 == session.close_call_count
	assert 1 == tcp_connector.close_call_count


async def test_closes_owned_connector_when_database_enter_fails(tmp_path):
	# Arrange:
	connector = RecordingConnector()
	database = RecordingDatabase(enter_error=RuntimeError('database enter failed'))
	puller = _create_puller(tmp_path, database, connector_factory=ConnectorFactory(connector))

	# Act:
	with pytest.raises(RuntimeError, match='database enter failed'):
		async with puller:
			pass

	# Assert:
	assert 1 == connector.open_call_count
	assert 1 == connector.close_call_count


async def test_closes_owned_connector_when_open_fails(tmp_path):
	# Arrange:
	connector = RecordingConnector(open_error=RuntimeError('open failed'))
	puller = _create_puller(tmp_path, RecordingDatabase(), connector_factory=ConnectorFactory(connector))

	# Act:
	with pytest.raises(RuntimeError, match='open failed'):
		async with puller:
			pass

	# Assert:
	assert 1 == connector.open_call_count
	assert 1 == connector.close_call_count


async def test_closes_owned_connector_when_open_is_cancelled(tmp_path):
	# Arrange:
	connector = RecordingConnector(open_error=asyncio.CancelledError())
	puller = _create_puller(tmp_path, RecordingDatabase(), connector_factory=ConnectorFactory(connector))

	# Act:
	with pytest.raises(asyncio.CancelledError):
		async with puller:
			pass

	# Assert:
	assert 1 == connector.open_call_count
	assert 1 == connector.close_call_count


async def test_propagates_cancellation_received_during_enter_cleanup(tmp_path):
	# Arrange:
	connector = RecordingConnector(
		open_error=RuntimeError('open failed'),
		close_error=asyncio.CancelledError())
	puller = _create_puller(tmp_path, RecordingDatabase(), connector_factory=ConnectorFactory(connector))

	# Act:
	with pytest.raises(asyncio.CancelledError):
		async with puller:
			pass

	# Assert:
	assert 1 == connector.open_call_count
	assert 1 == connector.close_call_count


@pytest.mark.parametrize('open_error, cleanup_error, expected_type', [
	(RuntimeError('open failed'), KeyboardInterrupt('connector close interrupted'), KeyboardInterrupt),
	(RuntimeError('open failed'), SystemExit('connector close exited'), SystemExit),
	(KeyboardInterrupt('open interrupted'), SystemExit('connector close exited'), KeyboardInterrupt)
])
async def test_propagates_open_cleanup_control_flow(tmp_path, open_error, cleanup_error, expected_type):
	# Arrange:
	connector = RecordingConnector(open_error=open_error, close_error=cleanup_error)
	puller = _create_puller(tmp_path, RecordingDatabase(), connector_factory=ConnectorFactory(connector))

	# Act:
	with pytest.raises(expected_type) as exception_info:
		async with puller:
			pass

	# Assert:
	if isinstance(open_error, (KeyboardInterrupt, SystemExit)):
		assert open_error is exception_info.value
	else:
		assert cleanup_error is exception_info.value
		assert open_error is exception_info.value.__context__
	assert 1 == connector.open_call_count
	assert 1 == connector.close_call_count


@pytest.mark.parametrize('cleanup_error', [
	KeyboardInterrupt('connector close interrupted'),
	SystemExit('connector close exited')
])
async def test_preserves_open_cancellation_over_cleanup_control_flow(tmp_path, cleanup_error):
	# Arrange:
	open_error = asyncio.CancelledError('open cancelled')
	connector = RecordingConnector(open_error=open_error, close_error=cleanup_error)
	puller = _create_puller(tmp_path, RecordingDatabase(), connector_factory=ConnectorFactory(connector))

	# Act:
	with pytest.raises(asyncio.CancelledError) as exception_info:
		async with puller:
			pass

	# Assert:
	assert open_error is exception_info.value
	assert 1 == connector.open_call_count
	assert 1 == connector.close_call_count


@pytest.mark.parametrize('pool_error, expected_type', [
	(KeyboardInterrupt('pool close interrupted'), KeyboardInterrupt),
	(SystemExit('pool close exited'), SystemExit)
])
async def test_connector_open_propagates_pool_cleanup_control_flow(pool_error, expected_type):
	# Arrange:
	factory_error = RuntimeError('session factory failed')

	class FailingPool:
		def __init__(self, error):
			self.error = error
			self.close_call_count = 0

		async def close(self):
			self.close_call_count += 1
			raise self.error

	tcp_connector = FailingPool(pool_error)

	def failing_session_factory(**_):
		raise factory_error

	connector = SymbolPullerConnector(
		NODE_URL,
		13,
		100,
		session_factory=failing_session_factory,
		tcp_connector_factory=lambda **_: tcp_connector)

	# Act:
	with pytest.raises(expected_type) as exception_info:
		await connector.open()

	# Assert:
	assert pool_error is exception_info.value
	assert factory_error is exception_info.value.__context__
	assert 1 == tcp_connector.close_call_count


@pytest.mark.parametrize('primary_error, pool_error, expected_type', [
	(asyncio.CancelledError('session factory cancelled'), KeyboardInterrupt('pool close interrupted'), asyncio.CancelledError),
	(asyncio.CancelledError('session factory cancelled'), SystemExit('pool close exited'), asyncio.CancelledError),
	(KeyboardInterrupt('session factory interrupted'), SystemExit('pool close exited'), KeyboardInterrupt)
])
async def test_connector_open_preserves_primary_cancellation_over_pool_control_flow(primary_error, pool_error, expected_type):
	# Arrange:
	class FailingPool:
		def __init__(self, error):
			self.error = error
			self.close_call_count = 0

		async def close(self):
			self.close_call_count += 1
			raise self.error

	tcp_connector = FailingPool(pool_error)

	def failing_session_factory(**_):
		raise primary_error

	connector = SymbolPullerConnector(
		NODE_URL,
		13,
		100,
		session_factory=failing_session_factory,
		tcp_connector_factory=lambda **_: tcp_connector)

	# Act:
	with pytest.raises(expected_type) as exception_info:
		await connector.open()

	# Assert:
	assert primary_error is exception_info.value
	assert 1 == tcp_connector.close_call_count


async def test_logs_owned_cleanup_failure_when_open_fails(tmp_path):
	# Arrange:
	connector = RecordingConnector(
		open_error=RuntimeError('open failed'),
		close_error=RuntimeError('close failed'))
	cleanup_logger = RecordingCleanupLogger()
	puller = _create_puller(
		tmp_path,
		RecordingDatabase(),
		connector_factory=ConnectorFactory(connector),
		cleanup_logger=cleanup_logger)

	# Act:
	with pytest.raises(RuntimeError, match='open failed'):
		async with puller:
			pass

	# Assert:
	assert ['Failed to close Symbol node session after lifecycle failure: close failed'] == cleanup_logger.messages


async def test_propagates_database_exit_failure_and_still_closes_owned_connector(tmp_path):
	# Arrange:
	connector = RecordingConnector()
	database = RecordingDatabase(exit_error=RuntimeError('database exit failed'))
	puller = _create_puller(tmp_path, database, connector_factory=ConnectorFactory(connector))

	# Act:
	with pytest.raises(RuntimeError, match='database exit failed'):
		async with puller:
			pass

	# Assert:
	assert 1 == connector.close_call_count


async def test_logs_connector_cleanup_failure_after_database_exit_failure(tmp_path):
	# Arrange:
	connector = RecordingConnector(close_error=RuntimeError('close failed'))
	database = RecordingDatabase(exit_error=RuntimeError('database exit failed'))
	cleanup_logger = RecordingCleanupLogger()
	puller = _create_puller(
		tmp_path,
		database,
		connector_factory=ConnectorFactory(connector),
		cleanup_logger=cleanup_logger)

	# Act:
	with pytest.raises(RuntimeError, match='database exit failed'):
		async with puller:
			pass

	# Assert:
	assert ['Failed to close Symbol node session after database cleanup failure: close failed'] == cleanup_logger.messages


@pytest.mark.parametrize('session_error, pool_error, expected_type', [
	(RuntimeError('session close failed'), KeyboardInterrupt('pool close interrupted'), KeyboardInterrupt),
	(RuntimeError('session close failed'), SystemExit('pool close exited'), SystemExit),
	(KeyboardInterrupt('session close interrupted'), SystemExit('pool close exited'), KeyboardInterrupt)
])
async def test_connector_close_propagates_pool_cleanup_control_flow(session_error, pool_error, expected_type):
	# Arrange:
	class FailingSession:
		def __init__(self, error):
			self.error = error
			self.close_call_count = 0

		async def close(self):
			self.close_call_count += 1
			raise self.error

	class FailingPool:
		def __init__(self, error):
			self.error = error
			self.close_call_count = 0

		async def close(self):
			self.close_call_count += 1
			raise self.error

	session = FailingSession(session_error)
	tcp_connector = FailingPool(pool_error)
	connector = SymbolPullerConnector(
		NODE_URL,
		13,
		100,
		session_factory=lambda **_: session,
		tcp_connector_factory=lambda **_: tcp_connector)
	await connector.open()

	# Act:
	with pytest.raises(expected_type) as exception_info:
		await connector.close()

	# Assert:
	expected_error = session_error if isinstance(session_error, KeyboardInterrupt) else pool_error
	assert expected_error is exception_info.value
	if isinstance(session_error, RuntimeError):
		assert session_error is exception_info.value.__context__
	assert 1 == session.close_call_count
	assert 1 == tcp_connector.close_call_count
	with pytest.raises(SymbolPullerConnectorStateError, match='closed state'):
		await connector.get('after-close')


@pytest.mark.parametrize('session_error', [
	KeyboardInterrupt('session close interrupted'),
	SystemExit('session close exited')
])
async def test_connector_close_preserves_pool_cancellation_over_session_control_flow(session_error):
	# Arrange:
	pool_error = asyncio.CancelledError('pool close cancelled')

	class FailingSession:
		def __init__(self, error):
			self.error = error
			self.close_call_count = 0

		async def close(self):
			self.close_call_count += 1
			raise self.error

	class CancelledPool:
		def __init__(self, error):
			self.error = error
			self.close_call_count = 0

		async def close(self):
			self.close_call_count += 1
			raise self.error

	session = FailingSession(session_error)
	tcp_connector = CancelledPool(pool_error)
	connector = SymbolPullerConnector(
		NODE_URL,
		13,
		100,
		session_factory=lambda **_: session,
		tcp_connector_factory=lambda **_: tcp_connector)
	await connector.open()

	# Act:
	with pytest.raises(asyncio.CancelledError) as exception_info:
		await connector.close()

	# Assert:
	assert pool_error is exception_info.value
	assert 1 == session.close_call_count
	assert 1 == tcp_connector.close_call_count


@pytest.mark.parametrize('pool_error', [
	KeyboardInterrupt('pool close interrupted'),
	SystemExit('pool close exited')
])
async def test_connector_close_preserves_first_session_cancellation(pool_error):
	# Arrange:
	session_error = asyncio.CancelledError('session close cancelled')

	class FailingSession:
		def __init__(self, error):
			self.error = error
			self.close_call_count = 0

		async def close(self):
			self.close_call_count += 1
			raise self.error

	class FailingPool:
		def __init__(self, error):
			self.error = error
			self.close_call_count = 0

		async def close(self):
			self.close_call_count += 1
			raise self.error

	session = FailingSession(session_error)
	tcp_connector = FailingPool(pool_error)
	connector = SymbolPullerConnector(
		NODE_URL,
		13,
		100,
		session_factory=lambda **_: session,
		tcp_connector_factory=lambda **_: tcp_connector)
	await connector.open()

	# Act:
	with pytest.raises(asyncio.CancelledError) as exception_info:
		await connector.close()

	# Assert:
	assert session_error is exception_info.value
	assert 1 == session.close_call_count
	assert 1 == tcp_connector.close_call_count


async def test_does_not_manage_injected_connector(tmp_path):
	# Arrange:
	database = RecordingDatabase()
	connector = RecordingConnector()
	puller = _create_puller(tmp_path, database, connector=connector)

	# Act:
	async with puller:
		database.create_tables()

	# Assert:
	assert 0 == connector.open_call_count
	assert 0 == connector.close_call_count


async def test_does_not_manage_or_open_unused_owned_connector_after_injection(tmp_path):
	# Arrange:
	owned_connector = RecordingConnector()
	injected_connector = RecordingConnector()
	puller = _create_puller(
		tmp_path,
		RecordingDatabase(),
		connector_factory=ConnectorFactory(owned_connector))
	set_symbol_connector(puller, injected_connector)

	# Act:
	async with puller:
		pass

	# Assert:
	assert 0 == owned_connector.open_call_count
	assert 0 == owned_connector.close_call_count
	assert 0 == injected_connector.open_call_count
	assert 0 == injected_connector.close_call_count


def test_rejects_connector_and_factory_together():
	# Arrange:
	connector = RecordingConnector()

	# Act:
	with pytest.raises(ValueError) as exception_info:
		SymbolPuller(NODE_URL, 'unused.ini', connector=connector, connector_factory=lambda *_: connector)

	# Assert:
	assert 'connector and connector_factory cannot both be specified' == str(exception_info.value)


async def test_preserves_cancellation_while_owned_close_completes(tmp_path):
	# Arrange:
	connector = BlockingCloseConnector()
	puller = _create_puller(tmp_path, RecordingDatabase(), connector_factory=ConnectorFactory(connector))

	async def run_context():
		async with puller:
			connector.operation_started.set()
			await asyncio.Event().wait()

	context_task = asyncio.create_task(run_context())
	await connector.operation_started.wait()

	# Act:
	context_task.cancel()
	await connector.close_started.wait()
	connector.allow_close.set()
	with pytest.raises(asyncio.CancelledError):
		await context_task

	# Assert:
	assert 1 == connector.close_call_count
	assert connector.close_completed.is_set()


async def test_propagates_cancellation_received_during_cleanup_after_operation_failure(tmp_path):
	# Arrange:
	operation_error = RuntimeError('operation failed')
	database = RecordingDatabase()
	connector = BlockingCloseConnector()
	puller = _create_puller(tmp_path, database, connector_factory=ConnectorFactory(connector))

	async def run_context():
		async with puller:
			raise operation_error

	context_task = asyncio.create_task(run_context())
	await connector.close_started.wait()

	# Act:
	context_task.cancel()
	connector.allow_close.set()
	with pytest.raises(asyncio.CancelledError) as exception_info:
		await context_task

	# Assert:
	assert operation_error is exception_info.value.__context__
	assert context_task.cancelled()
	assert connector.close_completed.is_set()
	assert 1 == connector.close_call_count
	assert 1 == database.exit_call_count


async def test_preserves_cleanup_cancellation_after_database_exit_failure(tmp_path):
	# Arrange:
	database = RecordingDatabase(exit_error=RuntimeError('database exit failed'))
	connector = BlockingCloseConnector()
	cleanup_logger = RecordingCleanupLogger()
	puller = _create_puller(
		tmp_path,
		database,
		connector_factory=ConnectorFactory(connector),
		cleanup_logger=cleanup_logger)

	async def run_context():
		async with puller:
			pass

	context_task = asyncio.create_task(run_context())
	await connector.close_started.wait()

	# Act:
	context_task.cancel()
	connector.allow_close.set()
	with pytest.raises(asyncio.CancelledError):
		await context_task

	# Assert:
	assert context_task.cancelled()
	assert connector.close_completed.is_set()
	assert 1 == connector.close_call_count
	assert 1 == database.exit_call_count
	assert ['Failed to clean up Symbol puller during interruption: database exit failed'] == cleanup_logger.messages


@pytest.mark.parametrize('database_error, connector_error, expected_type', [
	(asyncio.CancelledError('database exit cancelled'), None, asyncio.CancelledError),
	(KeyboardInterrupt('database exit interrupted'), None, KeyboardInterrupt),
	(SystemExit('database exit exited'), None, SystemExit),
	(KeyboardInterrupt('database exit interrupted'), SystemExit('connector close exited'), KeyboardInterrupt)
])
async def test_database_exit_control_flow_closes_owned_connector_and_propagates(
	tmp_path, database_error, connector_error, expected_type):
	# Arrange:
	database = RecordingDatabase(exit_error=database_error)
	connector = RecordingConnector(close_error=connector_error)
	puller = _create_puller(tmp_path, database, connector_factory=ConnectorFactory(connector))

	# Act:
	with pytest.raises(expected_type) as exception_info:
		async with puller:
			pass

	# Assert:
	assert database_error is exception_info.value
	assert 1 == database.exit_call_count
	assert 1 == connector.close_call_count


@pytest.mark.parametrize('database_error', [
	KeyboardInterrupt('database exit interrupted'),
	SystemExit('database exit exited')
])
async def test_connector_cleanup_cancellation_precedes_database_control_flow(tmp_path, database_error):
	# Arrange:
	database = RecordingDatabase(exit_error=database_error)
	connector_error = asyncio.CancelledError('connector cleanup cancelled')
	connector = RecordingConnector(close_error=connector_error)
	puller = _create_puller(tmp_path, database, connector_factory=ConnectorFactory(connector))

	# Act:
	with pytest.raises(asyncio.CancelledError) as exception_info:
		async with puller:
			pass

	# Assert:
	assert connector_error is exception_info.value
	assert 1 == database.exit_call_count
	assert 1 == connector.close_call_count


async def test_retries_post_after_silent_pooled_transport_disconnect_within_one_workflow(tmp_path, aiohttp_raw_server):
	# Arrange:
	requests = []
	transports = []

	async def handler(request):
		request_payload = await request.json()
		requests.append((request.path, request_payload))
		transports.append(request.transport)
		if 2 == len(requests):
			request.transport.abort()
		return web.json_response({'request': len(requests)})

	server = await aiohttp_raw_server(handler)
	created_connectors = []

	def connector_factory(*args):
		connector = SymbolPullerConnector(*args)
		created_connectors.append(connector)
		return connector

	puller = _create_puller(
		tmp_path,
		RecordingDatabase(),
		connector_factory=connector_factory,
		node_url=str(server.make_url('/')))
	puller._retry_delay = 0  # pylint: disable=protected-access

	# Act:
	async with puller:
		warmup_response = await puller.post_symbol_node('mosaics', {'mosaicIds': ['1']})
		retried_response = await puller.post_symbol_node('mosaics', {'mosaicIds': ['2']})

	with pytest.raises(SymbolPullerConnectorStateError, match='closed state'):
		await created_connectors[0].post('mosaics', {'mosaicIds': ['3']})

	# Assert:
	assert {'request': 1} == warmup_response
	assert {'request': 3} == retried_response
	assert [
		('/mosaics', {'mosaicIds': ['1']}),
		('/mosaics', {'mosaicIds': ['2']}),
		('/mosaics', {'mosaicIds': ['2']})
	] == requests
	assert 1 == len(created_connectors)
	assert transports[0] is transports[1]
	assert transports[1] is not transports[2]

# pylint: disable=invalid-name

import asyncio

import pytest
from aiohttp import web
from common.symbol.NodeConfiguration import SymbolNodeConfiguration

from puller.facade.SymbolPuller import SymbolPuller
from puller.facade.SymbolPullerConnector import SymbolPullerConnector

from .puller_test_utils import NODE_URL, RecordingCleanupLogger, create_db_config


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

	def __call__(self, endpoint, timeout_seconds, connection_limit):
		self.calls.append((endpoint, timeout_seconds, connection_limit))
		return self.connector


def _create_puller(
	tmp_path,
	database,
	connector_factory,
	node_url=f'{NODE_URL}/',
	**puller_kwargs
):
	db_config_path = create_db_config(tmp_path)
	puller = SymbolPuller(
		node_url,
		db_config_path,
		'testnet',
		SymbolNodeConfiguration.from_url(node_url, allow_loopback=True, timeout_seconds=17),
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


async def test_propagates_connector_cleanup_control_flow_after_operation_failure(tmp_path):
	# Arrange:
	operation_error = RuntimeError('operation failed')
	cleanup_error = KeyboardInterrupt('connector close interrupted')
	connector = RecordingConnector(close_error=cleanup_error)
	puller = _create_puller(tmp_path, RecordingDatabase(), connector_factory=ConnectorFactory(connector))

	# Act:
	with pytest.raises(KeyboardInterrupt) as exception_info:
		async with puller:
			raise operation_error

	# Assert:
	assert cleanup_error is exception_info.value
	assert operation_error is exception_info.value.__context__
	assert 1 == connector.close_call_count


@pytest.mark.parametrize('connector_cleanup_error, database_cleanup_error', [
	(KeyboardInterrupt('connector close interrupted'), None),
	(KeyboardInterrupt('connector close interrupted'), RuntimeError('database cleanup failed'))
])
async def test_preserves_operation_cancellation_over_connector_control_flow(
	tmp_path,
	connector_cleanup_error,
	database_cleanup_error
):
	# Arrange:
	operation_error = asyncio.CancelledError('operation cancelled')
	connector = RecordingConnector(close_error=connector_cleanup_error)
	database = RecordingDatabase(exit_error=database_cleanup_error)
	puller = _create_puller(tmp_path, database, connector_factory=ConnectorFactory(connector))

	# Act:
	with pytest.raises(asyncio.CancelledError) as exception_info:
		async with puller:
			raise operation_error

	# Assert:
	assert operation_error is exception_info.value
	# The selected operation cancellation must not be re-chained to a lower-priority cleanup error.
	assert exception_info.value.__context__ is None
	assert 1 == connector.close_call_count


async def test_preserves_operation_control_flow_over_same_rank_cleanup(tmp_path):
	# Arrange:
	operation_error = KeyboardInterrupt('operation interrupted')
	cleanup_error = KeyboardInterrupt('connector close interrupted')
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
	cleanup_error = asyncio.CancelledError('connector cleanup cancelled')
	connector = RecordingConnector(close_error=cleanup_error)
	puller = _create_puller(tmp_path, RecordingDatabase(), connector_factory=ConnectorFactory(connector))

	# Act:
	with pytest.raises(asyncio.CancelledError) as exception_info:
		async with puller:
			raise operation_error

	# Assert:
	assert cleanup_error is exception_info.value
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


@pytest.mark.parametrize('open_error, cleanup_error, is_cleanup_error_expected', [
	(
		RuntimeError('open failed'),
		KeyboardInterrupt('connector close interrupted'),
		True),
	(
		KeyboardInterrupt('open interrupted'),
		SystemExit('connector close exited'),
		False)
])
async def test_propagates_open_cleanup_control_flow(
	tmp_path, open_error, cleanup_error, is_cleanup_error_expected):
	# Arrange:
	connector = RecordingConnector(open_error=open_error, close_error=cleanup_error)
	puller = _create_puller(tmp_path, RecordingDatabase(), connector_factory=ConnectorFactory(connector))

	# Act:
	with pytest.raises(KeyboardInterrupt) as exception_info:
		async with puller:
			pass

	# Assert:
	expected_error = cleanup_error if is_cleanup_error_expected else open_error
	assert expected_error is exception_info.value
	if is_cleanup_error_expected:
		assert open_error is exception_info.value.__context__
	assert 1 == connector.open_call_count
	assert 1 == connector.close_call_count


async def test_preserves_open_cancellation_over_cleanup_control_flow(tmp_path):
	# Arrange:
	open_error = asyncio.CancelledError('open cancelled')
	cleanup_error = KeyboardInterrupt('connector close interrupted')
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


@pytest.mark.parametrize('database_cleanup_error, connector_cleanup_error', [
	(asyncio.CancelledError('database exit cancelled'), None),
	(KeyboardInterrupt('database exit interrupted'), SystemExit('connector close exited'))
])
async def test_database_exit_control_flow_closes_owned_connector_and_propagates(
	tmp_path, database_cleanup_error, connector_cleanup_error):
	# Arrange:
	database = RecordingDatabase(exit_error=database_cleanup_error)
	connector = RecordingConnector(close_error=connector_cleanup_error)
	puller = _create_puller(tmp_path, database, connector_factory=ConnectorFactory(connector))

	# Act:
	with pytest.raises(type(database_cleanup_error)) as exception_info:
		async with puller:
			pass

	# Assert:
	assert database_cleanup_error is exception_info.value
	assert 1 == database.exit_call_count
	assert 1 == connector.close_call_count


async def test_connector_cleanup_cancellation_precedes_database_control_flow(tmp_path):
	# Arrange:
	database_cleanup_error = KeyboardInterrupt('database exit interrupted')
	database = RecordingDatabase(exit_error=database_cleanup_error)
	connector_cleanup_error = asyncio.CancelledError('connector cleanup cancelled')
	connector = RecordingConnector(close_error=connector_cleanup_error)
	puller = _create_puller(tmp_path, database, connector_factory=ConnectorFactory(connector))

	# Act:
	with pytest.raises(asyncio.CancelledError) as exception_info:
		async with puller:
			pass

	# Assert:
	assert connector_cleanup_error is exception_info.value
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

	def connector_factory(endpoint, timeout_seconds, connection_limit):
		connector = SymbolPullerConnector(endpoint, timeout_seconds, connection_limit)
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

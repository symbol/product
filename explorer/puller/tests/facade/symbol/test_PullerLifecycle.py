# pylint: disable=invalid-name

import asyncio

import pytest
from common.symbol.NodeConfiguration import SymbolNodeConfiguration

from puller.facade.SymbolPuller import SYMBOL_HTTP_CONNECTION_POOL_LIMIT, SymbolPuller

from .puller_test_utils import NODE_URL, create_db_config


class _RecordingDatabase:
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


class _RecordingConnector:
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


class _BlockingCloseConnector(_RecordingConnector):
	def __init__(self):
		super().__init__()
		self.close_started = asyncio.Event()
		self.allow_close = asyncio.Event()
		self.operation_started = asyncio.Event()

	async def close(self):
		self.close_call_count += 1
		self.close_started.set()
		await self.allow_close.wait()


class _ConnectorFactory:
	def __init__(self, connector):
		self.connector = connector
		self.calls = []

	def __call__(self, *args):
		self.calls.append(args)
		return self.connector


def _create_puller(tmp_path, database, connector=None, connector_factory=None):
	db_config_path = create_db_config(tmp_path)
	puller = SymbolPuller(
		NODE_URL,
		db_config_path,
		'testnet',
		SymbolNodeConfiguration.from_url(NODE_URL, allow_loopback=True, timeout_seconds=17),
		connector=connector,
		connector_factory=connector_factory)
	puller.symbol_db = database
	return puller


async def test_closes_owned_connector_after_success(tmp_path):
	# Arrange:
	database = _RecordingDatabase()
	connector = _RecordingConnector()
	factory = _ConnectorFactory(connector)
	puller = _create_puller(tmp_path, database, connector_factory=factory)

	# Act:
	async with puller:
		database.create_tables()

	# Assert:
	assert [(NODE_URL, 17, SYMBOL_HTTP_CONNECTION_POOL_LIMIT)] == factory.calls
	assert 1 == connector.open_call_count
	assert 1 == connector.close_call_count
	assert 1 == database.enter_call_count
	assert 1 == database.exit_call_count


async def test_closes_owned_connector_when_operation_fails(tmp_path):
	# Arrange:
	connector = _RecordingConnector()
	puller = _create_puller(tmp_path, _RecordingDatabase(), connector_factory=_ConnectorFactory(connector))

	# Act:
	with pytest.raises(RuntimeError, match='operation failed'):
		async with puller:
			raise RuntimeError('operation failed')

	# Assert:
	assert 1 == connector.close_call_count


async def test_preserves_operation_error_when_owned_close_fails(tmp_path):
	# Arrange:
	connector = _RecordingConnector(close_error=RuntimeError('close failed'))
	puller = _create_puller(tmp_path, _RecordingDatabase(), connector_factory=_ConnectorFactory(connector))

	# Act:
	with pytest.raises(RuntimeError, match='operation failed'):
		async with puller:
			raise RuntimeError('operation failed')

	# Assert:
	assert 1 == connector.close_call_count


async def test_propagates_owned_close_failure_after_success(tmp_path):
	# Arrange:
	connector = _RecordingConnector(close_error=RuntimeError('close failed'))
	puller = _create_puller(tmp_path, _RecordingDatabase(), connector_factory=_ConnectorFactory(connector))

	# Act:
	with pytest.raises(RuntimeError, match='close failed'):
		async with puller:
			pass

	# Assert:
	assert 1 == connector.close_call_count


async def test_closes_owned_connector_when_database_enter_fails(tmp_path):
	# Arrange:
	connector = _RecordingConnector()
	database = _RecordingDatabase(enter_error=RuntimeError('database enter failed'))
	puller = _create_puller(tmp_path, database, connector_factory=_ConnectorFactory(connector))

	# Act:
	with pytest.raises(RuntimeError, match='database enter failed'):
		async with puller:
			pass

	# Assert:
	assert 1 == connector.open_call_count
	assert 1 == connector.close_call_count


async def test_closes_owned_connector_when_open_fails(tmp_path):
	# Arrange:
	connector = _RecordingConnector(open_error=RuntimeError('open failed'))
	puller = _create_puller(tmp_path, _RecordingDatabase(), connector_factory=_ConnectorFactory(connector))

	# Act:
	with pytest.raises(RuntimeError, match='open failed'):
		async with puller:
			pass

	# Assert:
	assert 1 == connector.open_call_count
	assert 1 == connector.close_call_count


async def test_logs_owned_cleanup_failure_when_open_fails(tmp_path, caplog):
	# Arrange:
	connector = _RecordingConnector(
		open_error=RuntimeError('open failed'),
		close_error=RuntimeError('close failed'))
	puller = _create_puller(tmp_path, _RecordingDatabase(), connector_factory=_ConnectorFactory(connector))

	# Act:
	with pytest.raises(RuntimeError, match='open failed'):
		async with puller:
			pass

	# Assert:
	assert ['Failed to close Symbol node session after lifecycle failure: close failed'] == caplog.messages


async def test_propagates_database_exit_failure_and_still_closes_owned_connector(tmp_path):
	# Arrange:
	connector = _RecordingConnector()
	database = _RecordingDatabase(exit_error=RuntimeError('database exit failed'))
	puller = _create_puller(tmp_path, database, connector_factory=_ConnectorFactory(connector))

	# Act:
	with pytest.raises(RuntimeError, match='database exit failed'):
		async with puller:
			pass

	# Assert:
	assert 1 == connector.close_call_count


async def test_logs_connector_cleanup_failure_after_database_exit_failure(tmp_path, caplog):
	# Arrange:
	connector = _RecordingConnector(close_error=RuntimeError('close failed'))
	database = _RecordingDatabase(exit_error=RuntimeError('database exit failed'))
	puller = _create_puller(tmp_path, database, connector_factory=_ConnectorFactory(connector))

	# Act:
	with pytest.raises(RuntimeError, match='database exit failed'):
		async with puller:
			pass

	# Assert:
	assert ['Failed to close Symbol node session after database cleanup failure: close failed'] == caplog.messages


async def test_does_not_manage_injected_connector(tmp_path):
	# Arrange:
	database = _RecordingDatabase()
	connector = _RecordingConnector()
	puller = _create_puller(tmp_path, database, connector=connector)

	# Act:
	async with puller:
		database.create_tables()

	# Assert:
	assert 0 == connector.open_call_count
	assert 0 == connector.close_call_count


def test_rejects_connector_and_factory_together():
	# Arrange:
	connector = _RecordingConnector()

	# Act:
	with pytest.raises(ValueError) as exception_info:
		SymbolPuller(NODE_URL, 'unused.ini', connector=connector, connector_factory=lambda *_: connector)

	# Assert:
	assert 'connector and connector_factory cannot both be specified' == str(exception_info.value)


async def test_preserves_cancellation_while_owned_close_completes(tmp_path):
	# Arrange:
	connector = _BlockingCloseConnector()
	puller = _create_puller(tmp_path, _RecordingDatabase(), connector_factory=_ConnectorFactory(connector))

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

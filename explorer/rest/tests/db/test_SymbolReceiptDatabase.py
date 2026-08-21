from collections import defaultdict

import pytest
from common.tests.PostgresTestUtils import PostgresTestDatabase, drop_symbol_block_tables_if_present
from puller.db.SymbolDatabase import SymbolDatabase as PullerSymbolDatabase

from rest.db.SymbolDatabase import ReceiptCursorStaleError, ReceiptDataUnavailableError, ReceiptQuery, SortOrder, SymbolDatabase
from rest.model.symbol.Receipt import ReceiptPosition
from rest.model.symbol.ReceiptCursor import ReceiptCursor
from tests.test.SymbolBlockTestUtils import create_symbol_block, create_symbol_sync_state

NATIVE_MOSAIC_ID = '72C0212E67A08BCE'
TARGET_ADDRESS = bytes.fromhex('9889432DE263BB8FE88444A4DA28D3609BD8BB8FAE18AE95')
SENDER_ADDRESS = bytes.fromhex('98' + '11' * 23)
OTHER_ADDRESS = bytes.fromhex('98' + '22' * 23)


@pytest.fixture(scope='module', name='symbol_database_config')
def fixture_symbol_database_config():
	with PostgresTestDatabase() as db_config:
		yield db_config


def _create_receipt(height, receipt_type='inflation', receipt_group='inflation', **overrides):
	receipt = {
		'height': height,
		'receipt_type': receipt_type,
		'receipt_group': receipt_group,
		'version': 1,
		'source_primary_id': 0,
		'source_secondary_id': 0,
		'sender_address': None,
		'recipient_address': None,
		'target_address': None,
		'mosaic_id': None,
		'amount': 100,
		'artifact_id': None,
		'raw_payload': {'type': receipt_type}
	}
	receipt.update(overrides)
	return receipt


def _reset_database(database_config, sync_height=4, block_count=None):
	with PullerSymbolDatabase(database_config) as database:
		drop_symbol_block_tables_if_present(database)
		database.create_tables()
		database.upsert_sync_state(create_symbol_sync_state(sync_height, sync_height))
		block_count = block_count or sync_height
		database.upsert_blocks([create_symbol_block(height) for height in range(1, block_count + 1)])


def _seed_receipts(database_config, receipts, sync_height=4, mosaics=(), block_count=None):
	_reset_database(database_config, sync_height, block_count)
	by_height = defaultdict(list)
	for receipt in receipts:
		by_height[receipt['height']].append(receipt)

	with PullerSymbolDatabase(database_config) as database:
		for mosaic in mosaics:
			database.upsert_mosaic(mosaic)
		for height, rows in by_height.items():
			database.upsert_receipts_for_height(height, rows, 0)


def _create_rest_database(database_config):
	return SymbolDatabase(database_config)


class LifecycleReceiptCursor:
	def __init__(self, connection):
		self.connection = connection
		self.result = []

	def __enter__(self):
		return self

	def __exit__(self, _exc_type, _exc_value, _traceback):
		return False

	def execute(self, statement, _parameters=None):
		self.connection.statements.append(statement.strip())
		self.result = []
		if 'FROM symbol_sync_state' in statement:
			self.result = (
				self.connection.status,
				self.connection.last_synced_height,
				self.connection.chain_revision
			)

	def fetchone(self):
		return self.result

	def fetchall(self):
		return self.result


class LifecycleReceiptConnection:
	def __init__(self, rollback_error=None, commit_error=None, close_error=None):
		self.status = 'healthy'
		self.last_synced_height = 1
		self.chain_revision = 0
		self.rollback_error = rollback_error
		self.commit_error = commit_error
		self.close_error = close_error
		self.closed = False
		self.statements = []

	def cursor(self):
		return LifecycleReceiptCursor(self)

	def rollback(self):
		if self.rollback_error:
			error = self.rollback_error
			self.rollback_error = None
			raise error

	def commit(self):
		if self.commit_error:
			error = self.commit_error
			self.commit_error = None
			raise error

	def close(self):
		if self.close_error:
			error = self.close_error
			self.close_error = None
			raise error
		self.closed = True


class LifecycleReceiptPool:
	def __init__(self, connections):
		self.connections = list(connections)
		self.acquired = []
		self.returned = []
		self.discarded = []
		self.discard_attempts = []

	def getconn(self):
		connection = self.connections.pop(0)
		self.acquired.append(connection)
		return connection

	def putconn(self, connection, close=False):
		self.returned.append((connection, close))
		if close:
			self.discard_attempts.append(connection)
			connection.close()
			self.discarded.append(connection)
		elif connection.closed:
			self.discarded.append(connection)
		else:
			self.connections.append(connection)


class NormalReturnFailureReceiptPool(LifecycleReceiptPool):
	def __init__(self, connections):
		super().__init__(connections)
		self.failure_injected = False

	def putconn(self, connection, close=False):
		if not close and not self.failure_injected:
			self.failure_injected = True
			self.returned.append((connection, close))
			raise RuntimeError('putconn cleanup failed')

		super().putconn(connection, close)


class LifecycleSymbolDatabase(SymbolDatabase):  # pylint: disable=super-init-not-called
	def __init__(self, connection_pool):  # pylint: disable=super-init-not-called
		self._pool = connection_pool


def _create_lifecycle_database(*connections):
	pool = LifecycleReceiptPool(connections)
	return LifecycleSymbolDatabase(pool), pool


def test_get_receipts_filters_by_group(symbol_database_config):
	# Arrange:
	_seed_receipts(symbol_database_config, [
		_create_receipt(1),
		_create_receipt(2, 'harvestFee', 'balanceChange')
	])
	database = _create_rest_database(symbol_database_config)

	# Act:
	result = database.get_receipts(ReceiptQuery(10, None, None, 'balanceChange', None, (), None, None))

	# Assert:
	assert ['harvestFee'] == [row['receipt_type'] for row in result.items]


def test_get_receipts_filters_by_type(symbol_database_config):
	# Arrange:
	_seed_receipts(symbol_database_config, [
		_create_receipt(1, 'inflation', 'inflation'),
		_create_receipt(2, 'mosaicExpired', 'artifactExpiry')
	])
	database = _create_rest_database(symbol_database_config)

	# Act:
	result = database.get_receipts(ReceiptQuery(10, None, None, None, 'mosaicExpired', (), None, None))

	# Assert:
	assert ['mosaicExpired'] == [row['receipt_type'] for row in result.items]


def test_receipts_fail_when_unreadable(symbol_database_config):
	# Arrange:
	_reset_database(symbol_database_config, sync_height=1)
	with PullerSymbolDatabase(symbol_database_config) as database:
		with database.connection.cursor() as cursor:
			cursor.execute("UPDATE symbol_sync_state SET status = 'unhealthy' WHERE id = 1")
			database.connection.commit()
	rest_database = _create_rest_database(symbol_database_config)

	# Act:
	with pytest.raises(ReceiptDataUnavailableError):
		rest_database.get_receipts(ReceiptQuery(10, None, None, None, None, (), None, None))


def test_receipts_fail_when_repairing(symbol_database_config):
	# Arrange:
	_reset_database(symbol_database_config, sync_height=1)
	with PullerSymbolDatabase(symbol_database_config) as database:
		with database.connection.cursor() as cursor:
			cursor.execute("UPDATE symbol_sync_state SET status = 'repairing' WHERE id = 1")
			database.connection.commit()
	rest_database = _create_rest_database(symbol_database_config)

	# Act / Assert:
	with pytest.raises(ReceiptDataUnavailableError):
		rest_database.get_receipts(ReceiptQuery(10, None, None, None, None, (), None, None))


def test_receipts_fail_state_missing(symbol_database_config):
	# Arrange:
	_reset_database(symbol_database_config, sync_height=1)
	with PullerSymbolDatabase(symbol_database_config) as database:
		with database.connection.cursor() as cursor:
			cursor.execute('DELETE FROM symbol_sync_state WHERE id = 1')
			database.connection.commit()
	rest_database = _create_rest_database(symbol_database_config)

	# Act / Assert:
	with pytest.raises(ReceiptDataUnavailableError):
		rest_database.get_receipts(ReceiptQuery(10, None, None, None, None, (), None, None))


def test_receipts_reuse_unavailable(symbol_database_config):
	# Arrange:
	_seed_receipts(symbol_database_config, [_create_receipt(1, amount=101)])
	with PullerSymbolDatabase(symbol_database_config) as database:
		with database.connection.cursor() as cursor:
			cursor.execute("UPDATE symbol_sync_state SET status = 'unhealthy' WHERE id = 1")
			database.connection.commit()
	rest_database = _create_rest_database(symbol_database_config)

	# Act:
	with pytest.raises(ReceiptDataUnavailableError):
		rest_database.get_receipts(ReceiptQuery(10, None, None, None, None, (), None, None))
	with PullerSymbolDatabase(symbol_database_config) as database:
		with database.connection.cursor() as cursor:
			cursor.execute("UPDATE symbol_sync_state SET status = 'healthy' WHERE id = 1")
			database.connection.commit()
	result = rest_database.get_receipts(ReceiptQuery(10, None, None, None, None, (), None, None))

	# Assert:
	assert [(1, 101)] == [(row['height'], row['amount']) for row in result.items]


def test_receipts_reuse_stale(symbol_database_config):
	# Arrange:
	_seed_receipts(symbol_database_config, [_create_receipt(1, amount=101)])
	rest_database = _create_rest_database(symbol_database_config)
	stale_cursor = ReceiptCursor(1, 'receipts', 'mainnet', 1, 1, 1, '0' * 64)

	# Act:
	with pytest.raises(ReceiptCursorStaleError):
		rest_database.get_receipts(ReceiptQuery(10, stale_cursor, None, None, None, (), None, None))
	result = rest_database.get_receipts(ReceiptQuery(10, None, None, None, None, (), None, None))

	# Assert:
	assert [(1, 101)] == [(row['height'], row['amount']) for row in result.items]


def test_receipts_preserve_stale_error():
	# Arrange:
	broken = LifecycleReceiptConnection(rollback_error=RuntimeError('rollback failed'))
	healthy = LifecycleReceiptConnection()
	database, pool = _create_lifecycle_database(broken, healthy)
	stale_cursor = ReceiptCursor(1, 'receipts', 'mainnet', 1, 1, 1, '0' * 64)

	# Act:
	with pytest.raises(ReceiptCursorStaleError) as error:
		database.get_receipts(ReceiptQuery(10, stale_cursor, None, None, None, (), None, None))
	result = database.get_receipts(ReceiptQuery(10, None, None, None, None, (), None, None))

	# Assert:
	assert 'Receipt cursor is stale' == str(error.value)
	assert [broken] == pool.discarded
	assert [broken, healthy] == pool.acquired
	assert () == result.items


def test_receipts_stale_return_failure():
	# Arrange:
	broken = LifecycleReceiptConnection()
	healthy = LifecycleReceiptConnection()
	pool = NormalReturnFailureReceiptPool((broken, healthy))
	database = LifecycleSymbolDatabase(pool)
	stale_cursor = ReceiptCursor(1, 'receipts', 'mainnet', 1, 1, 1, '0' * 64)

	# Act:
	with pytest.raises(ReceiptCursorStaleError) as error:
		database.get_receipts(ReceiptQuery(10, stale_cursor, None, None, None, (), None, None))
	result = database.get_receipts(ReceiptQuery(10, None, None, None, None, (), None, None))

	# Assert:
	assert 'Receipt cursor is stale' == str(error.value)
	assert [(broken, False), (healthy, False)] == pool.returned
	assert [healthy] == pool.connections
	assert [broken, healthy] == pool.acquired
	assert () == result.items


def test_receipts_preserve_close_failure():
	# Arrange:
	broken = LifecycleReceiptConnection(
		rollback_error=RuntimeError('rollback failed'),
		close_error=RuntimeError('close failed'))
	healthy = LifecycleReceiptConnection()
	database, pool = _create_lifecycle_database(broken, healthy)
	stale_cursor = ReceiptCursor(1, 'receipts', 'mainnet', 1, 1, 1, '0' * 64)

	# Act:
	with pytest.raises(ReceiptCursorStaleError) as error:
		database.get_receipts(ReceiptQuery(10, stale_cursor, None, None, None, (), None, None))
	first_result = database.get_receipts(ReceiptQuery(10, None, None, None, None, (), None, None))
	second_result = database.get_receipts(ReceiptQuery(10, None, None, None, None, (), None, None))

	# Assert:
	assert 'Receipt cursor is stale' == str(error.value)
	assert False is broken.closed
	assert [broken] == pool.discard_attempts
	assert 0 == len(pool.discarded)
	assert [healthy] == pool.connections
	assert [broken, healthy, healthy] == pool.acquired
	assert () == first_result.items
	assert () == second_result.items


def test_receipts_discard_commit_failure():
	# Arrange:
	broken = LifecycleReceiptConnection(commit_error=RuntimeError('commit failed'))
	healthy = LifecycleReceiptConnection()
	database, pool = _create_lifecycle_database(broken, healthy)

	# Act:
	with pytest.raises(RuntimeError) as error:
		database.get_receipts(ReceiptQuery(10, None, None, None, None, (), None, None))
	result = database.get_receipts(ReceiptQuery(10, None, None, None, None, (), None, None))

	# Assert:
	assert 'commit failed' == str(error.value)
	assert [broken] == pool.discarded
	assert [broken, healthy] == pool.acquired
	assert () == result.items


def test_receipts_commit_close_failure():
	# Arrange:
	broken = LifecycleReceiptConnection(
		commit_error=RuntimeError('commit failed'),
		close_error=RuntimeError('close failed'))
	healthy = LifecycleReceiptConnection()
	database, pool = _create_lifecycle_database(broken, healthy)

	# Act:
	with pytest.raises(RuntimeError) as error:
		database.get_receipts(ReceiptQuery(10, None, None, None, None, (), None, None))
	first_result = database.get_receipts(ReceiptQuery(10, None, None, None, None, (), None, None))
	second_result = database.get_receipts(ReceiptQuery(10, None, None, None, None, (), None, None))

	# Assert:
	assert 'commit failed' == str(error.value)
	assert False is broken.closed
	assert [broken] == pool.discard_attempts
	assert 0 == len(pool.discarded)
	assert [healthy] == pool.connections
	assert [broken, healthy, healthy] == pool.acquired
	assert () == first_result.items
	assert () == second_result.items


def test_receipts_filter_included_array(symbol_database_config):
	# Arrange:
	_seed_receipts(symbol_database_config, [
		_create_receipt(1, 'harvestFee', 'balanceChange'),
		_create_receipt(2, 'lockHashCreated', 'balanceChange'),
		_create_receipt(3, 'inflation', 'inflation')
	])
	database = _create_rest_database(symbol_database_config)

	# Act:
	result = database.get_receipts(ReceiptQuery(
		10, None, None, None, None, ('harvestFee', 'lockHashCreated'), None, None))

	# Assert:
	assert ['lockHashCreated', 'harvestFee'] == [row['receipt_type'] for row in result.items]


def test_get_receipts_filters_by_height(symbol_database_config):
	# Arrange:
	_seed_receipts(symbol_database_config, [
		_create_receipt(1),
		_create_receipt(2)
	])
	database = _create_rest_database(symbol_database_config)

	# Act:
	result = database.get_receipts(ReceiptQuery(10, None, 1, None, None, (), None, None))

	# Assert:
	assert [1] == [row['height'] for row in result.items]


def test_receipts_filter_target(symbol_database_config):
	# Arrange:
	_seed_receipts(symbol_database_config, [
		_create_receipt(1, 'harvestFee', 'balanceChange', target_address=TARGET_ADDRESS),
		_create_receipt(2, 'harvestFee', 'balanceChange', target_address=OTHER_ADDRESS)
	])
	database = _create_rest_database(symbol_database_config)

	# Act:
	result = database.get_receipts(ReceiptQuery(10, None, None, None, None, (), TARGET_ADDRESS, None))

	# Assert:
	assert [TARGET_ADDRESS] == [bytes(row['target_address']) for row in result.items]


def test_receipts_filter_sender(symbol_database_config):
	# Arrange:
	_seed_receipts(symbol_database_config, [
		_create_receipt(1, 'mosaicRentalFee', 'balanceTransfer', sender_address=SENDER_ADDRESS),
		_create_receipt(2, 'mosaicRentalFee', 'balanceTransfer', sender_address=OTHER_ADDRESS)
	])
	database = _create_rest_database(symbol_database_config)

	# Act:
	result = database.get_receipts(ReceiptQuery(10, None, None, None, None, (), None, SENDER_ADDRESS))

	# Assert:
	assert [SENDER_ADDRESS] == [bytes(row['sender_address']) for row in result.items]


def test_receipts_combined_watermark(symbol_database_config):
	# Arrange:
	_seed_receipts(symbol_database_config, [
		_create_receipt(1, 'harvestFee', 'balanceChange', target_address=TARGET_ADDRESS),
		_create_receipt(2, 'lockHashCreated', 'balanceChange', target_address=TARGET_ADDRESS),
		_create_receipt(3, 'harvestFee', 'balanceChange', target_address=OTHER_ADDRESS),
		_create_receipt(4, 'harvestFee', 'balanceChange', target_address=TARGET_ADDRESS)
	], sync_height=3, block_count=4)
	database = _create_rest_database(symbol_database_config)

	# Act:
	result = database.get_receipts(ReceiptQuery(
		10, None, None, 'balanceChange', 'harvestFee', (), TARGET_ADDRESS, None))

	# Assert:
	assert [1] == [row['height'] for row in result.items]


def test_receipts_order_height_id(symbol_database_config):
	# Arrange:
	_seed_receipts(symbol_database_config, [
		_create_receipt(1, 'harvestFee', 'balanceChange'),
		_create_receipt(2, 'harvestFee', 'balanceChange'),
		_create_receipt(2, 'lockHashCreated', 'balanceChange')
	])
	database = _create_rest_database(symbol_database_config)

	# Act:
	result = database.get_receipts(ReceiptQuery(10, None, None, 'balanceChange', None, (), None, None))

	# Assert:
	assert [(2, 'lockHashCreated'), (2, 'harvestFee'), (1, 'harvestFee')] == [
		(row['height'], row['receipt_type']) for row in result.items]


def test_receipts_paginates_ordered_rows(symbol_database_config):
	# Arrange:
	_seed_receipts(symbol_database_config, [
		_create_receipt(1, 'harvestFee', 'balanceChange', amount=101),
		_create_receipt(2, 'harvestFee', 'balanceChange', amount=201),
		_create_receipt(2, 'lockHashCreated', 'balanceChange', amount=202),
		_create_receipt(3, 'lockHashCompleted', 'balanceChange', amount=301),
		_create_receipt(3, 'lockSecretCreated', 'balanceChange', amount=302)
	])
	database = _create_rest_database(symbol_database_config)

	# Act:
	first_page = database.get_receipts(ReceiptQuery(2, None, None, 'balanceChange', None, (), None, None))
	cursor = ReceiptCursor(
		1,
		'receipts',
		'mainnet',
		first_page.chain_revision,
		first_page.next_position.height,
		first_page.next_position.id,
		'0' * 64)
	result = database.get_receipts(ReceiptQuery(2, cursor, None, 'balanceChange', None, (), None, None))

	# Assert:
	assert [(2, 'lockHashCreated', 202), (2, 'harvestFee', 201)] == [
		(row['height'], row['receipt_type'], row['amount']) for row in result.items]


def test_receipts_no_cursor_exact_limit(symbol_database_config):
	# Arrange:
	_seed_receipts(symbol_database_config, [
		_create_receipt(1, amount=101),
		_create_receipt(2, amount=201)
	])
	database = _create_rest_database(symbol_database_config)

	# Act:
	result = database.get_receipts(ReceiptQuery(2, None, None, None, None, (), None, None))

	# Assert:
	assert 2 == len(result.items)
	assert result.next_position is None


def test_receipts_cursor_uses_last_item(symbol_database_config):
	# Arrange:
	_seed_receipts(symbol_database_config, [
		_create_receipt(1, 'harvestFee', 'balanceChange', amount=101),
		_create_receipt(1, 'lockHashCreated', 'balanceChange', amount=102),
		_create_receipt(1, 'lockHashCompleted', 'balanceChange', amount=103)
	])
	database = _create_rest_database(symbol_database_config)

	# Act:
	result = database.get_receipts(ReceiptQuery(2, None, None, 'balanceChange', None, (), None, None))

	# Assert:
	assert [3, 2] == [row['id'] for row in result.items]
	assert ReceiptPosition(1, 2) == result.next_position


def test_receipts_pages_no_duplicates(symbol_database_config):
	# Arrange:
	_seed_receipts(symbol_database_config, [
		_create_receipt(1, amount=101),
		_create_receipt(2, amount=201),
		_create_receipt(2, 'lockHashCreated', 'balanceChange', amount=202),
		_create_receipt(3, amount=301),
		_create_receipt(3, 'lockHashCreated', 'balanceChange', amount=302)
	])
	database = _create_rest_database(symbol_database_config)
	query_cursor = None
	rows = []

	# Act:
	while True:
		page = database.get_receipts(ReceiptQuery(2, query_cursor, None, None, None, (), None, None))
		rows.extend((row['height'], row['amount']) for row in page.items)
		if page.next_position is None:
			break
		query_cursor = ReceiptCursor(
			1,
			'receipts',
			'mainnet',
			page.chain_revision,
			page.next_position.height,
			page.next_position.id,
			'0' * 64)

	# Assert:
	assert [(3, 302), (3, 301), (2, 202), (2, 201), (1, 101)] == rows


def test_receipts_cursor_excludes_newer(symbol_database_config):
	# Arrange:
	_seed_receipts(
		symbol_database_config,
		[_create_receipt(2, amount=201), _create_receipt(1, amount=101)],
		sync_height=3)
	database = _create_rest_database(symbol_database_config)
	first_page = database.get_receipts(ReceiptQuery(1, None, None, None, None, (), None, None))
	query_cursor = ReceiptCursor(
		1,
		'receipts',
		'mainnet',
		first_page.chain_revision,
		first_page.next_position.height,
		first_page.next_position.id,
		'0' * 64)
	with PullerSymbolDatabase(symbol_database_config) as puller_database:
		puller_database.upsert_receipts_for_height(3, [_create_receipt(3, amount=301)], 0)

	# Act:
	result = database.get_receipts(ReceiptQuery(1, query_cursor, None, None, None, (), None, None))

	# Assert:
	assert [(1, 101)] == [(row['height'], row['amount']) for row in result.items]


def test_block_cursor_keeps_height(symbol_database_config):
	# Arrange:
	_seed_receipts(symbol_database_config, [
		_create_receipt(2, amount=201),
		_create_receipt(2, 'lockHashCreated', 'balanceChange', amount=202),
		_create_receipt(2, 'lockHashCompleted', 'balanceChange', amount=203),
		_create_receipt(1, amount=101)
	])
	database = _create_rest_database(symbol_database_config)
	first_page = database.get_receipts(ReceiptQuery(2, None, 2, None, None, (), None, None))
	query_cursor = ReceiptCursor(
		1,
		'blockReceipts',
		'mainnet',
		first_page.chain_revision,
		first_page.next_position.height,
		first_page.next_position.id,
		'0' * 64)

	# Act:
	second_page = database.get_receipts(ReceiptQuery(2, query_cursor, 2, None, None, (), None, None))

	# Assert:
	assert [(2, 201)] == [(row['height'], row['amount']) for row in second_page.items]


def test_receipts_empty_result(symbol_database_config):
	# Arrange:
	_seed_receipts(symbol_database_config, [])
	database = _create_rest_database(symbol_database_config)

	# Act:
	result = database.get_receipts(ReceiptQuery(10, None, None, None, None, (), None, None))

	# Assert:
	assert () == result.items
	assert result.next_position is None


def test_receipts_metadata_join(symbol_database_config):
	# Arrange:
	mosaic = {
		'mosaic_id': 'ABCDEF0123456789',
		'owner_address': OTHER_ADDRESS,
		'start_height': 1,
		'duration': 0,
		'expiration_height': None,
		'supply': 1,
		'divisibility': 3,
		'flags': 0,
		'supply_mutable': False,
		'transferable': True,
		'restrictable': False,
		'revokable': False,
		'raw_payload': {},
		'updated_at_height': 1
	}
	_seed_receipts(symbol_database_config, [
		_create_receipt(1, 'harvestFee', 'balanceChange', mosaic_id=mosaic['mosaic_id'])
	], mosaics=[mosaic])
	database = _create_rest_database(symbol_database_config)

	# Act:
	result = database.get_receipts(ReceiptQuery(10, None, None, None, None, (), None, None))

	# Assert:
	assert 3 == result.items[0]['mosaic_divisibility']


def test_receipts_missing_metadata(symbol_database_config):
	# Arrange:
	_seed_receipts(symbol_database_config, [
		_create_receipt(1, 'harvestFee', 'balanceChange', mosaic_id='ABCDEF0123456789')
	])
	database = _create_rest_database(symbol_database_config)

	# Act:
	result = database.get_receipts(ReceiptQuery(10, None, None, None, None, (), None, None))

	# Assert:
	assert result.items[0]['mosaic_divisibility'] is None


def test_get_blocks_reads_block_reward(symbol_database_config):
	# Arrange:
	_reset_database(symbol_database_config, sync_height=2)
	with PullerSymbolDatabase(symbol_database_config) as database:
		with database.connection.cursor() as cursor:
			cursor.execute('UPDATE symbol_blocks SET block_reward = 123 WHERE height = 2')
			database.connection.commit()
	rest_database = _create_rest_database(symbol_database_config)

	# Act:
	result = rest_database.get_blocks(None, 2, SortOrder.DESC)

	# Assert:
	assert [123, None] == [block.block_reward for block in result]


def test_get_block_reads_block_reward(symbol_database_config):
	# Arrange:
	_reset_database(symbol_database_config, sync_height=2)
	with PullerSymbolDatabase(symbol_database_config) as database:
		with database.connection.cursor() as cursor:
			cursor.execute('UPDATE symbol_blocks SET block_reward = 456 WHERE height = 2')
			database.connection.commit()
	rest_database = _create_rest_database(symbol_database_config)

	# Act:
	result = rest_database.get_block(2)

	# Assert:
	assert 456 == result.block_reward

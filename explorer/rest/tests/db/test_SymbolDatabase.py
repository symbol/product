from threading import Event, Thread
from unittest import TestCase

from common.tests.PostgresTestUtils import PostgresTestDatabase, drop_symbol_block_tables_if_present
from psycopg2 import Error as PsycopgError
from puller.db.SymbolDatabase import SymbolDatabase as PullerSymbolDatabase

from rest.db.SymbolDatabase import SortOrder, SymbolDatabase, SymbolDataUnavailable

from ..test.SymbolBlockTestUtils import create_symbol_block, create_symbol_importance_block, create_symbol_sync_state


class SnapshotInterleavingSymbolDatabase(SymbolDatabase):
	def __init__(self, db_config):
		super().__init__(db_config)
		self.state_read_event = Event()
		self.allow_block_read_event = Event()

	def _fetch_sync_state(self, cursor):  # pylint: disable=arguments-differ
		sync_state = super()._fetch_sync_state(cursor)
		self.state_read_event.set()
		if not self.allow_block_read_event.wait(timeout=5):
			raise RuntimeError('Timed out waiting for snapshot interleaving')
		return sync_state


class SymbolDatabaseConnectionTest(TestCase):
	def test_check_connection_returns_true_when_sync_state_exists(self):
		# Arrange + Act:
		result = _query_symbol_database(
			[],
			create_symbol_sync_state(last_synced_height=1, finalized_height=1),
			lambda database: database.check_connection())

		# Assert:
		self.assertTrue(result)

	def test_check_connection_returns_false_when_sync_state_is_absent(self):
		# Arrange + Act:
		result = _query_symbol_database(
			[],
			None,
			lambda database: database.check_connection())

		# Assert:
		self.assertFalse(result)


class SymbolDatabaseBlockHeadTest(TestCase):
	def test_get_block_head_height_returns_none_when_not_synced(self):
		# Arrange + Act:
		result = _query_symbol_database(
			[],
			None,
			lambda database: database.get_block_head_height())

		# Assert:
		self.assertIsNone(result)

	def test_get_block_head_height_returns_none_for_zero_last_synced_height(self):
		# Arrange + Act:
		result = _query_symbol_database(
			[],
			create_symbol_sync_state(last_synced_height=0, finalized_height=None),
			lambda database: database.get_block_head_height())

		# Assert:
		self.assertIsNone(result)

	def test_get_block_head_height_uses_last_synced_height(self):
		# Arrange + Act:
		result = _query_symbol_database(
			[],
			create_symbol_sync_state(
				last_synced_height=123,
				finalized_height=100),
			lambda database: database.get_block_head_height())

		# Assert:
		self.assertEqual(123, result)

	def test_get_block_head_height_returns_none_for_unreadable_state(self):
		# Arrange + Act:
		result = _query_symbol_database(
			[],
			create_symbol_sync_state(
				last_synced_height=123,
				finalized_height=100,
				status='unhealthy'),
			lambda database: database.get_block_head_height())

		# Assert:
		self.assertIsNone(result)


class SymbolDatabaseBlocksTest(TestCase):  # pylint: disable=too-many-public-methods
	def test_get_blocks_returns_unavailable_when_ascending_range_crosses_dirty_boundary(self):
		# Arrange + Act + Assert:
		with self.assertRaises(SymbolDataUnavailable):
			_get_blocks(
				range(15, 25),
				create_symbol_sync_state(
					last_synced_height=30,
					finalized_height=10,
					dirty_state_from_height=20),
				{'from_height': 15, 'limit': 10, 'sort': SortOrder.ASC})

	def test_get_blocks_reads_descending_range_below_dirty_boundary(self):
		# Arrange + Act:
		result = _get_blocks(
			range(10, 20),
			create_symbol_sync_state(
				last_synced_height=30,
				finalized_height=10,
				dirty_state_from_height=20),
			{'from_height': 19, 'limit': 10, 'sort': SortOrder.DESC})

		# Assert:
		self.assertEqual(list(range(19, 9, -1)), [block.height for block in result])

	def test_get_block_returns_unavailable_at_dirty_boundary(self):
		# Arrange + Act + Assert:
		with self.assertRaises(SymbolDataUnavailable):
			_get_block(
				[create_symbol_block(20)],
				create_symbol_sync_state(
					last_synced_height=30,
					finalized_height=10,
					dirty_state_from_height=20),
				20)

	def test_get_block_returns_none_above_last_synced_height(self):
		# Arrange + Act:
		result = _get_block(
			[create_symbol_block(2)],
			create_symbol_sync_state(last_synced_height=1, finalized_height=1),
			2)

		# Assert:
		self.assertIsNone(result)

	def test_get_block_reads_state_and_row_from_same_snapshot(self):
		# Arrange / Act:
		result = _query_symbol_database_during_update(lambda database: database.get_block(1))

		# Assert:
		self.assertEqual(100, result.block_reward)

	def test_get_blocks_reads_state_and_rows_from_same_snapshot(self):
		# Arrange / Act:
		result = _query_symbol_database_during_update(
			lambda database: database.get_blocks(None, 1, SortOrder.DESC))

		# Assert:
		self.assertEqual([100], [block.block_reward for block in result])

	def test_get_block_returns_unavailable_above_repairing_head(self):
		# Arrange / Act / Assert:
		with self.assertRaises(SymbolDataUnavailable):
			_get_block(
				[create_symbol_block(2)],
				create_symbol_sync_state(
					last_synced_height=1,
					finalized_height=1,
					status='repairing'),
				2)

	def test_get_blocks_returns_unavailable_for_ascending_cursor_above_repairing_head(self):
		# Arrange / Act / Assert:
		with self.assertRaises(SymbolDataUnavailable):
			_get_blocks(
				range(2, 3),
				create_symbol_sync_state(
					last_synced_height=1,
					finalized_height=1,
					status='repairing'),
				{'from_height': 2, 'limit': 1, 'sort': SortOrder.ASC})

	def test_get_blocks_returns_unavailable_for_descending_cursor_above_repairing_head(self):
		# Arrange / Act / Assert:
		with self.assertRaises(SymbolDataUnavailable):
			_get_blocks(
				range(2, 3),
				create_symbol_sync_state(
					last_synced_height=1,
					finalized_height=1,
					status='repairing'),
				{'from_height': 2, 'limit': 1, 'sort': SortOrder.DESC})

	def test_get_blocks_returns_repairing_block_at_safe_ascending_boundary(self):
		# Arrange + Act:
		result = _get_blocks(
			range(1, 2),
			create_symbol_sync_state(
				last_synced_height=1,
				finalized_height=1,
				status='repairing'),
			{'from_height': 1, 'limit': 1, 'sort': SortOrder.ASC})

		# Assert:
		self.assertEqual([1], [block.height for block in result])

	def test_get_blocks_rejects_repairing_ascending_range_crossing_head(self):
		# Arrange + Act + Assert:
		with self.assertRaises(SymbolDataUnavailable):
			_get_blocks(
				range(1, 2),
				create_symbol_sync_state(
					last_synced_height=1,
					finalized_height=1,
					status='repairing'),
				{'from_height': 1, 'limit': 2, 'sort': SortOrder.ASC})

	def test_get_blocks_rejects_repairing_ascending_range_without_cursor(self):
		# Arrange + Act + Assert:
		with self.assertRaises(SymbolDataUnavailable):
			_get_blocks(
				range(1, 2),
				create_symbol_sync_state(
					last_synced_height=1,
					finalized_height=1,
					status='repairing'),
				{'from_height': None, 'limit': 2, 'sort': SortOrder.ASC})

	def test_get_blocks_keeps_clean_ascending_range_short_at_head(self):
		# Arrange + Act:
		result = _get_blocks(
			range(1, 2),
			create_symbol_sync_state(last_synced_height=1, finalized_height=1),
			{'from_height': 1, 'limit': 2, 'sort': SortOrder.ASC})

		# Assert:
		self.assertEqual([1], [block.height for block in result])

	def test_failed_block_sql_returns_connection_for_next_request(self):
		# Arrange:
		with PostgresTestDatabase() as db_config:
			with PullerSymbolDatabase(db_config) as puller_database:
				drop_symbol_block_tables_if_present(puller_database)
				puller_database.create_tables()
				puller_database.upsert_sync_state(create_symbol_sync_state(last_synced_height=1, finalized_height=1))
				puller_database.upsert_blocks([create_symbol_block(1)])
				database = SymbolDatabase(db_config)
				cursor = puller_database.connection.cursor()
				cursor.execute('ALTER TABLE symbol_blocks RENAME COLUMN block_reward TO block_reward_for_test')
				puller_database.connection.commit()
				cursor.close()

				try:
					# Act:
					with self.assertRaises(PsycopgError):
						database.get_block(1)

					cursor = puller_database.connection.cursor()
					cursor.execute('ALTER TABLE symbol_blocks RENAME COLUMN block_reward_for_test TO block_reward')
					puller_database.connection.commit()
					cursor.close()
					result = database.get_block(1)
				finally:
					database._pool.closeall()  # pylint: disable=protected-access
					drop_symbol_block_tables_if_present(puller_database)

		# Assert:
		self.assertEqual(1, result.height)

	def test_get_blocks_returns_unavailable_when_dirty_boundary_has_no_safe_height(self):
		# Arrange + Act + Assert:
		with self.assertRaises(SymbolDataUnavailable):
			_get_blocks(
				[],
				create_symbol_sync_state(
					last_synced_height=30,
					finalized_height=10,
					dirty_state_from_height=1),
				{'from_height': None, 'limit': 10, 'sort': SortOrder.DESC})

	def test_get_blocks_returns_unavailable_for_invalid_dirty_boundary(self):
		# Arrange + Act + Assert:
		with self.assertRaises(SymbolDataUnavailable):
			_get_blocks(
				[],
				create_symbol_sync_state(
					last_synced_height=30,
					finalized_height=10,
					dirty_state_from_height=0),
				{'from_height': None, 'limit': 10, 'sort': SortOrder.DESC})

	def test_get_blocks_returns_none_when_sync_state_is_missing(self):
		# Arrange + Act + Assert:
		with self.assertRaises(SymbolDataUnavailable):
			_query_symbol_database(
				[],
				None,
				lambda database: database.get_blocks(None, 10, SortOrder.DESC))

	def test_get_blocks_returns_empty_for_zero_limit(self):
		# Arrange + Act:
		result = _query_symbol_database(
			[],
			create_symbol_sync_state(last_synced_height=1, finalized_height=1),
			lambda database: database.get_blocks(None, 0, SortOrder.DESC))

		# Assert:
		self.assertEqual([], result)

	def test_get_blocks_returns_empty_for_descending_cursor_after_head(self):
		# Arrange + Act:
		result = _query_symbol_database(
			[],
			create_symbol_sync_state(last_synced_height=1, finalized_height=1),
			lambda database: database.get_blocks(2, 1, SortOrder.DESC))

		# Assert:
		self.assertEqual([], result)

	def test_get_blocks_returns_empty_for_ascending_cursor_after_head(self):
		# Arrange + Act:
		result = _query_symbol_database(
			[],
			create_symbol_sync_state(
				last_synced_height=100,
				finalized_height=90),
			lambda database: database.get_blocks(101, 10, SortOrder.ASC))

		# Assert:
		self.assertEqual([], result)

	def test_get_blocks_rejects_invalid_sort(self):
		# Arrange + Act + Assert:
		with self.assertRaisesRegex(
			ValueError,
			'Sort must be either ASC or DESC'
		):
			_query_symbol_database(
				[],
				create_symbol_sync_state(
					last_synced_height=3,
					finalized_height=2),
				lambda database: database.get_blocks(None, 1, 'height DESC'))

	def test_get_blocks_rejects_invalid_from_height(self):
		# Arrange + Act + Assert:
		with self.assertRaisesRegex(
			ValueError,
			'fromHeight must be greater than or equal to 1'
		):
			_query_symbol_database(
				[],
				create_symbol_sync_state(
					last_synced_height=3,
					finalized_height=2),
				lambda database: database.get_blocks(0, 1, SortOrder.DESC))

	def test_get_block_returns_none_when_sync_state_is_unreadable(self):
		# Arrange + Act + Assert:
		with self.assertRaises(SymbolDataUnavailable):
			_query_symbol_database(
				[create_symbol_block(2)],
				create_symbol_sync_state(
					last_synced_height=2,
					finalized_height=2,
					status='unhealthy'),
				lambda database: database.get_block(2))

	def test_can_get_blocks_from_postgresql_without_cursor(self):
		# Arrange + Act:
		result = _get_blocks(
			range(1, 4),
			create_symbol_sync_state(last_synced_height=3, finalized_height=2),
			{'from_height': None, 'limit': 1, 'sort': SortOrder.DESC})

		# Assert:
		self.assertEqual([3], [block.height for block in result])
		self.assertEqual([False], [block.is_finalized for block in result])

	def test_can_get_blocks_from_postgresql_with_from_height_cursor(self):
		# Arrange + Act:
		result = _get_blocks(
			range(1, 6),
			create_symbol_sync_state(last_synced_height=5, finalized_height=3),
			{'from_height': 4, 'limit': 2, 'sort': SortOrder.DESC})

		# Assert:
		self.assertEqual([4, 3], [block.height for block in result])
		self.assertEqual(
			[False, True],
			[block.is_finalized for block in result])

	def test_can_get_blocks_from_postgresql_with_ascending_cursor(self):
		# Arrange + Act:
		result = _get_blocks(
			range(20, 30),
			create_symbol_sync_state(
				last_synced_height=100,
				finalized_height=25),
			{'from_height': 20, 'limit': 10, 'sort': SortOrder.ASC})

		# Assert:
		self.assertEqual(
			list(range(20, 30)),
			[block.height for block in result])
		self.assertEqual(
			[True] * 6 + [False] * 4,
			[block.is_finalized for block in result])

	def test_can_get_block_from_postgresql(self):
		# Arrange + Act:
		result = _get_block(
			[create_symbol_block(2)],
			create_symbol_sync_state(last_synced_height=2, finalized_height=2),
			2)

		# Assert:
		self.assertEqual(2, result.height)
		self.assertTrue(result.is_finalized)
		self.assertEqual(2000000, result.total_fee)
		self.assertEqual(2, result.transaction_count)

	def test_can_get_block_from_postgresql_without_finalized_height(self):
		# Arrange + Act:
		result = _get_block(
			[create_symbol_block(2)],
			create_symbol_sync_state(
				last_synced_height=2,
				finalized_height=None),
			2)

		# Assert:
		self.assertEqual(2, result.height)
		self.assertEqual(
			'TCEUGLPCMO5Y72EEISSNUKGTMCN5RO4PVYMK5FI',
			result.beneficiary_address)
		self.assertFalse(result.is_finalized)

	def test_get_importance_fields(self):
		# Arrange + Act:
		result = _get_block(
			[create_symbol_importance_block(2)],
			create_symbol_sync_state(last_synced_height=2, finalized_height=2),
			2)

		# Assert:
		self.assertEqual(4, result.voting_eligible_accounts_count)
		self.assertEqual(17, result.harvesting_eligible_accounts_count)
		self.assertEqual(19000235663367, result.total_voting_balance)
		self.assertEqual(
			bytes.fromhex('86' * 32),
			result.previous_importance_block_hash)


class SymbolDatabaseSyncStateTest(TestCase):
	def test_try_get_sync_state_returns_none_when_row_is_missing(self):
		# Arrange + Act:
		result = _query_symbol_database(
			[],
			None,
			lambda database: database.try_get_sync_state())

		# Assert:
		self.assertIsNone(result)


def _get_blocks(block_heights, sync_state, query):
	blocks = [create_symbol_block(height) for height in block_heights]

	return _query_symbol_database(
		blocks,
		sync_state,
		lambda database: database.get_blocks(
			query['from_height'],
			query['limit'],
			query['sort']))


def _get_block(blocks, sync_state, height):
	return _query_symbol_database(
		blocks,
		sync_state,
		lambda database: database.get_block(height))


def _query_symbol_database(blocks, sync_state, query_database):
	with PostgresTestDatabase() as db_config:
		with PullerSymbolDatabase(db_config) as puller_database:
			try:
				drop_symbol_block_tables_if_present(puller_database)
				puller_database.create_tables()
				if sync_state:
					puller_database.upsert_sync_state(sync_state)
				puller_database.upsert_blocks(blocks)

				database = SymbolDatabase(db_config)
				try:
					return query_database(database)
				finally:
					database._pool.closeall()  # pylint: disable=protected-access
			finally:
				drop_symbol_block_tables_if_present(puller_database)


def _query_symbol_database_during_update(query_database):
	with PostgresTestDatabase() as db_config:
		with PullerSymbolDatabase(db_config) as puller_database:
			try:
				drop_symbol_block_tables_if_present(puller_database)
				puller_database.create_tables()
				puller_database.upsert_sync_state(create_symbol_sync_state(last_synced_height=1, finalized_height=1))
				puller_database.upsert_blocks([create_symbol_block(1)])
				puller_database.upsert_receipts_for_height(1, [], 100)

				database = SnapshotInterleavingSymbolDatabase(db_config)
				result = []
				errors = []

				def read_database():
					try:
						result.append(query_database(database))
					except Exception as error:  # pylint: disable=broad-exception-caught
						errors.append(error)

				reader_thread = Thread(target=read_database)
				reader_thread.start()
				try:
					if not database.state_read_event.wait(timeout=5):
						raise AssertionError('Reader did not fetch sync state')
					_update_state_and_block(db_config)
				finally:
					database.allow_block_read_event.set()
					reader_thread.join(timeout=5)

				if reader_thread.is_alive():
					raise AssertionError('Reader did not finish')
				if errors:
					raise errors[0]
				return result[0]
			finally:
				database._pool.closeall()  # pylint: disable=protected-access
				drop_symbol_block_tables_if_present(puller_database)


def _update_state_and_block(db_config):
	with PullerSymbolDatabase(db_config) as puller_database:
		cursor = puller_database.connection.cursor()
		try:
			cursor.execute('UPDATE symbol_sync_state SET status = %s WHERE id = 1', ('unhealthy',))
			cursor.execute('UPDATE symbol_blocks SET block_reward = %s WHERE height = 1', (999,))
			puller_database.connection.commit()
		finally:
			cursor.close()

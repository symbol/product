from unittest import TestCase

from common.tests.PostgresTestUtils import PostgresTestDatabase, drop_symbol_block_tables_if_present
from puller.db.SymbolDatabase import SymbolDatabase as PullerSymbolDatabase

from rest.db.SymbolDatabase import SymbolDatabase
from rest.model.common import DatabaseConfig

from ..test.SymbolBlockTestUtils import create_symbol_block, create_symbol_importance_block, create_symbol_sync_state


class FalseCursor:
	def __enter__(self):
		return self

	def __exit__(self, *_):
		pass

	def execute(self, _statement):
		pass

	@staticmethod
	def fetchone():
		return (0,)


class FalseConnection:
	def __enter__(self):
		return self

	def __exit__(self, *_):
		pass

	@staticmethod
	def cursor():
		return FalseCursor()


class FalseConnectionPool:
	@staticmethod
	def getconn():
		return FalseConnection()

	@staticmethod
	def putconn(_connection):
		pass


class FalseSelectOneSymbolDatabase(SymbolDatabase):
	def _create_pool(self):
		return FalseConnectionPool()


class SymbolDatabaseConnectionTest(TestCase):
	def test_check_connection_executes_select_one(self):
		# Arrange + Act:
		result = _query_symbol_database(
			[],
			None,
			lambda database: database.check_connection())

		# Assert:
		self.assertTrue(result)

	def test_check_connection_returns_false_for_unexpected_select_one(self):
		# Arrange:
		# Last resort: real PostgreSQL cannot make SELECT 1 return 0, so this
		# covers only the defensive false branch.
		database = FalseSelectOneSymbolDatabase(DatabaseConfig(
			'unused',
			'unused',
			'',
			'127.0.0.1',
			'5432'))

		# Act:
		result = database.check_connection()

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


class SymbolDatabaseBlocksTest(TestCase):
	def test_get_blocks_returns_none_when_sync_state_is_missing(self):
		# Arrange + Act:
		result = _query_symbol_database(
			[],
			None,
			lambda database: database.get_blocks(10, None, 'DESC'))

		# Assert:
		self.assertIsNone(result)

	def test_get_blocks_returns_empty_for_zero_limit(self):
		# Arrange + Act:
		result = _query_symbol_database(
			[],
			create_symbol_sync_state(last_synced_height=1, finalized_height=1),
			lambda database: database.get_blocks(0, None, 'DESC'))

		# Assert:
		self.assertEqual([], result)

	def test_get_blocks_returns_empty_for_descending_cursor_after_head(self):
		# Arrange + Act:
		result = _query_symbol_database(
			[],
			create_symbol_sync_state(last_synced_height=1, finalized_height=1),
			lambda database: database.get_blocks(1, 2, 'DESC'))

		# Assert:
		self.assertEqual([], result)

	def test_get_blocks_returns_empty_for_ascending_cursor_after_head(self):
		# Arrange + Act:
		result = _query_symbol_database(
			[],
			create_symbol_sync_state(
				last_synced_height=100,
				finalized_height=90),
			lambda database: database.get_blocks(10, 101, 'ASC'))

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
				lambda database: database.get_blocks(1, None, 'height DESC'))

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
				lambda database: database.get_blocks(1, 0, 'DESC'))


class SymbolDatabaseBlockTest(TestCase):
	def test_get_block_returns_none_when_sync_state_is_unreadable(self):
		# Arrange + Act:
		result = _query_symbol_database(
			[create_symbol_block(2)],
			create_symbol_sync_state(
				last_synced_height=2,
				finalized_height=2,
				status='unhealthy'),
			lambda database: database.get_block(2))

		# Assert:
		self.assertIsNone(result)


class SymbolDatabaseSyncStateTest(TestCase):
	def test_get_sync_state_returns_none_when_row_is_missing(self):
		# Arrange + Act:
		result = _query_symbol_database(
			[],
			None,
			lambda database: database.get_sync_state())

		# Assert:
		self.assertIsNone(result)


class SymbolDatabasePostgresTest(TestCase):
	def test_can_get_blocks_from_postgresql_without_cursor(self):
		# Arrange + Act:
		result = _get_blocks_from_postgresql(
			range(1, 4),
			create_symbol_sync_state(last_synced_height=3, finalized_height=2),
			{'limit': 1, 'from_height': None, 'sort': 'DESC'})

		# Assert:
		self.assertEqual([3], [block.height for block in result])
		self.assertEqual([False], [block.is_finalized for block in result])

	def test_can_get_blocks_from_postgresql_with_from_height_cursor(self):
		# Arrange + Act:
		result = _get_blocks_from_postgresql(
			range(1, 6),
			create_symbol_sync_state(last_synced_height=5, finalized_height=3),
			{'limit': 2, 'from_height': 4, 'sort': 'DESC'})

		# Assert:
		self.assertEqual([4, 3], [block.height for block in result])
		self.assertEqual(
			[False, True],
			[block.is_finalized for block in result])

	def test_can_get_blocks_from_postgresql_with_ascending_cursor(self):
		# Arrange + Act:
		result = _get_blocks_from_postgresql(
			range(20, 30),
			create_symbol_sync_state(
				last_synced_height=100,
				finalized_height=25),
			{'limit': 10, 'from_height': 20, 'sort': 'ASC'})

		# Assert:
		self.assertEqual(
			list(range(20, 30)),
			[block.height for block in result])
		self.assertEqual(
			[True] * 6 + [False] * 4,
			[block.is_finalized for block in result])

	def test_can_get_block_from_postgresql(self):
		# Arrange + Act:
		result = _get_block_from_postgresql(
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
		result = _get_block_from_postgresql(
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
		result = _get_block_from_postgresql(
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


def _get_blocks_from_postgresql(block_heights, sync_state, query):
	blocks = [create_symbol_block(height) for height in block_heights]

	return _query_symbol_database(
		blocks,
		sync_state,
		lambda database: database.get_blocks(
			query['limit'],
			query['from_height'],
			query['sort']))


def _get_block_from_postgresql(blocks, sync_state, height):
	return _query_symbol_database(
		blocks,
		sync_state,
		lambda database: database.get_block(height))


def _query_symbol_database(blocks, sync_state, query_database):
	with PostgresTestDatabase() as db_config:
		created_tables = False
		with PullerSymbolDatabase(db_config) as puller_database:
			try:
				drop_symbol_block_tables_if_present(puller_database)
				puller_database.create_tables()
				created_tables = True
				if sync_state:
					puller_database.upsert_sync_state(sync_state)
				puller_database.upsert_blocks(blocks)

				database = SymbolDatabase(db_config)
				try:
					return query_database(database)
				finally:
					database._pool.closeall()  # pylint: disable=protected-access
			finally:
				if created_tables:
					drop_symbol_block_tables_if_present(puller_database)

import unittest

from PostgresTestUtils import PostgresTestDatabase
from psycopg2 import Error as PsycopgError

from puller.db.SymbolDatabase import SymbolDatabase


def _drop_symbol_tables(database):
	cursor = database.connection.cursor()
	cursor.execute('DROP TABLE IF EXISTS symbol_sync_state')
	cursor.execute('DROP TYPE IF EXISTS symbol_sync_state_status')
	database.connection.commit()


class SymbolDatabaseTest(unittest.TestCase):
	def setUp(self):
		self.db_config = self.enterContext(PostgresTestDatabase())

	def _create_database(self):
		database = self.enterContext(SymbolDatabase(self.db_config))
		_drop_symbol_tables(database)
		self.addCleanup(_drop_symbol_tables, database)
		database.create_tables()

		return database

	def test_create_tables_creates_symbol_sync_state_only(self):
		# Arrange:
		database = self._create_database()
		cursor = database.connection.cursor()

		# Act:
		cursor.execute(
			'''
			SELECT table_name
			FROM information_schema.tables
			WHERE table_schema = 'public'
			ORDER BY table_name
			'''
		)
		tables = [result[0] for result in cursor.fetchall()]
		cursor.execute(
			'''
			SELECT column_name, data_type, udt_name
			FROM information_schema.columns
			WHERE table_name = 'symbol_sync_state'
			ORDER BY ordinal_position
			'''
		)
		columns = cursor.fetchall()
		cursor.execute(
			'''
			SELECT enumlabel
			FROM pg_enum
			JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
			WHERE pg_type.typname = 'symbol_sync_state_status'
			ORDER BY enumsortorder
			'''
		)
		status_values = [result[0] for result in cursor.fetchall()]
		cursor.execute(
			'''
			SELECT conname
			FROM pg_constraint
			WHERE conrelid = 'symbol_sync_state'::regclass
			ORDER BY conname
			'''
		)
		constraints = [result[0] for result in cursor.fetchall()]

		# Assert:
		self.assertEqual(['symbol_sync_state'], tables)
		self.assertEqual([
			('id', 'integer', 'int4'),
			('status', 'USER-DEFINED', 'symbol_sync_state_status'),
			('chain_height', 'bigint', 'int8'),
			('finalized_height', 'bigint', 'int8'),
			('finalized_hash', 'bytea', 'bytea'),
			('last_synced_height', 'bigint', 'int8'),
			('last_synced_block_hash', 'bytea', 'bytea'),
			('updated_at', 'timestamp without time zone', 'timestamp')
		], columns)
		self.assertEqual(['initialized', 'healthy', 'repairing', 'unhealthy'], status_values)
		self.assertIn('symbol_sync_state_singleton', constraints)

	def test_create_tables_rejects_unknown_status(self):
		# Arrange:
		database = self._create_database()
		cursor = database.connection.cursor()

		# Act + Assert:
		with self.assertRaises(PsycopgError):
			cursor.execute("INSERT INTO symbol_sync_state (id, status) VALUES (1, 'unknown')")

		database.connection.rollback()

	def test_check_connection_executes_select_one(self):
		# Arrange:
		database = self._create_database()

		# Act:
		result = database.check_connection()

		# Assert:
		self.assertTrue(result)

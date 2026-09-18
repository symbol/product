from unittest import TestCase

from common.tests.PostgresTestUtils import PostgresTestDatabase
from psycopg2.pool import PoolError

from rest.db.SymbolDatabase import SymbolDatabase


class CloseFailingSymbolDatabase(SymbolDatabase):
	def close(self):
		raise OSError('close failed')


class SymbolDatabaseLifecycleTest(TestCase):
	def test_context_closes_symbol_pool(self):
		# Arrange:
		with PostgresTestDatabase() as db_config:
			database = SymbolDatabase(db_config)
			try:
				# Act:
				with database as entered_database:
					pass

				# Assert:
				self.assertIs(database, entered_database)
				with self.assertRaises(PoolError):
					with database.connection():
						pass
			finally:
				database.close()

	def test_context_close_failure_propagates_without_operation_error(self):
		# Arrange:
		with PostgresTestDatabase() as db_config:
			database = CloseFailingSymbolDatabase(db_config)
			try:
				# Act + Assert:
				with self.assertRaisesRegex(OSError, 'close failed'):
					with database:
						pass
			finally:
				SymbolDatabase.close(database)

	def test_context_close_failure_preserves_operation_error(self):
		# Arrange:
		with PostgresTestDatabase() as db_config:
			database = CloseFailingSymbolDatabase(db_config)
			try:
				# Act + Assert:
				with self.assertLogs('pythonConfig', level='ERROR') as logs:
					with self.assertRaisesRegex(RuntimeError, 'operation failed'):
						with database:
							raise RuntimeError('operation failed')
				# Assert:
				self.assertEqual('ERROR:pythonConfig:Failed to close Symbol database after an operation failure', logs.output[0])
			finally:
				SymbolDatabase.close(database)

	def test_operation_error_propagates_when_close_succeeds(self):  # pylint: disable=invalid-name
		# Arrange:
		with PostgresTestDatabase() as db_config:
			database, operation_error = SymbolDatabase(db_config), RuntimeError('operation failed')
			try:
				# Act:
				with self.assertRaises(RuntimeError) as exception_info:
					with database:
						raise operation_error
				# Assert:
				self.assertIs(operation_error, exception_info.exception)
				with self.assertRaises(PoolError), database.connection():
					pass
			finally:
				database.close()

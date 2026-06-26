import unittest
from unittest.mock import patch

from common.tests.PostgresTestUtils import PostgresTestDatabase

from rest.db.SymbolDatabase import SymbolDatabase


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


class SymbolDatabaseTest(unittest.TestCase):
	def test_check_connection_executes_select_one(self):
		# Arrange:
		with PostgresTestDatabase() as db_config:
			database = SymbolDatabase(db_config)

			# Act:
			result = database.check_connection()

			# Assert:
			self.assertTrue(result)

	def test_check_connection_returns_false_when_select_one_returns_different_value(self):
		# Arrange:
		with PostgresTestDatabase() as db_config:
			with patch.object(SymbolDatabase, '_create_pool', return_value=FalseConnectionPool()):
				database = SymbolDatabase(db_config)

				# Act:
				result = database.check_connection()

		# Assert:
		self.assertFalse(result)

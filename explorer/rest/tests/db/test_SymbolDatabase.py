import unittest

from rest.db.SymbolDatabase import SymbolDatabase

from ..test.PostgresTestUtils import PostgresTestDatabase


class SymbolDatabaseTest(unittest.TestCase):
	def test_check_connection_executes_select_one(self):
		# Arrange:
		with PostgresTestDatabase() as db_config:
			database = SymbolDatabase(db_config)

			# Act:
			result = database.check_connection()

		# Assert:
		self.assertTrue(result)

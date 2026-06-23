from unittest import TestCase
from unittest.mock import Mock

from puller.db.SymbolDatabase import SymbolDatabase


class TestSymbolDatabase(TestCase):
	def test_create_tables_creates_symbol_sync_state_only(self):
		database = SymbolDatabase.__new__(SymbolDatabase)
		cursor = Mock()
		connection = Mock()
		connection.cursor.return_value = cursor
		database.connection = connection

		database.create_tables()

		self.assertEqual(1, cursor.execute.call_count)
		self.assertIn('CREATE TABLE IF NOT EXISTS symbol_sync_state', cursor.execute.call_args[0][0])
		self.assertIn('status varchar(32) NOT NULL', cursor.execute.call_args[0][0])
		self.assertNotIn("DEFAULT 'initialized'", cursor.execute.call_args[0][0])
		self.assertNotIn('symbol_blocks', cursor.execute.call_args[0][0])
		connection.commit.assert_called_once_with()

	def test_check_connection_executes_select_one(self):
		database = SymbolDatabase.__new__(SymbolDatabase)
		cursor = Mock()
		cursor.fetchone.return_value = (1,)
		connection = Mock()
		connection.cursor.return_value = cursor
		database.connection = connection

		result = database.check_connection()

		self.assertTrue(result)
		cursor.execute.assert_called_once_with('SELECT 1')

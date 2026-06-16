from unittest import TestCase
from unittest.mock import MagicMock, Mock

from rest.db.SymbolDatabase import SymbolDatabase


class TestSymbolDatabase(TestCase):
	def test_check_connection_executes_select_one(self):
		database = SymbolDatabase.__new__(SymbolDatabase)
		cursor = Mock()
		cursor.fetchone.return_value = (1,)
		connection = Mock()
		connection.cursor.return_value = MagicMock()
		connection.cursor.return_value.__enter__.return_value = cursor
		database.connection = Mock()
		database.connection.return_value = MagicMock()
		database.connection.return_value.__enter__.return_value = connection

		result = database.check_connection()

		self.assertTrue(result)
		cursor.execute.assert_called_once_with('SELECT 1')

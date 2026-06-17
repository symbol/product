from contextlib import nullcontext
from unittest import TestCase
from unittest.mock import Mock

from rest.db.SymbolDatabase import SymbolDatabase


class TestSymbolDatabase(TestCase):
	def test_check_connection_executes_select_one(self):
		database = SymbolDatabase.__new__(SymbolDatabase)
		cursor = Mock()
		cursor.fetchone.return_value = (1,)
		connection = Mock()
		connection.cursor.return_value = nullcontext(cursor)
		database.connection = Mock(return_value=nullcontext(connection))

		result = database.check_connection()

		self.assertTrue(result)
		cursor.execute.assert_called_once_with('SELECT 1')

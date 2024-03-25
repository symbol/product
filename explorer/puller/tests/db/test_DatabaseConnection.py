import unittest
from unittest.mock import MagicMock, patch

from db.DatabaseConnection import DatabaseConnection


class DatabaseConnectionTest(unittest.TestCase):

	def setUp(self):
		# Arrange:
		self.db_config = {
			'database': 'test_db',
			'user': 'test_user',
			'password': 'test_password',
			'host': 'test_host',
			'port': 'test_port'
		}

	def test_create_database_connection(self):
		# Act:
		database_connection = DatabaseConnection(self.db_config)

		# Assert:
		self.assertEqual(database_connection.db_config, self.db_config)
		self.assertIsNone(database_connection.connection)

	@patch('db.DatabaseConnection.psycopg2.connect')
	def test_enter_exit(self, mock_connect):
		# Arrange:
		database_connection = DatabaseConnection(self.db_config)
		mock_connect.return_value.close = MagicMock()

		# Act:
		with database_connection as connection:
			# Assert:
			self.assertEqual(connection.connection, database_connection.connection)
			mock_connect.assert_called_once_with(
				database=self.db_config['database'],
				user=self.db_config['user'],
				password=self.db_config['password'],
				host=self.db_config['host'],
				port=self.db_config['port']
			)

		# Assert:
		mock_connect.return_value.close.assert_called_once()

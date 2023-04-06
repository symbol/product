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

	@patch('db.DatabaseConnection.psycopg2.connect')
	def test_create_database_connection(self, mock_connect):

		# Act:
		DatabaseConnection(self.db_config)

		# Assert:
		mock_connect.assert_called_once_with(
			database=self.db_config['database'],
			user=self.db_config['user'],
			password=self.db_config['password'],
			host=self.db_config['host'],
			port=self.db_config['port']
		)

	@patch('db.DatabaseConnection.psycopg2.connect')
	def test_enter_exit(self, mock_connect):
		# Arrange:
		mock_connect.return_value.close = MagicMock()

		# Act:
		with DatabaseConnection(self.db_config) as connection:
			# Assert:
			self.assertEqual(connection.connection, mock_connect.return_value)

		# Assert:
		mock_connect.return_value.close.assert_called_once()

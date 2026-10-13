import unittest
from collections import namedtuple

import psycopg2
import pytest

from puller.db.DatabaseConnection import DatabaseConnection

DatabaseConfig = namedtuple('DatabaseConfig', ['database', 'user', 'password', 'host', 'port'])


@pytest.mark.usefixtures('database_config')
class DatabaseConnectionTest(unittest.TestCase):
	db_config = None  # pylint: disable=invalid-name

	def test_create_database_connection(self):
		# Arrange + Act:
		database_connection = DatabaseConnection(self.db_config)

		# Assert
		self.assertEqual(database_connection.db_config, self.db_config)
		self.assertIsNone(database_connection.connection)

	def test_connect_database(self):
		# Arrange:
		database_connection = DatabaseConnection(self.db_config)

		# Act:
		with database_connection as connection:
			# Assert:
			self.assertIsNotNone(connection.connection)
			self.assertIsInstance(connection.connection, psycopg2.extensions.connection)
			cursor = connection.connection.cursor()
			cursor.execute('SELECT 1')
			result = cursor.fetchone()
			self.assertEqual(result[0], 1)

		# 0 = connection open
		# 1 = connection closed
		self.assertEqual(database_connection.connection.closed, 1)  # Connection should be closed after exiting context

	def test_connect_database_with_invalid_config_raises_error(self):
		# Arrange:
		invalid_config = DatabaseConfig(
			database='invalid_db',
			user='invalid_user',
			password='invalid_password',
			host='invalid_host',
			port=9999
		)

		database_connection = DatabaseConnection(invalid_config)

		# Act & Assert:
		with self.assertRaises(psycopg2.OperationalError):
			with database_connection:
				pass  # connection failure should raise error

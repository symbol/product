import unittest

import psycopg2
import testing.postgresql

from rest.db.DatabaseConnection import DatabaseConnectionPool

from ..test.DatabaseTestUtils import DatabaseConfig


class TestDatabaseConnectionPool(unittest.TestCase):

	def setUp(self):
		self.postgresql = testing.postgresql.Postgresql()
		self.db_config = DatabaseConfig(**self.postgresql.dsn(), password='')

	def tearDown(self):
		self.postgresql.stop()

	def test_can_acquire_connection(self):
		# Arrange:
		database_connection_pool = DatabaseConnectionPool(self.db_config)

		# Act:
		with database_connection_pool.connection() as connection:
			# Assert:
			self.assertIsNotNone(connection)
			self.assertIsInstance(connection, psycopg2.extensions.connection)

	def test_can_release_connection(self):
		# Arrange:
		database_connection_pool = DatabaseConnectionPool(self.db_config, min_connections=1, max_connections=2)

		# Act & Assert:
		with database_connection_pool.connection() as connection1:
			with database_connection_pool.connection() as connection2:
				self.assertNotEqual(connection1, connection2)

		with database_connection_pool.connection() as connection1:
			pass

		with database_connection_pool.connection() as connection2:
			self.assertEqual(connection1, connection2)

import unittest

import psycopg2
from common.tests.PostgresTestUtils import PostgresTestDatabase

from rest.db.DatabaseConnection import DatabaseConnectionPool, PooledConnection


class RecordingConnection:
	"""Connection identity used to observe the pool lifecycle."""

	def __init__(self, name):
		self.name = name


class RecordingConnectionPool:
	"""Minimal pool that models available versus explicitly discarded connections."""

	def __init__(self, connections=None, putconn_error=None):
		self.available = connections or [RecordingConnection('connection')]
		self.connection = self.available[0]
		self.returned = []
		self.discarded = []
		self.putconn_error = putconn_error

	def getconn(self):
		if not self.available:
			raise RuntimeError('pool exhausted')
		return self.available.pop(0)

	def putconn(self, connection, close=False):
		self.returned.append((connection, close))
		if self.putconn_error:
			error = self.putconn_error
			self.putconn_error = None
			raise error
		if close:
			self.discarded.append(connection)
		else:
			self.available.append(connection)


class TestDatabaseConnectionPool(unittest.TestCase):
	def test_can_acquire_connection(self):
		# Arrange:
		with PostgresTestDatabase() as db_config:
			database_connection_pool = DatabaseConnectionPool(db_config)

			# Act:
			with database_connection_pool.connection() as connection:
				# Assert:
				self.assertIsNotNone(connection)
				self.assertIsInstance(connection, psycopg2.extensions.connection)

	def test_can_release_connection(self):
		# Arrange:
		with PostgresTestDatabase() as db_config:
			database_connection_pool = DatabaseConnectionPool(db_config, min_connections=1, max_connections=2)

			# Act & Assert:
			with database_connection_pool.connection() as connection1:
				with database_connection_pool.connection() as connection2:
					self.assertNotEqual(connection1, connection2)

			with database_connection_pool.connection() as connection1:
				pass

			with database_connection_pool.connection() as connection2:
				self.assertEqual(connection1, connection2)


class PooledConnectionTest(unittest.TestCase):
	def test_normal_exit_returns_connection_without_discard(self):
		# Arrange:
		pool = RecordingConnectionPool()
		pooled_connection = PooledConnection(pool)

		# Act:
		with pooled_connection as connection:
			pass

		# Assert:
		self.assertEqual([(connection, False)], pool.returned)
		self.assertEqual([connection], pool.available)
		self.assertEqual([], pool.discarded)

	def test_operation_failure_preserves_exception_with_default_return(self):
		# Arrange:
		pool = RecordingConnectionPool()
		pooled_connection = PooledConnection(pool)

		# Act:
		with self.assertRaisesRegex(RuntimeError, '^operation failed$'):
			with pooled_connection:
				raise RuntimeError('operation failed')

		# Assert:
		self.assertEqual([(pool.connection, False)], pool.returned)
		self.assertEqual([pool.connection], pool.available)

	def test_normal_return_keeps_primary(self):
		# Arrange:
		pool = RecordingConnectionPool(putconn_error=RuntimeError('putconn cleanup failed'))
		pooled_connection = PooledConnection(pool)

		# Act:
		with self.assertRaisesRegex(ValueError, '^primary operation failed$'):
			with pooled_connection:
				raise ValueError('primary operation failed')

		# Assert:
		self.assertEqual([(pool.connection, False)], pool.returned)
		self.assertEqual([], pool.available)
		self.assertEqual([], pool.discarded)

	def test_normal_return_propagates_cleanup(self):
		# Arrange:
		pool = RecordingConnectionPool(putconn_error=RuntimeError('putconn cleanup failed'))
		pooled_connection = PooledConnection(pool)

		# Act:
		with self.assertRaisesRegex(RuntimeError, '^putconn cleanup failed$'):
			with pooled_connection:
				pass

		# Assert:
		self.assertEqual([(pool.connection, False)], pool.returned)
		self.assertEqual([], pool.available)

	def test_reused_context_resets_discard(self):
		# Arrange:
		connection_a = RecordingConnection('A')
		connection_b = RecordingConnection('B')
		pool = RecordingConnectionPool([connection_a, connection_b])
		pooled_connection = PooledConnection(pool)

		# Act:
		with pooled_connection:
			pooled_connection.mark_for_discard()
		with pooled_connection:
			pass

		# Assert:
		self.assertEqual([(connection_a, True), (connection_b, False)], pool.returned)
		self.assertEqual([connection_b], pool.available)
		self.assertEqual([connection_a], pool.discarded)

	def test_discard_requests_explicit_pool_close_and_removes_connection(self):
		# Arrange:
		pool = RecordingConnectionPool()
		pooled_connection = PooledConnection(pool)

		# Act:
		with pooled_connection:
			pooled_connection.mark_for_discard()

		# Assert:
		self.assertEqual([(pool.connection, True)], pool.returned)
		self.assertEqual([], pool.available)
		self.assertEqual([pool.connection], pool.discarded)
		with self.assertRaisesRegex(RuntimeError, '^pool exhausted$'):
			pool.getconn()

	def test_primary_exception_survives_discard_failure(self):
		# Arrange:
		pool = RecordingConnectionPool(putconn_error=RuntimeError('discard failed'))
		pooled_connection = PooledConnection(pool)

		# Act:
		with self.assertRaisesRegex(RuntimeError, '^operation failed$'):
			with pooled_connection:
				pooled_connection.mark_for_discard()
				raise RuntimeError('operation failed')

		# Assert:
		self.assertEqual([(pool.connection, True)], pool.returned)
		self.assertEqual([], pool.available)
		self.assertEqual([], pool.discarded)

	def test_discard_failure_propagates_without_primary_exception(self):
		# Arrange:
		pool = RecordingConnectionPool(putconn_error=RuntimeError('cleanup failed'))
		pooled_connection = PooledConnection(pool)

		# Act:
		with self.assertRaisesRegex(RuntimeError, '^cleanup failed$'):
			with pooled_connection:
				pooled_connection.mark_for_discard()

		# Assert:
		self.assertEqual([(pool.connection, True)], pool.returned)
		self.assertEqual([], pool.available)

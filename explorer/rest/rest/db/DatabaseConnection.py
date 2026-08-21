from psycopg2 import pool
from zenlog import log


class DatabaseConnectionPool:
	"""Database connection pool class."""

	def __init__(self, db_config, min_connections=1, max_connections=10):
		"""Initialize the database connection pool with given configurations."""

		self.db_config = db_config
		self.min_connections = min_connections
		self.max_connections = max_connections
		self._pool = self._create_pool()

	def _create_pool(self):
		return pool.SimpleConnectionPool(
			self.min_connections,
			self.max_connections,
			database=self.db_config.database,
			user=self.db_config.user,
			password=self.db_config.password,
			host=self.db_config.host,
			port=self.db_config.port
		)

	def connection(self):
		"""Acquires a managed database connection instance from the pool."""

		return PooledConnection(self._pool)


class PooledConnection:
	"""
	Represents a managed database connection from the connection pool.
	Intended for use within a context manager (`with` statement).
	"""

	def __init__(self, connection_pool):
		"""Initialize with a reference to a connection pool."""

		self._pool = connection_pool
		self.connection = None
		self._discard_requested = False

	def __enter__(self):
		"""Acquire a database connection from the pool upon entering the context of a `with` statement."""

		self._discard_requested = False
		self.connection = self._pool.getconn()
		return self.connection

	def mark_for_discard(self):
		"""Marks the acquired connection to be discarded when the context exits."""

		self._discard_requested = True

	def __exit__(self, exc_type, exc_value, traceback):
		"""Ensure the connection is returned to the pool upon exiting the context of a `with` statement."""

		if self.connection:
			try:
				if self._discard_requested:
					self._pool.putconn(self.connection, close=True)
				else:
					self._pool.putconn(self.connection)
			except BaseException as cleanup_error:
				log.error(f'Failed to return database connection: {cleanup_error}')
				if exc_type is None:
					raise
		return False

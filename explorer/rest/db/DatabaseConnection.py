from psycopg2 import pool


class DatabaseConnectionPool:
	"""Database connection pool class."""

	def __init__(self, db_config, min_connections=1, max_connections=10):
		"""
		Initialize the database connection pool with given configurations.

		:param db_config: Dictionary containing connection details.
		:param min_connections: Minimum number of connections in the pool. Default is 1.
		:param max_connections: Maximum number of connections in the pool. Default is 10.
		"""

		self.db_config = db_config
		self.min_connections = min_connections
		self.max_connections = max_connections
		self._pool = self._create_pool()

	def _create_pool(self):
		"""Create a connection pool."""

		return pool.SimpleConnectionPool(
			self.min_connections,
			self.max_connections,
			database=self.db_config['database'],
			user=self.db_config['user'],
			password=self.db_config['password'],
			host=self.db_config['host'],
			port=self.db_config['port']
		)

	def connection(self):
		"""Provides a managed database connection instance from the pool."""

		return PooledConnection(self._pool)


class PooledConnection:
	"""
	Represents a managed database connection from the connection pool.
	Intended for use within a context manager (`with` statement).
	"""

	def __init__(self, _pool):
		"""
		Initialize with a reference to a connection pool.

		:param _pool: Reference to the DatabaseConnectionPool from which this connection is derived.
		"""

		self._pool = _pool
		self.connection = None

	def __enter__(self):
		"""Acquire a database connection from the pool upon entering the context of a `with` statement."""

		self.connection = self._pool.getconn()
		return self.connection

	def __exit__(self, exc_type, exc_value, traceback):
		"""Ensure the connection is returned to the pool upon exiting the context of a `with` statement."""

		if self.connection:
			self._pool.putconn(self.connection)

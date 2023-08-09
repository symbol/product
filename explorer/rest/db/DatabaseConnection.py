from psycopg2 import pool


class DatabaseConnectionPool:
	"""Database connection pool class."""

	def __init__(self, db_config, min_connections=1, max_connections=10):
		"""Initialize database connection parameters."""
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
		"""Provide a managed connection."""
		return PooledConnection(self._pool)


class PooledConnection:
	"""Managed database connection from the connection pool."""

	def __init__(self, _pool):
		self._pool = _pool
		self.connection = None

	def __enter__(self):
		"""Acquire a connection from the pool."""
		self.connection = self._pool.getconn()
		return self.connection

	def __exit__(self, exc_type, exc_value, traceback):
		"""Return the connection to the pool."""
		if self.connection:
			self._pool.putconn(self.connection)

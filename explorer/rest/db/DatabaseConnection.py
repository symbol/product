from psycopg2 import pool


class DatabaseConnectionPool:
	"""Database connection pool class."""

	def __init__(self, db_config, min_connections=1, max_connections=10):
		"""
		Initialize the database connection pool with given configurations.

		Parameters:
		----------
		db_config : dict
			Dictionary containing connection details.
		min_connections : int, optional
			Minimum number of connections in the pool. Default is 1.
		max_connections : int, optional
			Maximum number of connections in the pool. Default is 10.
		"""

		self.db_config = db_config
		self.min_connections = min_connections
		self.max_connections = max_connections
		self._pool = self._create_pool()

	def _create_pool(self):
		"""
		Create a connection pool.

		Returns:
		-------
		SimpleConnectionPool
			A connection pool instance.
		"""

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
		"""
		Provides a managed database connection instance from the pool.

		Returns:
		-------
		PooledConnection
			A managed database connection instance.
		"""

		return PooledConnection(self._pool)


class PooledConnection:
	"""
	Represents a managed database connection from the connection pool.
	Intended for use within a context manager (`with` statement).

	Attributes:
	----------
	_pool : object
		Reference to the DatabaseConnectionPool from which this connection is derived.
	connection : object
		The actual active database connection. Initially set to None.
	"""

	def __init__(self, _pool):
		"""
		Initialize with a reference to a connection pool.

		Parameters:
		----------
		_pool : object
			Reference to the DatabaseConnectionPool instance.
		"""

		self._pool = _pool
		self.connection = None

	def __enter__(self):
		"""
		Acquire a database connection from the pool upon entering the context of a `with` statement.

		Returns:
		-------
		connection : object
			An active database connection from the pool.
		"""

		self.connection = self._pool.getconn()
		return self.connection

	def __exit__(self, exc_type, exc_value, traceback):
		"""
		Ensure the connection is returned to the pool upon exiting the context of a `with` statement.
		"""

		if self.connection:
			self._pool.putconn(self.connection)

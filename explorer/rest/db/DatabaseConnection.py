from psycopg2 import pool


class DatabaseConnection:
	def __init__(self, db_config, min_connections=1, max_connections=10):
		self.db_config = db_config
		self.min_connections = min_connections
		self.max_connections = max_connections
		self.pool = None
		self.connection = None

	def connect(self):
		"""Create connection pool."""

		self.pool = pool.SimpleConnectionPool(
			self.min_connections,
			self.max_connections,
			database=self.db_config['database'],
			user=self.db_config['user'],
			password=self.db_config['password'],
			host=self.db_config['host'],
			port=self.db_config['port']
		)

	def __enter__(self):
		"""Connects to databases."""

		self.connect()
		self.connection = self.pool.getconn()

		return self

	def __exit__(self, exc_type, exc_value, traceback):
		"""Disconnects from databases."""

		self.pool.putconn(self.connection)
		self.connection = None

import psycopg2
from zenlog import log


class DatabaseConnection:
	def __init__(self, db_config, timeout_seconds=10):
		self.db_config = db_config
		self.connection = None
		self.timeout_seconds = timeout_seconds

	def __enter__(self):
		"""Connects to databases."""

		try:
			self.connection = psycopg2.connect(
				database=self.db_config['database'],
				user=self.db_config['user'],
				password=self.db_config['password'],
				host=self.db_config['host'],
				port=self.db_config['port']
			)

			return self
		except Exception as error:
			log.error(f'Failed to connect to database: {error}')
			raise error

	def __exit__(self, exc_type, exc_value, traceback):
		"""Disconnects from databases."""

		if self.connection is not None:
			self.connection.close()

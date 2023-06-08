import psycopg2


class DatabaseConnection:
	def __init__(self, db_config):
		self.db_config = db_config
		self.connection = None

	def __enter__(self):
		"""Connects to databases."""

		self.connection = psycopg2.connect(
			database=self.db_config['database'],
			user=self.db_config['user'],
			password=self.db_config['password'],
			host=self.db_config['host'],
			port=self.db_config['port']
		)

		return self

	def __exit__(self, exc_type, exc_value, traceback):
		"""Disconnects from databases."""

		self.connection.close()

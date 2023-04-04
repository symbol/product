import psycopg2


class DatabaseConnection:
	def __init__(self, db_config):
		self.connection = psycopg2.connect(
			database=db_config['database'],
			user=db_config['user'],
			password=db_config['password'],
			host=db_config['host'],
			port=db_config['port']
		)

	def __enter__(self):
		"""Connects to databases."""

		return self

	def __exit__(self, exc_type, exc_value, traceback):
		"""Disconnects from databases."""

		self.connection.close()

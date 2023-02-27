import psycopg2

from .NemDatabase import NemDatabase

class Databases:
	"""Container of all databases."""

	def __init__(self):
		"""Creates a databases object."""

		self._nem_db_connection = None
		self.nem = None

	def __enter__(self):
		"""Connects to databases."""

		self._nem_db_connection = psycopg2.connect(
			database="nem_db",
			user='user',
			password='admin',
			host='localhost',
			port= '54320'
		)

		self.nem = NemDatabase(self._nem_db_connection)
		return self

	def __exit__(self, exc_type, exc_value, traceback):
		"""Disconnects from databases."""

		self._nem_db_connection.close()

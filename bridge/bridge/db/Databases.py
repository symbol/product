import sqlite3
from pathlib import Path

from .WrapRequestDatabase import WrapRequestDatabase


class Databases:
	"""Container of all databases."""

	def __init__(self, database_directory, network_facade):
		"""Creates a databases object."""

		self.database_directory = Path(database_directory)
		self.network_facade = network_facade

		self._wrap_request_connection = None

		self.wrap_request = None

	def __enter__(self):
		"""Connects to databases."""

		self._wrap_request_connection = sqlite3.connect(self.database_directory / 'wrap_request.db')

		self.wrap_request = WrapRequestDatabase(self._wrap_request_connection, self.network_facade)
		return self

	def __exit__(self, exc_type, exc_value, traceback):
		"""Disconnects from databases."""

		self._wrap_request_connection.close()

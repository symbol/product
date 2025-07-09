import sqlite3
from pathlib import Path

from .BalanceChangeDatabase import BalanceChangeDatabase
from .WrapRequestDatabase import WrapRequestDatabase


class Databases:
	"""Container of all databases."""

	def __init__(self, database_directory, network_facade):
		"""Creates a databases object."""

		self.database_directory = Path(database_directory)
		self.network_facade = network_facade

		self._balance_change_connection = None
		self._wrap_request_connection = None

		self.balance_change = None
		self.wrap_request = None

	def __enter__(self):
		"""Connects to databases."""

		self._balance_change_connection = sqlite3.connect(self.database_directory / 'balance_change.db')
		self._wrap_request_connection = sqlite3.connect(self.database_directory / 'wrap_request.db')

		self.balance_change = BalanceChangeDatabase(self._balance_change_connection)
		self.wrap_request = WrapRequestDatabase(self._wrap_request_connection, self.network_facade)
		return self

	def __exit__(self, exc_type, exc_value, traceback):
		"""Disconnects from databases."""

		self._balance_change_connection.close()
		self._wrap_request_connection.close()

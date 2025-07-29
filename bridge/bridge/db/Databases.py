import sqlite3
from pathlib import Path

from .BalanceChangeDatabase import BalanceChangeDatabase
from .WrapRequestDatabase import WrapRequestDatabase


class Databases:  # pylint: disable=too-many-instance-attributes
	"""Container of all databases."""

	def __init__(self, database_directory, native_network, wrapped_network):
		"""Creates a databases object."""

		self._database_directory = Path(database_directory)
		self._native_network = native_network
		self._wrapped_network = wrapped_network

		self._balance_change_connection = None
		self._unwrap_request_connection = None
		self._wrap_request_connection = None

		self.balance_change = None
		self.unwrap_request = None
		self.wrap_request = None

	def __enter__(self):
		"""Connects to databases."""

		self._balance_change_connection = sqlite3.connect(self._database_directory / 'balance_change.db')
		self._unwrap_request_connection = sqlite3.connect(self._database_directory / 'unwrap_request.db')
		self._wrap_request_connection = sqlite3.connect(self._database_directory / 'wrap_request.db')

		self.balance_change = BalanceChangeDatabase(self._balance_change_connection)
		self.unwrap_request = WrapRequestDatabase(self._unwrap_request_connection, self._wrapped_network)
		self.wrap_request = WrapRequestDatabase(self._wrap_request_connection, self._native_network)
		return self

	def __exit__(self, exc_type, exc_value, traceback):
		"""Disconnects from databases."""

		self._balance_change_connection.close()
		self._unwrap_request_connection.close()
		self._wrap_request_connection.close()

	def create_tables(self):
		"""Creates all tables."""

		self.balance_change.create_tables()
		self.unwrap_request.create_tables()
		self.wrap_request.create_tables()

import sqlite3
from pathlib import Path

from .BalanceChangeDatabase import BalanceChangeDatabase
from .WrapRequestDatabase import WrapRequestDatabase


class Databases:  # pylint: disable=too-many-instance-attributes
	"""Container of all databases."""

	def __init__(self, database_directory, native_network, wrapped_network, is_read_only=False):
		"""Creates a databases object."""

		self._database_directory = Path(database_directory)
		self._native_network = native_network
		self._wrapped_network = wrapped_network
		self._is_read_only = is_read_only

		self._balance_change_connection = None
		self._unwrap_request_connection = None
		self._wrap_request_connection = None

		self.balance_change = None
		self.unwrap_request = None
		self.wrap_request = None

	def _connect(self, database_name):
		connection_string = f'file:{self._database_directory / database_name}.db{"?mode=ro" if self._is_read_only else ""}'
		return sqlite3.connect(connection_string, uri=True)

	def __enter__(self):
		"""Connects to databases."""

		self._balance_change_connection = self._connect('balance_change')
		self._unwrap_request_connection = self._connect('unwrap_request')
		self._wrap_request_connection = self._connect('wrap_request')

		self._balance_change_connection.execute('PRAGMA foreign_keys = ON')
		self._unwrap_request_connection.execute('PRAGMA foreign_keys = ON')
		self._wrap_request_connection.execute('PRAGMA foreign_keys = ON')

		self.balance_change = BalanceChangeDatabase(self._balance_change_connection)
		self.unwrap_request = WrapRequestDatabase(self._unwrap_request_connection, self._wrapped_network, self._native_network)
		self.wrap_request = WrapRequestDatabase(self._wrap_request_connection, self._native_network, self._wrapped_network)
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

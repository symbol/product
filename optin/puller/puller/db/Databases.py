import sqlite3
from pathlib import Path

from .BalancesDatabase import BalancesDatabase
from .CompletedOptinDatabase import CompletedOptinDatabase
from .InProgressOptinDatabase import InProgressOptinDatabase
from .MultisigDatabase import MultisigDatabase


class Databases:
	"""Container of all databases."""

	# pylint: disable=too-many-instance-attributes

	def __init__(self, database_directory):
		"""Creates a databases object."""

		self.database_directory = Path(database_directory)

		self._completed_connection = None
		self._inprogress_connection = None
		self._multisig_connection = None
		self._balances_connection = None

		self.completed = None
		self.inprogress = None
		self.multisig = None
		self.balances = None

	def __enter__(self):
		"""Connects to databases."""

		self._completed_connection = sqlite3.connect(self.database_directory / 'completed.db')
		self._inprogress_connection = sqlite3.connect(self.database_directory / 'inprogress.db')
		self._multisig_connection = sqlite3.connect(self.database_directory / 'multisig.db')
		self._balances_connection = sqlite3.connect(self.database_directory / 'balances.db')

		self.completed = CompletedOptinDatabase(self._completed_connection)
		self.inprogress = InProgressOptinDatabase(self._inprogress_connection)
		self.multisig = MultisigDatabase(self._multisig_connection)
		self.balances = BalancesDatabase(self._balances_connection)
		return self

	def __exit__(self, exc_type, exc_value, traceback):
		"""Disconnects from databases."""

		self._completed_connection.close()
		self._inprogress_connection.close()
		self._multisig_connection.close()
		self._balances_connection.close()

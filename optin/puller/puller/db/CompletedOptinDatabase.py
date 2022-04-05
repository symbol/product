import sqlite3
from functools import reduce

from symbolchain.CryptoTypes import Hash256
from symbolchain.nem.Network import Address as NemAddress
from symbolchain.symbol.Network import Address as SymbolAddress


class CompletedOptinDatabase:
	"""Database containing completed optin information."""

	def __init__(self, connection):
		"""Creates a database around a database connection."""

		self.connection = connection

	def create_tables(self):
		"""Creates optin database tables."""

		cursor = self.connection.cursor()
		cursor.execute('''CREATE TABLE IF NOT EXISTS optin_id (
			id integer PRIMARY KEY
		)''')
		cursor.execute('''CREATE TABLE IF NOT EXISTS nem_source (
			address blob UNIQUE,
			balance integer,
			optin_id integer,
			FOREIGN KEY (optin_id) REFERENCES optin_id(id)
		)''')
		cursor.execute('''CREATE TABLE IF NOT EXISTS nem_hashes (
			address blob,
			nem_tx_hash blob
		)''')
		cursor.execute('''CREATE TABLE IF NOT EXISTS symbol_destination (
			address blob,
			balance integer,
			optin_id integer,
			FOREIGN KEY (optin_id) REFERENCES optin_id(id)
		)''')  # address cannot be unique because merges are supported

	@staticmethod
	def _assert_balances(nem_address_dict, symbol_address_dict):
		nem_balance = reduce(lambda x, y: x + y, nem_address_dict.values())
		symbol_balance = reduce(lambda x, y: x + y, symbol_address_dict.values())

		if nem_balance != symbol_balance:
			raise ValueError(f'NEM source balance {nem_balance} does not match Symbol destination balance {symbol_balance}')

	@staticmethod
	def _insert_mapping(cursor, nem_address_dict, symbol_address_dict, nem_hashes_dict=None):
		cursor.execute('''INSERT INTO optin_id VALUES (NULL)''')
		optin_id = cursor.lastrowid

		cursor.executemany(
			'''INSERT INTO nem_source VALUES (?, ?, ?)''',
			[(NemAddress(address).bytes, balance, optin_id) for address, balance in nem_address_dict.items()])

		if nem_hashes_dict:
			items = []
			for address, hashes in nem_hashes_dict.items():
				for nem_transaction_hash in hashes:
					items.append((NemAddress(address).bytes, Hash256(nem_transaction_hash).bytes))

			cursor.executemany('''INSERT INTO nem_hashes VALUES (?, ?)''', items)

		cursor.executemany(
			'''INSERT INTO symbol_destination VALUES (?, ?, ?)''',
			[(SymbolAddress(address).bytes, balance, optin_id) for address, balance in symbol_address_dict.items()])

	def insert_mapping(self, nem_address_dict, symbol_address_dict):
		"""Adds a NEM to Symbol mapping to the database."""

		self._assert_balances(nem_address_dict, symbol_address_dict)
		cursor = self.connection.cursor()
		try:
			self._insert_mapping(cursor, nem_address_dict, symbol_address_dict)
			self.connection.commit()
		except sqlite3.IntegrityError:
			self.connection.rollback()
			raise

	def insert_mappings_from_json(self, mappings_json):
		"""Adds NEM to Symbol mappings represented as a JSON object to the database."""

		cursor = self.connection.cursor()
		try:
			for mapping_json in mappings_json:
				if 'source' not in mapping_json:
					continue

				nem_address_dict = {
					source_json['nis-address']: int(source_json['nis-balance']) for source_json in mapping_json['source']
				}
				symbol_address_dict = {
					destination_json['sym-address']: destination_json['sym-balance'] for destination_json in mapping_json['destination']
				}
				nem_hashes_dict = {
					source_json['nis-address']: source_json.get('hashes', []) for source_json in mapping_json['source']
				}

				self._assert_balances(nem_address_dict, symbol_address_dict)
				self._insert_mapping(cursor, nem_address_dict, symbol_address_dict, nem_hashes_dict)

				yield mapping_json

			self.connection.commit()
		except sqlite3.IntegrityError:
			self.connection.rollback()
			raise

	def is_opted_in(self, address):
		"""Returns True if specified address has already opted-in."""

		cursor = self.connection.cursor()
		cursor.execute('''SELECT * FROM nem_source WHERE address = ?''', (address.bytes,))
		return bool(cursor.fetchone())

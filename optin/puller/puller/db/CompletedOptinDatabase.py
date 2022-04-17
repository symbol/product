import sqlite3
from functools import reduce

from symbolchain.CryptoTypes import Hash256
from symbolchain.nem.Network import Address as NemAddress
from symbolchain.symbol.Network import Address as SymbolAddress

from .NemBlockTimestampsMixin import NemBlockTimestampsMixin


class CompletedOptinDatabase(NemBlockTimestampsMixin):
	"""Database containing completed optin information."""

	def create_tables(self):
		"""Creates optin database tables."""

		super().create_tables()

		cursor = self.connection.cursor()
		cursor.execute('''CREATE TABLE IF NOT EXISTS optin_id (
			id integer PRIMARY KEY,
			is_postoptin boolean
		)''')
		cursor.execute('''CREATE TABLE IF NOT EXISTS nem_source (
			address blob UNIQUE,
			balance integer,
			optin_id integer,
			FOREIGN KEY (optin_id) REFERENCES optin_id(id)
		)''')
		cursor.execute('''CREATE TABLE IF NOT EXISTS nem_label (
			address blob UNIQUE,
			label text
		)''')
		cursor.execute('''CREATE TABLE IF NOT EXISTS nem_transaction (
			address blob,
			hash blob,
			height integer
		)''')
		cursor.execute('''CREATE TABLE IF NOT EXISTS symbol_destination (
			address blob,
			balance integer,
			hash blob,
			height integer,
			timestamp integer,
			optin_id integer,
			FOREIGN KEY (optin_id) REFERENCES optin_id(id)
		)''')  # address cannot be unique because merges are supported

	@staticmethod
	def _assert_balances(nem_address_dict, symbol_address_dict):
		nem_balance = reduce(lambda x, y: x + y, nem_address_dict.values())
		symbol_balance = reduce(lambda x, y: x + y, map(lambda info: info['sym-balance'], symbol_address_dict.values()))

		if nem_balance != symbol_balance:
			raise ValueError(f'NEM source balance {nem_balance} does not match Symbol destination balance {symbol_balance}')

	@staticmethod
	def _insert_transactions(cursor, nem_transaction_dict):
		if not nem_transaction_dict:
			return

		items = []
		for address, transactions in nem_transaction_dict.items():
			for transaction in transactions:
				items.append((NemAddress(address).bytes, Hash256(transaction['hash']).bytes, transaction['height']))

		cursor.executemany('''INSERT INTO nem_transaction VALUES (?, ?, ?)''', items)

	def insert_transaction(self, address, nem_transaction):
		"""Adds nem transaction to the database."""

		cursor = self.connection.cursor()
		try:
			self._insert_transactions(cursor, {address: [nem_transaction]})
			self.connection.commit()
		except sqlite3.IntegrityError:
			self.connection.rollback()
			raise

	@staticmethod
	def _insert_labels(cursor, mapping_json):
		if 'label' not in mapping_json:
			return

		cursor.executemany('''INSERT INTO nem_label VALUES (?, ?)''', [
			(NemAddress(source_json['nis-address']).bytes, mapping_json['label']) for source_json in mapping_json['source']
		])

	def _insert_mapping(self, cursor, nem_address_dict, symbol_address_dict, is_postoptin=True):
		cursor.execute('''INSERT INTO optin_id VALUES (NULL, ?)''', (is_postoptin,))
		optin_id = cursor.lastrowid

		cursor.executemany('''INSERT INTO nem_source VALUES (?, ?, ?)''', [
			(NemAddress(address).bytes, balance, optin_id) for address, balance in nem_address_dict.items()
		])

		cursor.executemany('''INSERT INTO symbol_destination VALUES (?, ?, ?, ?, ?, ?)''', [
			(
				SymbolAddress(address).bytes,
				entry['sym-balance'],
				Hash256(entry['hash']).bytes if 'hash' in entry else None,
				entry.get('height', 1),
				self.time_converter.symbol_to_unix(int(entry.get('timestamp', 0))),
				optin_id
			) for address, entry in symbol_address_dict.items()
		])

	def insert_mapping(self, nem_address_dict, symbol_address_dict, nem_transactions_dict=None):
		"""Adds a NEM to Symbol mapping to the database."""

		self._assert_balances(nem_address_dict, symbol_address_dict)
		cursor = self.connection.cursor()
		try:
			self._insert_mapping(cursor, nem_address_dict, symbol_address_dict)
			if nem_transactions_dict:
				self._insert_transactions(cursor, nem_transactions_dict)
			self.connection.commit()
		except sqlite3.IntegrityError:
			self.connection.rollback()
			raise

	def insert_mappings_from_json(self, mappings_json, is_postoptin):
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
					destination_json['sym-address']: destination_json for destination_json in mapping_json['destination']
				}

				self._assert_balances(nem_address_dict, symbol_address_dict)
				self._insert_mapping(cursor, nem_address_dict, symbol_address_dict, is_postoptin)

				nem_transaction_dict = {
					source_json['nis-address']: source_json.get('transactions', []) for source_json in mapping_json['source']
				}
				self._insert_transactions(cursor, nem_transaction_dict)

				self._insert_labels(cursor, mapping_json)

				yield mapping_json

			self.connection.commit()
		except sqlite3.IntegrityError:
			self.connection.rollback()
			raise

	def set_label(self, address, label):
		"""Sets an account label."""

		cursor = self.connection.cursor()
		cursor.execute('''
			INSERT INTO nem_label VALUES (?, ?)
			ON CONFLICT(address)
			DO UPDATE SET label=?
		''', (address.bytes, label, label))
		self.connection.commit()

	def is_opted_in(self, address):
		"""Returns True if specified address has already opted-in."""

		cursor = self.connection.cursor()
		cursor.execute('''SELECT * FROM nem_source WHERE address = ?''', (address.bytes,))
		return bool(cursor.fetchone())

	def optin_transaction_heights(self):
		"""Gets list of optin transaction heights."""

		cursor = self.connection.cursor()
		heights = [row[0] for row in cursor.execute('''SELECT height FROM nem_transaction''')]
		return set(heights)

import sqlite3
from functools import reduce

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
		cursor.execute('''CREATE TABLE IF NOT EXISTS symbol_destination (
			address blob,
			balance integer,
			optin_id integer,
			FOREIGN KEY (optin_id) REFERENCES optin_id(id)
		)''')  # address cannot be unique because merges are supported

	def insert_mapping(self, nem_address_dict, symbol_address_dict):
		"""Adds a NEM to Symbol mapping to the database."""

		nem_balance = reduce(lambda x, y: x + y, nem_address_dict.values())
		symbol_balance = reduce(lambda x, y: x + y, symbol_address_dict.values())

		ngl_source = [
			'NATRUSTUAB5LAWDSOWDUPQUFYRTGZTJZDGML2JKP',
			'NANODESTSN7GU76QPLGMJ7BCGCAA2PHVBZZUUI62',
			'NBKXLNQ2GKTLQBTXNFOHULNJDA7T2Q57CZGQ2TFP'
		]
		if nem_balance != symbol_balance and set(ngl_source) != set(nem_address_dict.keys()):
			raise ValueError(f'NEM source balance {nem_balance} does not match Symbol destination balance {symbol_balance}')

		cursor = self.connection.cursor()
		try:
			cursor.execute('''INSERT INTO optin_id VALUES (NULL)''')
			optin_id = cursor.lastrowid
			cursor.executemany(
				'''INSERT INTO nem_source VALUES (?, ?, ?)''',
				[(NemAddress(address).bytes, balance, optin_id) for address, balance in nem_address_dict.items()])
			cursor.executemany(
				'''INSERT INTO symbol_destination VALUES (?, ?, ?)''',
				[(SymbolAddress(address).bytes, balance, optin_id) for address, balance in symbol_address_dict.items()])
			self.connection.commit()
		except sqlite3.IntegrityError:
			self.connection.rollback()
			raise

	def insert_mappings_from_json(self, mappings_json):
		"""Adds NEM to Symbol mappings represented as a JSON object to the database."""

		for mapping_json in mappings_json:
			if 'source' not in mapping_json:
				continue

			self.insert_mapping({
				source_json['nis-address']: int(source_json['nis-balance']) for source_json in mapping_json['source']
			}, {
				destination_json['sym-address']: destination_json['sym-balance'] for destination_json in mapping_json['destination']
			})

			yield mapping_json

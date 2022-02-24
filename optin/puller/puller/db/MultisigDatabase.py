import sqlite3

from symbolchain.nem.Network import Address


class MultisigDatabase:
	"""Database containing NEM multisig information."""

	def __init__(self, connection):
		"""Creates a database around a database connection."""

		self.connection = connection

	def create_tables(self):
		"""Creates multisig database tables."""

		cursor = self.connection.cursor()
		cursor.execute('''CREATE TABLE IF NOT EXISTS nem_multisig_id (
			id integer PRIMARY KEY,
			count integer,
			min integer
		)''')
		cursor.execute('''CREATE TABLE IF NOT EXISTS nem_multisig_cosignatory (
			address blob,
			multisig_id integer,
			FOREIGN KEY (multisig_id) REFERENCES nem_multisig_id(id)
		)''')

	def insert_if_multisig(self, account_and_meta):
		"""Adds multisig account information for an account if and only if it is multisig."""

		multisig_info = account_and_meta['account']['multisigInfo']
		cosignatories = account_and_meta['meta']['cosignatories']

		if not cosignatories:
			return

		cursor = self.connection.cursor()
		try:
			cursor.execute(
				'''INSERT INTO nem_multisig_id VALUES (NULL, ?, ?)''',
				(multisig_info['cosignaturesCount'], multisig_info['minCosignatures']))
			multisig_id = cursor.lastrowid
			cursor.executemany(
				'''INSERT INTO nem_multisig_cosignatory VALUES (?, ?)''',
				[(Address(cosignatory).bytes, multisig_id) for cosignatory in cosignatories])
			self.connection.commit()
		except sqlite3.IntegrityError:
			self.connection.rollback()
			raise

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
			address blob UNIQUE,
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

		cosignatories = account_and_meta['meta']['cosignatories']
		if not cosignatories:
			return

		multisig_address = Address(account_and_meta['account']['address'])
		multisig_info = account_and_meta['account']['multisigInfo']

		cursor = self.connection.cursor()
		try:
			cursor.execute(
				'''INSERT INTO nem_multisig_id VALUES (NULL, ?, ?, ?)''',
				(multisig_address.bytes, multisig_info['cosignatoriesCount'], multisig_info['minCosignatories']))
			multisig_id = cursor.lastrowid
			cursor.executemany(
				'''INSERT INTO nem_multisig_cosignatory VALUES (?, ?)''',
				[(Address(cosignatory).bytes, multisig_id) for cosignatory in cosignatories])
			self.connection.commit()
		except sqlite3.IntegrityError:
			self.connection.rollback()
			raise

	def check_cosigners(self, address, cosigner_addresses):
		"""Checks if specified cosigners are sufficient for approving transactions from account."""

		cursor = self.connection.cursor()
		cursor.execute('''SELECT id, min FROM nem_multisig_id WHERE address = ?''', (address.bytes,))
		multisig_info = cursor.fetchone()

		if not multisig_info:
			return True

		cursor.execute('SELECT address FROM nem_multisig_cosignatory WHERE multisig_id = ?', (multisig_info[0],))
		actual_cosigner_addresses = cursor.fetchall()

		valid_count = 0
		for actual_cosigner_address in actual_cosigner_addresses:
			if Address(actual_cosigner_address[0]) in cosigner_addresses:
				valid_count += 1

		return valid_count >= multisig_info[1]

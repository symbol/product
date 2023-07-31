from binascii import unhexlify

from symbolchain.nem.Network import Address

from db.DatabaseConnection import DatabaseConnection


class NemDatabase(DatabaseConnection):
	"""Database containing Nem blockchain data."""

	def create_tables(self):
		"""Creates blocks database tables."""

		cursor = self.connection.cursor()
		cursor.execute(
			'''
			CREATE TABLE IF NOT EXISTS blocks (
				height bigint NOT NULL PRIMARY KEY,
				timestamp timestamp NOT NULL,
				totalFees bigint DEFAULT 0,
				totalTransactions int DEFAULT 0,
				difficulty bigInt NOT NULL,
				hash bytea NOT NULL,
				signer bytea NOT NULL,
				signature bytea NOT NULL
			)
			'''
		)

		# Create transactions table
		cursor.execute(
			'''
			CREATE TABLE IF NOT EXISTS transactions (
				id serial PRIMARY KEY,
				transaction_hash bytea NOT NULL,
				height bigint NOT NULL,
				sender bytea NOT NULL,
				fee bigint DEFAULT 0,
				timestamp timestamp NOT NULL,
				deadline timestamp NOT NULL,
				signature bytea NOT NULL,
				transaction_type int NOT NULL
			)
			'''
		)

		# Create transfer transactions table
		cursor.execute(
			'''
			CREATE TABLE IF NOT EXISTS transfer_transactions (
				id serial PRIMARY KEY,
				transaction_id serial NOT NULL,
				amount bigint NOT NULL,
				mosaics json,
				recipient bytea NOT NULL,
				message json,
				is_apostille boolean DEFAULT false,
				FOREIGN KEY (transaction_id) REFERENCES transactions(id)
				ON DELETE CASCADE
			)
			'''
		)

		# Create account key link transactions table
		cursor.execute(
			'''
			CREATE TABLE IF NOT EXISTS account_key_link_transactions (
				id serial PRIMARY KEY,
				transaction_id serial NOT NULL,
				mode int NOT NULL,
				remote_account bytea NOT NULL,
				FOREIGN KEY (transaction_id) REFERENCES transactions(id)
				ON DELETE CASCADE
			)
			'''
		)

		# Create mutlisig account modification transactions table
		cursor.execute(
			'''
			CREATE TABLE IF NOT EXISTS multisig_account_modification_transactions (
				id serial PRIMARY KEY,
				transaction_id serial NOT NULL,
				min_cosignatories int NOT NULL,
				modifications json,
				FOREIGN KEY (transaction_id) REFERENCES transactions(id)
				ON DELETE CASCADE
			)
			'''
		)

		self.connection.commit()

	def insert_block(self, cursor, block):  # pylint: disable=no-self-use
		"""Adds block height into table."""

		cursor.execute(
			'''
			INSERT INTO blocks
			VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
			''', (
				block.height,
				block.timestamp,
				block.total_fees,
				block.total_transactions,
				block.difficulty,
				unhexlify(block.block_hash),
				unhexlify(block.signer),
				unhexlify(block.signature)
			)
		)

	def insert_transaction(self, cursor, transaction):
		"""Adds transactions into transactions table"""

		cursor.execute(
			'''
			INSERT INTO transactions (transaction_hash, height, sender, fee, timestamp, deadline, signature, transaction_type)
			VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
			RETURNING id
			''',
			(
				unhexlify(transaction.transaction_hash),
				transaction.height,
				unhexlify(transaction.sender),
				transaction.fee,
				transaction.timestamp,
				transaction.deadline,
				unhexlify(transaction.signature),
				transaction.transaction_type
			)
		)

		return cursor.fetchone()[0]

	def insert_transfer_transactions(self, cursor, transaction_id, transfer_transactions):
		"""Adds transfer into transfer_transactions table"""

		cursor.execute(
			'''
			INSERT INTO transfer_transactions (transaction_id, amount, mosaics, recipient, message, is_apostille)
			VALUES (%s, %s, %s, %s, %s, %s)
			''',
			(
				transaction_id,
				transfer_transactions.amount,
				transfer_transactions.mosaics,
				Address(transfer_transactions.recipient).bytes,
				transfer_transactions.message,
				transfer_transactions.is_apostille
			)
		)

	def insert_account_key_link_transactions(self, cursor, transaction_id, account_key_link_transactions):
		"""Adds account key link into account_key_link_transactions table"""

		cursor.execute(
			'''
			INSERT INTO account_key_link_transactions (transaction_id, mode, remote_account)
			VALUES (%s, %s, %s)
			''',
			(
				transaction_id,
				account_key_link_transactions.mode,
				unhexlify(account_key_link_transactions.remote_account),
			)
		)

	def insert_multisig_account_modification_transactions(self, cursor, transaction_id, multisig_account_modification_transactions):
		"""Adds multisig account modification into multisig_account_modification_transactions table"""

		cursor.execute(
			'''
			INSERT INTO multisig_account_modification_transactions (transaction_id, min_cosignatories, modifications)
			VALUES (%s, %s, %s)
			''',
			(
				transaction_id,
				multisig_account_modification_transactions.min_cosignatories,
				multisig_account_modification_transactions.modifications,
			)
		)

	def get_current_height(self):
		"""Gets current height from database"""

		cursor = self.connection.cursor()
		cursor.execute(
			'''
			SELECT MAX(height)
			FROM blocks
			'''
		)
		results = cursor.fetchone()
		return 0 if results[0] is None else results[0]

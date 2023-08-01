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

		# Create transactions transfer table
		cursor.execute(
			'''
			CREATE TABLE IF NOT EXISTS transactions_transfer (
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

		# Create transactions account key link table
		cursor.execute(
			'''
			CREATE TABLE IF NOT EXISTS transactions_account_key_link (
				id serial PRIMARY KEY,
				transaction_id serial NOT NULL,
				mode int NOT NULL,
				remote_account bytea NOT NULL,
				FOREIGN KEY (transaction_id) REFERENCES transactions(id)
				ON DELETE CASCADE
			)
			'''
		)

		# Create transactions mutlisig account modification table
		cursor.execute(
			'''
			CREATE TABLE IF NOT EXISTS transactions_multisig_account_modification (
				id serial PRIMARY KEY,
				transaction_id serial NOT NULL,
				min_cosignatories int NOT NULL,
				modifications json,
				FOREIGN KEY (transaction_id) REFERENCES transactions(id)
				ON DELETE CASCADE
			)
			'''
		)

		# Create transactions mutlisig table
		cursor.execute(
			'''
			CREATE TABLE IF NOT EXISTS transactions_multisig (
				id serial PRIMARY KEY,
				transaction_id serial NOT NULL,
				signatures json NOT NULL,
				other_transaction json NOT NULL,
				inner_hash bytea NOT NULL,
				FOREIGN KEY (transaction_id) REFERENCES transactions(id)
				ON DELETE CASCADE
			)
			'''
		)

		# Create transactions namespace registration table
		cursor.execute(
			'''
			CREATE TABLE IF NOT EXISTS transactions_namespace_registration (
				id serial PRIMARY KEY,
				transaction_id serial NOT NULL,
				rental_fee_sink bytea NOT NULL,
				rental_fee bigint DEFAULT 0,
				parent varchar(16),
				namespace varchar(64),
				FOREIGN KEY (transaction_id) REFERENCES transactions(id)
				ON DELETE CASCADE
			)
			'''
		)

		# Create transactions mosaic definition creation table
		cursor.execute(
			'''
			CREATE TABLE IF NOT EXISTS transactions_mosaic_definition_creation (
				id serial PRIMARY KEY,
				transaction_id serial NOT NULL,
				creation_fee_sink bytea NOT NULL,
				creation_fee bigint DEFAULT 0,
				creator bytea NOT NULL,
				description varchar(512),
				namespace_name varchar(146),
				properties json NOT NULL,
				levy json,
				FOREIGN KEY (transaction_id) REFERENCES transactions(id)
				ON DELETE CASCADE
			)
			'''
		)

		# Create transactions mosaic supply change table
		cursor.execute(
			'''
			CREATE TABLE IF NOT EXISTS transactions_mosaic_supply_change (
				id serial PRIMARY KEY,
				transaction_id serial NOT NULL,
				supply_type int NOT NULL,
				delta bigint DEFAULT 0,
				namespace_name varchar(146),
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

	def insert_transactions_transfer(self, cursor, transaction_id, transactions_transfer):
		"""Adds transfer into transactions_transfer table"""

		cursor.execute(
			'''
			INSERT INTO transactions_transfer (transaction_id, amount, mosaics, recipient, message, is_apostille)
			VALUES (%s, %s, %s, %s, %s, %s)
			''',
			(
				transaction_id,
				transactions_transfer.amount,
				transactions_transfer.mosaics,
				Address(transactions_transfer.recipient).bytes,
				transactions_transfer.message,
				transactions_transfer.is_apostille
			)
		)

	def insert_transactions_account_key_link(self, cursor, transaction_id, transactions_account_key_link):
		"""Adds account key link into transactions_account_key_link table"""

		cursor.execute(
			'''
			INSERT INTO transactions_account_key_link (transaction_id, mode, remote_account)
			VALUES (%s, %s, %s)
			''',
			(
				transaction_id,
				transactions_account_key_link.mode,
				unhexlify(transactions_account_key_link.remote_account),
			)
		)

	def insert_transactions_multisig_account_modification(self, cursor, transaction_id, transactions_multisig_account_modification):
		"""Adds multisig account modification into transactions_multisig_account_modification table"""

		cursor.execute(
			'''
			INSERT INTO transactions_multisig_account_modification (transaction_id, min_cosignatories, modifications)
			VALUES (%s, %s, %s)
			''',
			(
				transaction_id,
				transactions_multisig_account_modification.min_cosignatories,
				transactions_multisig_account_modification.modifications,
			)
		)

	def insert_transactions_multisig(self, cursor, transaction_id, transactions_multisig):
		"""Adds multisig into transactions_multisig table"""

		cursor.execute(
			'''
			INSERT INTO transactions_multisig (
				transaction_id,
				signatures,
				other_transaction,
				inner_hash
			)
			VALUES (%s, %s, %s, %s)
			''',
			(
				transaction_id,
				transactions_multisig.signatures,
				transactions_multisig.other_transaction,
				unhexlify(transactions_multisig.inner_hash),
			)
		)

	def insert_transactions_namespace_registration(self, cursor, transaction_id, transactions_namespace_registration):
		"""Adds namespace registration into transactions_namespace_registration table"""

		cursor.execute(
			'''
			INSERT INTO transactions_namespace_registration (
				transaction_id,
				rental_fee_sink,
				rental_fee,
				parent,
				namespace
			)
			VALUES (%s, %s, %s, %s, %s)
			''',
			(
				transaction_id,
				Address(transactions_namespace_registration.rental_fee_sink).bytes,
				transactions_namespace_registration.rental_fee,
				transactions_namespace_registration.parent,
				transactions_namespace_registration.namespace,
			)
		)

	def insert_transactions_mosaic_definition_creation(self, cursor, transaction_id, transactions_mosaic_definition_creation):
		"""Adds mosaic definition creation into transactions_mosaic_definition_creation table"""

		cursor.execute(
			'''
			INSERT INTO transactions_mosaic_definition_creation (
				transaction_id,
				creation_fee_sink,
				creation_fee,
				creator,
				description,
				namespace_name,
				properties,
				levy
			)
			VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
			''',
			(
				transaction_id,
				Address(transactions_mosaic_definition_creation.creation_fee_sink).bytes,
				transactions_mosaic_definition_creation.creation_fee,
				unhexlify(transactions_mosaic_definition_creation.creator),
				transactions_mosaic_definition_creation.description,
				transactions_mosaic_definition_creation.namespace_name,
				transactions_mosaic_definition_creation.properties,
				transactions_mosaic_definition_creation.levy,
			)
		)

	def insert_transactions_mosaic_supply_change(self, cursor, transaction_id, transactions_mosaic_supply_change):
		"""Adds mosaic supply change into transactions_mosaic_supply_change table"""

		cursor.execute(
			'''
			INSERT INTO transactions_mosaic_supply_change (transaction_id, supply_type, delta, namespace_name)
			VALUES (%s, %s, %s, %s)
			''',
			(
				transaction_id,
				transactions_mosaic_supply_change.supply_type,
				transactions_mosaic_supply_change.delta,
				transactions_mosaic_supply_change.namespace_name
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

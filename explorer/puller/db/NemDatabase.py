from binascii import hexlify, unhexlify

from symbolchain.nem.Network import Address

from db.DatabaseConnection import DatabaseConnection
from model.Mosaic import Mosaic
from model.Namespace import Namespace


class NemDatabase(DatabaseConnection):
	"""Database containing Nem blockchain data."""

	@staticmethod
	def _create_table_indexes(cursor):
		"""Create indexes for tables"""

		cursor.execute(
			'''
			CREATE INDEX IF NOT EXISTS idx_sender
				ON transactions(sender)
			'''
		)

		cursor.execute(
			'''
			CREATE INDEX IF NOT EXISTS idx_signer_address
				ON transactions(signer_address)
			'''
		)

		cursor.execute(
			'''
			CREATE INDEX IF NOT EXISTS idx_transaction_hash
				ON transactions(transaction_hash)
			'''
		)

		cursor.execute(
			'''
			CREATE INDEX IF NOT EXISTS idx_transaction_type
				ON transactions(transaction_type)
			'''
		)

		cursor.execute(
			'''
			CREATE INDEX IF NOT EXISTS idx_transaction_height
				ON transactions(height)
			'''
		)

		cursor.execute(
			'''
			CREATE INDEX IF NOT EXISTS idx_takl_transaction_id
				ON transactions_account_key_link(transaction_id)
			'''
		)

		cursor.execute(
			'''
			CREATE INDEX IF NOT EXISTS idx_tmdc_transaction_id
				ON transactions_mosaic_definition_creation(transaction_id)
			'''
		)

		cursor.execute(
			'''
			CREATE INDEX IF NOT EXISTS idx_tmsc_transaction_id
				ON transactions_mosaic_supply_change(transaction_id)
			'''
		)

		cursor.execute(
			'''
			CREATE INDEX IF NOT EXISTS idx_tm_transaction_id
				ON transactions_multisig(transaction_id)
			'''
		)

		cursor.execute(
			'''
			CREATE INDEX IF NOT EXISTS idx_tmam_transaction_id
				ON transactions_multisig_account_modification(transaction_id)
			'''
		)

		cursor.execute(
			'''
			CREATE INDEX IF NOT EXISTS idx_tnr_transaction_id
				ON transactions_namespace_registration(transaction_id)
			'''
		)

		cursor.execute(
			'''
			CREATE INDEX IF NOT EXISTS idx_tt_transaction_id
				ON transactions_transfer(transaction_id)
			'''
		)

		cursor.execute(
			'''
			CREATE INDEX IF NOT EXISTS idx_recipient
				ON transactions_transfer(recipient)
			'''
		)

		cursor.execute(
			'''
			CREATE INDEX IF NOT EXISTS idx_account_remarks_address
				ON account_remarks (address)
			'''
		)

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
				signature bytea NOT NULL,
				size bigint DEFAULT 0
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
				signer_address bytea NOT NULL,
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
				initiator bytea NOT NULL,
				signatures json NOT NULL,
				other_transaction json NOT NULL,
				inner_hash bytea NOT NULL,
				FOREIGN KEY (transaction_id) REFERENCES transactions(id)
				ON DELETE CASCADE
			)
			'''
		)

		# Create transactions namespace registration table
		# parent is varchar(81) example: example: "nem" or "nem.xem"
		cursor.execute(
			'''
			CREATE TABLE IF NOT EXISTS transactions_namespace_registration (
				id serial PRIMARY KEY,
				transaction_id serial NOT NULL,
				rental_fee_sink bytea NOT NULL,
				rental_fee bigint DEFAULT 0,
				parent varchar(81),
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

		# Create mosaics table
		cursor.execute(
			'''
			CREATE TABLE IF NOT EXISTS mosaics (
				id serial PRIMARY KEY,
				root_namespace varchar(16),
				namespace_name varchar(146),
				description varchar(512),
				creator bytea NOT NULL,
				registered_height bigint NOT NULL,
				initial_supply bigint DEFAULT 0,
				total_supply bigint DEFAULT 0,
				divisibility int NOT NULL,
				supply_mutable boolean DEFAULT false,
				transferable boolean DEFAULT false,
				levy_type int,
				levy_namespace_name varchar(146),
				levy_fee bigint DEFAULT 0,
				levy_recipient bytea
			)
			'''
		)

		# Create namespaces table
		cursor.execute(
			'''
			CREATE TABLE IF NOT EXISTS namespaces (
				id serial PRIMARY KEY,
				root_namespace varchar(16),
				owner bytea NOT NULL,
				registered_height bigint NOT NULL,
				expiration_height bigint NOT NULL,
				sub_namespaces VARCHAR(146)[]
			)
			'''
		)

		# Create accounts remarks table
		cursor.execute(
			'''
			CREATE TABLE IF NOT EXISTS account_remarks (
				id serial PRIMARY KEY,
				address bytea UNIQUE,
				remarks varchar NOT NULL
			)
			'''
		)

		self._create_table_indexes(cursor)

		self.connection.commit()

	def insert_account_remarks_from_json(self, accounts_remarks_json):
		"""Adds account remarks into accounts_remarks table"""

		if 'remarks' not in accounts_remarks_json:
			return

		cursor = self.connection.cursor()
		cursor.executemany(
			'''
			INSERT INTO account_remarks (address, remarks)
			VALUES (%s, %s)
			ON CONFLICT (address) DO NOTHING
			''',
			[
				(
					Address(account['address']).bytes,
					account['remark']
				) for account in accounts_remarks_json['remarks']
			]
		)

		self.connection.commit()

	def insert_block(self, cursor, block):  # pylint: disable=no-self-use
		"""Adds block height into table."""

		cursor.execute(
			'''
			INSERT INTO blocks
			VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
			''', (
				block.height,
				block.timestamp,
				block.total_fees,
				block.total_transactions,
				block.difficulty,
				unhexlify(block.block_hash),
				unhexlify(block.signer),
				unhexlify(block.signature),
				block.size
			)
		)

	def insert_transaction(self, cursor, transaction):  # pylint: disable=no-self-use
		"""Adds transactions into transactions table"""

		cursor.execute(
			'''
			INSERT INTO transactions (transaction_hash, height, sender, signer_address, fee, timestamp, deadline, signature, transaction_type)
			VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
			RETURNING id
			''',
			(
				unhexlify(transaction.transaction_hash),
				transaction.height,
				unhexlify(transaction.sender),
				Address(transaction.signer_address).bytes,
				transaction.fee,
				transaction.timestamp,
				transaction.deadline,
				unhexlify(transaction.signature),
				transaction.transaction_type
			)
		)

		return cursor.fetchone()[0]

	def insert_transactions_transfer(self, cursor, transaction_id, transactions_transfer):  # pylint: disable=no-self-use
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

	def insert_transactions_account_key_link(self, cursor, transaction_id, account_key_link):  # pylint: disable=no-self-use
		"""Adds account key link into transactions_account_key_link table"""

		cursor.execute(
			'''
			INSERT INTO transactions_account_key_link (transaction_id, mode, remote_account)
			VALUES (%s, %s, %s)
			''',
			(
				transaction_id,
				account_key_link.mode,
				unhexlify(account_key_link.remote_account),
			)
		)

	def insert_transactions_multisig_account_modification(
		self,
		cursor,
		transaction_id,
		multisig_account_modification
	):  # pylint: disable=no-self-use, invalid-name
		"""Adds multisig account modification into transactions_multisig_account_modification table"""

		cursor.execute(
			'''
			INSERT INTO transactions_multisig_account_modification (transaction_id, min_cosignatories, modifications)
			VALUES (%s, %s, %s)
			''',
			(
				transaction_id,
				multisig_account_modification.min_cosignatories,
				multisig_account_modification.modifications,
			)
		)

	def insert_transactions_multisig(self, cursor, transaction_id, multisig):  # pylint: disable=no-self-use
		"""Adds multisig into transactions_multisig table"""

		cursor.execute(
			'''
			INSERT INTO transactions_multisig (
				transaction_id,
				initiator,
				signatures,
				other_transaction,
				inner_hash
			)
			VALUES (%s, %s, %s, %s, %s)
			''',
			(
				transaction_id,
				unhexlify(multisig.initiator),
				multisig.signatures,
				multisig.other_transaction,
				unhexlify(multisig.inner_hash),
			)
		)

	def insert_transactions_namespace_registration(
		self,
		cursor,
		transaction_id,
		namespace_registration
	):  # pylint: disable=no-self-use, invalid-name
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
				Address(namespace_registration.rental_fee_sink).bytes,
				namespace_registration.rental_fee,
				namespace_registration.parent,
				namespace_registration.namespace,
			)
		)

	def insert_transactions_mosaic_definition_creation(
		self,
		cursor,
		transaction_id,
		mosaic_definition_creation
	):  # pylint: disable=no-self-use, invalid-name
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
				Address(mosaic_definition_creation.creation_fee_sink).bytes,
				mosaic_definition_creation.creation_fee,
				unhexlify(mosaic_definition_creation.creator),
				mosaic_definition_creation.description,
				mosaic_definition_creation.namespace_name,
				mosaic_definition_creation.properties,
				mosaic_definition_creation.levy,
			)
		)

	def insert_transactions_mosaic_supply_change(
		self,
		cursor,
		transaction_id,
		mosaic_supply_change
	):  # pylint: disable=no-self-use, invalid-name
		"""Adds mosaic supply change into transactions_mosaic_supply_change table"""

		cursor.execute(
			'''
			INSERT INTO transactions_mosaic_supply_change (transaction_id, supply_type, delta, namespace_name)
			VALUES (%s, %s, %s, %s)
			''',
			(
				transaction_id,
				mosaic_supply_change.supply_type,
				mosaic_supply_change.delta,
				mosaic_supply_change.namespace_name
			)
		)

	def insert_mosaic(self, cursor, mosaic):  # pylint: disable=no-self-use
		"""Adds mosaic into mosaics table"""

		cursor.execute(
			'''
			INSERT INTO mosaics (
				root_namespace,
				namespace_name,
				description,
				creator,
				registered_height,
				initial_supply,
				total_supply,
				divisibility,
				supply_mutable,
				transferable,
				levy_type,
				levy_namespace_name,
				levy_fee,
				levy_recipient
			)
			VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
			''',
			(
				mosaic.root_namespace,
				mosaic.namespace_name,
				mosaic.description,
				unhexlify(mosaic.creator),
				mosaic.registered_height,
				mosaic.initial_supply,
				mosaic.total_supply,
				mosaic.divisibility,
				mosaic.supply_mutable,
				mosaic.transferable,
				mosaic.levy_type,
				mosaic.levy_namespace_name,
				mosaic.levy_fee,
				Address(mosaic.levy_recipient).bytes if mosaic.levy_recipient is not None else None,
			)
		)

	def get_mosaic_by_namespace_name(self, cursor, namespace_name):  # pylint: disable=no-self-use
		"""Searches mosaic in mosaics table"""

		cursor.execute(
			'''
			SELECT
				root_namespace,
				description,
				creator,
				registered_height,
				initial_supply,
				total_supply,
				divisibility,
				supply_mutable,
				transferable,
				levy_type,
				levy_namespace_name,
				levy_fee,
				levy_recipient
			FROM mosaics
			WHERE namespace_name = %s
			''',
			(namespace_name,)
		)

		result = cursor.fetchone()
		if result is None:
			return None

		return Mosaic(
			result[0],
			namespace_name,
			result[1],
			hexlify(result[2]),
			result[3],
			result[4],
			result[5],
			result[6],
			result[7],
			result[8],
			result[9],
			result[10],
			result[11],
			hexlify(result[12]) if result[12] is not None else None,
		)

	def update_mosaic_total_supply(self, cursor, namespace_name, supply):  # pylint: disable=no-self-use
		"""Updates mosaic supply in mosaics table"""

		cursor.execute(
			'''
			UPDATE mosaics
			SET
				total_supply = %s
			WHERE namespace_name = %s
			''',
			(supply, namespace_name)
		)

	def insert_namespace(self, cursor, namespace):  # pylint: disable=no-self-use
		"""Adds root namespace into namespaces table"""

		cursor.execute(
			'''
			INSERT INTO namespaces (
				root_namespace,
				owner,
				registered_height,
				expiration_height,
				sub_namespaces
			)
			VALUES (%s, %s, %s, %s, %s)
			''',
			(
				namespace.root_namespace,
				unhexlify(namespace.owner),
				namespace.registered_height,
				namespace.expiration_height,
				namespace.sub_namespaces
			)
		)

	def update_namespace(
		self,
		cursor,
		root_namespace,
		expiration_height=None,
		sub_namespaces=None,
		owner=None
	):  # pylint: disable=no-self-use, invalid-name
		"""Updates namespace in namespaces table"""

		query = 'UPDATE namespaces SET '
		optional_query = []
		values = []

		if expiration_height is not None:
			optional_query.append('expiration_height = %s')
			values.append(expiration_height)

		if sub_namespaces is not None:
			optional_query.append('sub_namespaces = %s')
			values.append(sub_namespaces)

		if owner is not None:
			optional_query.append('owner = %s')
			values.append(unhexlify(owner))

		# Join all the updates
		query += ', '.join(optional_query)

		# Add the where clause
		query += ' WHERE root_namespace = %s'
		values.append(root_namespace)

		# Execute the query
		cursor.execute(query, values)

	def get_namespace_by_root_namespace(self, cursor, root_namespace):  # pylint: disable=no-self-use
		"""Searches namespace in namespaces table"""

		cursor.execute(
			'''
			SELECT
				owner,
				registered_height,
				expiration_height,
				sub_namespaces
			FROM namespaces
			WHERE root_namespace = %s
			''',
			(root_namespace,)
		)

		result = cursor.fetchone()
		if result is None:
			return None

		return Namespace(
			root_namespace,
			hexlify(result[0]),
			result[1],
			result[2],
			result[3]
		)

	def get_current_height(self):  # pylint: disable=no-self-use
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

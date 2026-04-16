import json
from binascii import unhexlify

from .DatabaseConnection import DatabaseConnection


class NemDatabase(DatabaseConnection):
	"""Database containing Nem blockchain data."""

	@staticmethod
	def _create_table_indexes(cursor):
		"""Creates table indexes."""

		# Create indexes for accounts table
		cursor.execute(
			'''
			CREATE INDEX IF NOT EXISTS idx_accounts_address
				ON accounts (address)
			'''
		)

		cursor.execute(
			'''
			CREATE INDEX IF NOT EXISTS idx_accounts_balance
				ON accounts(balance DESC);
			'''
		)

		cursor.execute(
			'''
			CREATE INDEX IF NOT EXISTS idx_accounts_public_key
				ON accounts (public_key)
			'''
		)

		cursor.execute(
			'''
			CREATE INDEX IF NOT EXISTS idx_accounts_mosaics_gin
				ON accounts USING GIN (mosaics)
			'''
		)

		# Create indexes for blocks table
		cursor.execute(
			'''
			CREATE INDEX IF NOT EXISTS idx_blocks_height_desc ON blocks(height DESC);
			'''
		)

		# Create indexes for namespaces table
		cursor.execute(
			'''
			CREATE INDEX IF NOT EXISTS idx_namespaces_root_namespace
				ON namespaces (root_namespace)
			'''
		)

		# Create indexes for mosaics table
		cursor.execute(
			'''
			CREATE INDEX IF NOT EXISTS idx_mosaic_name
				ON mosaics (namespace_name)
			'''
		)

		# Create indexes for transactions table
		cursor.execute(
			'''
			CREATE INDEX IF NOT EXISTS idx_transactions_hash
				ON transactions (transaction_hash)
			'''
		)

		cursor.execute(
			'''
			CREATE INDEX IF NOT EXISTS idx_transaction_type
				ON transactions (transaction_type)
			'''
		)

		cursor.execute(
			'''
			CREATE INDEX IF NOT EXISTS idx_transaction_height
				ON transactions(height DESC)
				WHERE is_inner = false
			'''
		)

		cursor.execute(
			'''
			CREATE INDEX IF NOT EXISTS idx_tx_recipient
				ON transactions(recipient_address)
			'''
		)

		cursor.execute(
			'''
			CREATE INDEX IF NOT EXISTS idx_tx_sender_address
				ON transactions(sender_address)
			'''
		)

		cursor.execute(
			'''
			CREATE INDEX IF NOT EXISTS idx_tx_is_inner
				ON transactions(is_inner)
			'''
		)

		# Create indexes for transactions_mosaic table
		cursor.execute(
			'''
			CREATE INDEX IF NOT EXISTS idx_mosaic_tx_i
				ON transactions_mosaic(transaction_id)
			'''
		)

		cursor.execute(
			'''
			CREATE INDEX IF NOT EXISTS idx_mosaic_lookup
				ON transactions_mosaic(namespace_name)
			'''
		)

	def create_tables(self):
		"""Creates database tables."""

		cursor = self.connection.cursor()

		# Create accounts table
		cursor.execute(
			'''
			CREATE TABLE IF NOT EXISTS accounts (
				id serial PRIMARY KEY,
				address bytea NOT NULL UNIQUE,
				public_key bytea,
				remote_address bytea,
				importance decimal(20, 10) DEFAULT 0,
				balance bigint DEFAULT 0,
				vested_balance bigint DEFAULT 0,
				mosaics jsonb DEFAULT '[]'::jsonb,
				harvested_fees bigint DEFAULT 0,
				harvested_blocks bigint DEFAULT 0,
				status varchar(8) DEFAULT NULL,
				remote_status varchar(12) DEFAULT NULL,
				last_harvested_height bigint DEFAULT 0,
				min_cosignatories int DEFAULT NULL,
				cosignatory_of bytea[] DEFAULT NULL,
				cosignatories bytea[] DEFAULT NULL,
				updated_at timestamp DEFAULT CURRENT_TIMESTAMP
			)
			'''
		)

		# Create blocks table
		cursor.execute(
			'''
			CREATE TABLE IF NOT EXISTS blocks (
				id serial PRIMARY KEY,
				height bigint NOT NULL UNIQUE,
				timestamp timestamp NOT NULL,
				total_fee bigint DEFAULT 0,
				total_transactions int DEFAULT 0,
				difficulty bigint NOT NULL,
				hash bytea NOT NULL,
				beneficiary bytea NOT NULL,
				signer bytea NOT NULL,
				signature bytea NOT NULL,
				size bigint DEFAULT 0
			)
			'''
		)

		# Create Namespaces table
		cursor.execute(
			'''
			CREATE TABLE IF NOT EXISTS namespaces (
				id serial PRIMARY KEY,
				root_namespace varchar(16) NOT NULL UNIQUE,
				owner bytea NOT NULL,
				registered_height bigint NOT NULL,
				expiration_height bigint NOT NULL,
				sub_namespaces VARCHAR(146)[] DEFAULT '{}'
			)
			'''
		)

		# Create Mosaics table
		cursor.execute(
			'''
			CREATE TABLE IF NOT EXISTS mosaics (
				id serial PRIMARY KEY,
				root_namespace varchar(16) NOT NULL,
				namespace_name varchar(146) NOT NULL UNIQUE,
				description varchar(512),
				creator bytea NOT NULL,
				registered_height bigint NOT NULL,
				initial_supply bigint,
				total_supply bigint,
				divisibility int NOT NULL,
				supply_mutable boolean,
				transferable boolean,
				levy_type int,
				levy_namespace_name varchar(146),
				levy_fee bigint,
				levy_recipient bytea
			)
			'''
		)

		# Create Transactions table
		cursor.execute(
			'''
			CREATE TABLE IF NOT EXISTS transactions (
				id serial PRIMARY KEY,
				transaction_hash bytea UNIQUE NOT NULL,
				transaction_type int NOT NULL,
				height bigint NOT NULL,
				sender_public_key bytea NOT NULL,
				sender_address bytea NOT NULL,
				recipient_address bytea,
				fee bigint DEFAULT 0,
				timestamp timestamp NOT NULL,
				deadline timestamp NOT NULL,
				signature bytea,
				amount bigint,
				is_inner boolean DEFAULT false,
				payload jsonb
			)
			'''
		)

		# Create Transactions mosaic table
		cursor.execute(
			'''
			CREATE TABLE IF NOT EXISTS transactions_mosaic (
				id serial PRIMARY KEY,
				transaction_id int NOT NULL,
				namespace_name varchar(146),
				quantity bigint,
				FOREIGN KEY (transaction_id) REFERENCES transactions(id)
				ON DELETE CASCADE
			)
			'''
		)

		self._create_table_indexes(cursor)

		self.connection.commit()

	@staticmethod
	def insert_block(cursor, block):
		"""Adds block height into table."""

		cursor.execute(
			'''
			INSERT INTO blocks (height, timestamp, total_fee, total_transactions, difficulty, hash, beneficiary, signer, signature, size)
			VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
			''', (
				block.height,
				block.timestamp,
				block.total_fee,
				block.total_transactions,
				block.difficulty,
				unhexlify(block.block_hash),
				block.beneficiary.bytes,
				block.signer.bytes,
				unhexlify(block.signature),
				block.size
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

	@staticmethod
	def upsert_account(cursor, account_info):
		"""Insert or update account information."""

		cursor.execute(
			'''
			INSERT INTO accounts (
				address,
				public_key,
				remote_address,
				importance,
				balance,
				vested_balance,
				mosaics,
				harvested_blocks,
				status,
				remote_status,
				min_cosignatories,
				cosignatory_of,
				cosignatories
			)
			VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
			ON CONFLICT (address)
			DO UPDATE SET
				remote_address = EXCLUDED.remote_address,
				importance = EXCLUDED.importance,
				balance = EXCLUDED.balance,
				vested_balance = EXCLUDED.vested_balance,
				mosaics = EXCLUDED.mosaics,
				harvested_blocks = EXCLUDED.harvested_blocks,
				status = EXCLUDED.status,
				remote_status = EXCLUDED.remote_status,
				min_cosignatories = EXCLUDED.min_cosignatories,
				cosignatory_of = EXCLUDED.cosignatory_of,
				cosignatories = EXCLUDED.cosignatories,
				updated_at = CURRENT_TIMESTAMP
			''', (
				account_info.address.bytes,
				account_info.public_key.bytes if account_info.public_key else None,
				account_info.remote_address.bytes if account_info.remote_address else None,
				account_info.importance,
				account_info.balance,
				account_info.vested_balance,
				json.dumps(account_info.mosaics),
				account_info.harvested_blocks,
				account_info.status,
				account_info.remote_status,
				account_info.min_cosignatories,
				[address.bytes for address in account_info.cosignatory_of] if len(account_info.cosignatory_of) > 0 else None,
				[address.bytes for address in account_info.cosignatories] if len(account_info.cosignatories) > 0 else None,
			)
		)

	@staticmethod
	def update_account_harvested_fees(cursor, harvester, total_fees, last_height):
		"""Updates harvested fees for an account."""

		cursor.execute(
			'''
			UPDATE accounts
			SET harvested_fees = harvested_fees + %s,
				last_harvested_height = %s
			WHERE address = %s
			''', (
				total_fees,
				last_height,
				harvester.bytes
			)
		)

	@staticmethod
	def upsert_namespace(cursor, namespace):
		"""Insert or update namespace information."""

		cursor.execute(
			'''
			INSERT INTO namespaces (
				root_namespace,
				owner,
				registered_height,
				expiration_height
			)
			VALUES (%s, %s, %s, %s)
			ON CONFLICT (root_namespace)
			DO UPDATE SET
				owner = EXCLUDED.owner,
				registered_height = EXCLUDED.registered_height,
				expiration_height = EXCLUDED.expiration_height
			''',
			(
				namespace.root_namespace,
				namespace.owner.bytes,
				namespace.registered_height,
				namespace.expiration_height
			)
		)

	@staticmethod
	def update_sub_namespaces(cursor, sub_namespace, root_namespace):
		"""Appends sub-namespace to a root namespace's sub_namespaces array."""

		cursor.execute(
			'''
			UPDATE namespaces
			SET sub_namespaces = array_append(sub_namespaces, %s)
			WHERE root_namespace = %s
			''',
			(
				sub_namespace,
				root_namespace
			)
		)

	@staticmethod
	def upsert_mosaic(cursor, mosaic_definition):
		"""Insert or update mosaic information."""

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
			ON CONFLICT (namespace_name)
			DO UPDATE SET
				root_namespace = EXCLUDED.root_namespace,
				description = EXCLUDED.description,
				creator = EXCLUDED.creator,
				registered_height = EXCLUDED.registered_height,
				initial_supply = EXCLUDED.initial_supply,
				total_supply = EXCLUDED.total_supply,
				divisibility = EXCLUDED.divisibility,
				supply_mutable = EXCLUDED.supply_mutable,
				transferable = EXCLUDED.transferable,
				levy_type = EXCLUDED.levy_type,
				levy_namespace_name = EXCLUDED.levy_namespace_name,
				levy_fee = EXCLUDED.levy_fee,
				levy_recipient = EXCLUDED.levy_recipient
			''',
			(
				mosaic_definition.root_namespace,
				mosaic_definition.namespace_name,
				mosaic_definition.description,
				mosaic_definition.creator.bytes,
				mosaic_definition.registered_height,
				mosaic_definition.initial_supply,
				mosaic_definition.total_supply,
				mosaic_definition.divisibility,
				mosaic_definition.supply_mutable,
				mosaic_definition.transferable,
				mosaic_definition.levy_type,
				mosaic_definition.levy_namespace_name,
				mosaic_definition.levy_fee,
				mosaic_definition.levy_recipient.bytes if mosaic_definition.levy_recipient else None
			)
		)

	@staticmethod
	def update_mosaic_total_supply(cursor, namespace_name, adjustment):
		"""Updates mosaic total supply."""

		cursor.execute(
			'''
			UPDATE mosaics
			SET total_supply = GREATEST(0, total_supply + %s)
			WHERE namespace_name = %s AND supply_mutable = true
			''',
			(
				adjustment,
				namespace_name
			)
		)

	@staticmethod
	def insert_transaction(cursor, transaction):
		"""Inserts transaction information."""

		cursor.execute(
			'''
			INSERT INTO transactions (
				transaction_hash,
				transaction_type,
				height,
				sender_public_key,
				sender_address,
				recipient_address,
				fee,
				timestamp,
				deadline,
				signature,
				amount,
				is_inner,
				payload
			)
			VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
			RETURNING id
			''',
			(
				unhexlify(transaction.transaction_hash),
				transaction.transaction_type,
				transaction.height,
				transaction.sender_public_key.bytes,
				transaction.sender_address.bytes,
				transaction.recipient_address.bytes if transaction.recipient_address else None,
				transaction.fee,
				transaction.timestamp,
				transaction.deadline,
				unhexlify(transaction.signature) if transaction.signature else None,
				transaction.amount,
				transaction.is_inner,
				json.dumps(transaction.payload) if transaction.payload else None
			)
		)

		return cursor.fetchone()[0]

	@staticmethod
	def insert_transaction_mosaic(cursor, transaction_id, mosaic):
		"""Inserts transaction mosaic information."""

		cursor.execute(
			'''
			INSERT INTO transactions_mosaic (
				transaction_id,
				namespace_name,
				quantity
			)
			VALUES (%s, %s, %s)
			''',
			(
				transaction_id,
				mosaic.namespace_name,
				mosaic.quantity
			)
		)

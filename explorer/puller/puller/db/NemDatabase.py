import json
from binascii import unhexlify
from collections import namedtuple

from symbolchain.nc import TransactionType
from symbolchain.nem.Network import Address

from .DatabaseConnection import DatabaseConnection

AccountRefreshRecord = namedtuple('AccountRefreshRecord', ['id', 'address'])


class NemDatabase(DatabaseConnection):
	"""Database containing Nem blockchain data."""

	@staticmethod
	def _create_table_indexes(cursor):
		"""Creates table indexes."""

		# Create indexes for accounts table
		cursor.execute(
			'''
			CREATE INDEX IF NOT EXISTS accounts_balance_idx
				ON accounts(balance DESC);
			'''
		)

		cursor.execute(
			'''
			CREATE INDEX IF NOT EXISTS accounts_public_key_idx
				ON accounts (public_key)
			'''
		)

		cursor.execute(
			'''
			CREATE INDEX IF NOT EXISTS accounts_last_harvested_height_idx
				ON accounts (last_harvested_height DESC)
			'''
		)

		cursor.execute(
			'''
			CREATE INDEX IF NOT EXISTS accounts_remote_address_idx
				ON accounts (remote_address)
				WHERE remote_address IS NOT NULL
			'''
		)

		# Create indexes for blocks table
		cursor.execute(
			'''
			CREATE INDEX IF NOT EXISTS blocks_timestamp_idx
				ON blocks(timestamp)
			'''
		)

		# Create indexes for mosaics table
		cursor.execute(
			'''
			CREATE INDEX IF NOT EXISTS mosaics_root_namespace_idx
				ON mosaics (root_namespace)
			'''
		)

		# Create indexes for transactions table
		cursor.execute(
			'''
			CREATE INDEX IF NOT EXISTS transactions_transaction_type_idx
				ON transactions (transaction_type)
			'''
		)

		cursor.execute(
			'''
			CREATE INDEX IF NOT EXISTS transactions_height_is_inner_false_idx
				ON transactions(height DESC)
				WHERE is_inner = false
			'''
		)

		cursor.execute(
			'''
			CREATE INDEX IF NOT EXISTS transactions_recipient_address_idx
				ON transactions(recipient_address)
			'''
		)

		cursor.execute(
			'''
			CREATE INDEX IF NOT EXISTS transactions_sender_address_idx
				ON transactions(sender_address)
			'''
		)

		cursor.execute(
			'''
			CREATE INDEX IF NOT EXISTS transactions_is_inner_idx
				ON transactions(is_inner)
			'''
		)

		cursor.execute(
			f'''
			CREATE INDEX IF NOT EXISTS transactions_sender_address_height_idx
				ON transactions(sender_address, height DESC, id DESC)
				INCLUDE (aggregate_hash)
				WHERE transaction_type <> {TransactionType.MULTISIG.value}
			'''
		)

		cursor.execute(
			f'''
			CREATE INDEX IF NOT EXISTS transactions_recipient_address_height_idx
				ON transactions(recipient_address, height DESC, id DESC)
				INCLUDE (aggregate_hash)
				WHERE transaction_type <> {TransactionType.MULTISIG.value}
			'''
		)

		# Create indexes for transactions_mosaic table
		cursor.execute(
			'''
			CREATE INDEX IF NOT EXISTS transactions_mosaic_transaction_id_idx
				ON transactions_mosaic(transaction_id)
			'''
		)

		cursor.execute(
			'''
			CREATE INDEX IF NOT EXISTS transactions_mosaic_namespace_name_idx
				ON transactions_mosaic(namespace_name)
			'''
		)

		cursor.execute(
			'''
			CREATE INDEX IF NOT EXISTS transactions_mosaic_namespace_name_transaction_id_idx
				ON transactions_mosaic(namespace_name, transaction_id)
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
				height bigint NOT NULL,
				public_key bytea,
				remote_address bytea,
				importance decimal(20, 10) NOT NULL,
				balance bigint NOT NULL,
				vested_balance bigint NOT NULL,
				mosaics jsonb NOT NULL,
				harvested_fees bigint NOT NULL DEFAULT 0,
				harvested_blocks bigint NOT NULL,
				remote_status varchar(12),
				last_harvested_height bigint NOT NULL DEFAULT 0,
				min_cosignatories int,
				cosignatory_of bytea[],
				cosignatories bytea[],
				updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
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
				total_fee bigint NOT NULL,
				total_transactions int NOT NULL,
				difficulty bigint NOT NULL,
				hash bytea NOT NULL,
				beneficiary bytea NOT NULL,
				signer bytea NOT NULL,
				signature bytea NOT NULL,
				size bigint NOT NULL
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
				sub_namespaces VARCHAR(146)[] NOT NULL DEFAULT '{}'
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
				description varchar(512) NOT NULL,
				creator bytea NOT NULL,
				registered_height bigint NOT NULL,
				initial_supply bigint NOT NULL,
				total_supply bigint NOT NULL,
				divisibility int NOT NULL,
				supply_mutable boolean NOT NULL,
				transferable boolean NOT NULL,
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
				fee bigint NOT NULL,
				timestamp timestamp NOT NULL,
				deadline timestamp NOT NULL,
				signature bytea,
				is_inner boolean NOT NULL,
				aggregate_hash bytea,
				payload jsonb,
				size int NOT NULL,
				version int NOT NULL
			)
			'''
		)

		# Create Transactions mosaic table
		cursor.execute(
			'''
			CREATE TABLE IF NOT EXISTS transactions_mosaic (
				id serial PRIMARY KEY,
				transaction_id int NOT NULL,
				namespace_name varchar(146) NOT NULL,
				quantity bigint NOT NULL,
				FOREIGN KEY (transaction_id) REFERENCES transactions(id)
				ON DELETE CASCADE
			)
			'''
		)

		# Create Account remark table
		cursor.execute(
			'''
			CREATE TABLE IF NOT EXISTS account_remark (
				address bytea PRIMARY KEY,
				remark varchar NOT NULL
			)
			'''
		)

		self._create_table_indexes(cursor)

		self.connection.commit()

	def seed_network_currency(self, cursor, signer):
		"""Seeds NEM network currency metadata."""

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
			DO NOTHING
			''',
			(
				'nem',
				signer.bytes,
				1,
				0  # no expiration
			)
		)

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
				transferable
			)
			VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
			ON CONFLICT (namespace_name)
			DO NOTHING
			''',
			(
				'nem',
				'nem.xem',
				'network currency',
				signer.bytes,
				1,
				8999999999,
				8999999999,
				6,
				False,
				True
			)
		)

		self.connection.commit()

	def seed_account_remark(self, seed_path):
		"""Seeds account remark table."""

		cursor = self.connection.cursor()

		with open(seed_path, 'rt', encoding='utf8') as seed_file:
			account_remark = json.load(seed_file)

		for account in account_remark:
			cursor.execute(
				'''
				INSERT INTO account_remark (
					address,
					remark
				)
				VALUES (%s, %s)
				ON CONFLICT (address)
				DO UPDATE SET
					remark = EXCLUDED.remark
				''', (
					Address(account['address']).bytes,
					account['remark']
				)
			)

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

	def get_accounts_for_refresh(self, limit, last_account_id):
		"""Gets account addresses that should have vested balance and importance refreshed."""

		cursor = self.connection.cursor()
		cursor.execute(
			'''
			SELECT id, address
			FROM accounts
			WHERE id > %s
				AND (
					balance > 0
					OR vested_balance > 0
					OR importance > 0
					OR remote_status IN ('ACTIVATING', 'DEACTIVATING')
				)
			ORDER BY id ASC
			LIMIT %s
			''',
			(last_account_id, limit)
		)
		results = cursor.fetchall()

		return [AccountRefreshRecord(record[0], Address(record[1])) for record in results]

	@staticmethod
	def get_mosaic_levy_recipients(cursor, namespace_names):
		"""Gets levy recipient addresses for mosaics."""

		if not namespace_names:
			return []

		cursor.execute(
			'''
			SELECT levy_recipient
			FROM mosaics
			WHERE namespace_name = ANY(%s)
				AND levy_recipient IS NOT NULL
			''',
			(list(namespace_names),)
		)
		results = cursor.fetchall()

		return [Address(record[0]) for record in results]

	@staticmethod
	def upsert_account(cursor, account_info):
		"""Insert or update account information."""

		cursor.execute(
			'''
			INSERT INTO accounts (
				address,
				height,
				public_key,
				remote_address,
				importance,
				balance,
				vested_balance,
				mosaics,
				harvested_blocks,
				remote_status,
				min_cosignatories,
				cosignatory_of,
				cosignatories
			)
			VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
			ON CONFLICT (address)
			DO UPDATE SET
				public_key = EXCLUDED.public_key,
				importance = EXCLUDED.importance,
				balance = EXCLUDED.balance,
				vested_balance = EXCLUDED.vested_balance,
				mosaics = EXCLUDED.mosaics,
				harvested_blocks = EXCLUDED.harvested_blocks,
				remote_status = EXCLUDED.remote_status,
				min_cosignatories = EXCLUDED.min_cosignatories,
				cosignatory_of = EXCLUDED.cosignatory_of,
				cosignatories = EXCLUDED.cosignatories,
				updated_at = CURRENT_TIMESTAMP
			''', (
				account_info.address.bytes,
				account_info.height,
				account_info.public_key.bytes if account_info.public_key else None,
				account_info.remote_address.bytes if account_info.remote_address else None,
				account_info.importance,
				account_info.balance,
				account_info.vested_balance,
				json.dumps(account_info.mosaics),
				account_info.harvested_blocks,
				account_info.remote_status,
				account_info.min_cosignatories,
				[address.bytes for address in account_info.cosignatory_of] if len(account_info.cosignatory_of) > 0 else None,
				[address.bytes for address in account_info.cosignatories] if len(account_info.cosignatories) > 0 else None,
			)
		)

	@staticmethod
	def update_account_remote_address(cursor, address, remote_address):
		"""Sets or clears the remote (linked) address on a main account."""

		cursor.execute(
			'''
			UPDATE accounts
			SET remote_address = %s,
				updated_at = CURRENT_TIMESTAMP
			WHERE address = %s
			''',
			(
				remote_address.bytes if remote_address else None,
				address.bytes
			)
		)

	@staticmethod
	def update_refreshed_account(cursor, account_info):
		"""Updates vested balance, importance and remote status for an account."""

		cursor.execute(
			'''
			UPDATE accounts
			SET vested_balance = %s,
				importance = %s,
				remote_status = %s,
				updated_at = CURRENT_TIMESTAMP
			WHERE address = %s
			''',
			(
				account_info.vested_balance,
				account_info.importance,
				account_info.remote_status,
				account_info.address.bytes
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
				is_inner,
				aggregate_hash,
				payload,
				size,
				version
			)
			VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
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
				transaction.is_inner,
				unhexlify(transaction.aggregate_hash) if transaction.aggregate_hash else None,
				json.dumps(transaction.payload) if transaction.payload else None,
				transaction.size,
				transaction.version
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

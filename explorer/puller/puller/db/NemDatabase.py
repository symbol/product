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

		self._create_table_indexes(cursor)

		self.connection.commit()

	def insert_block(self, cursor, block):  # pylint: disable=no-self-use
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

	def upsert_account(self, cursor, account_info):  # pylint: disable=no-self-use
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

	def update_account_harvested_fees(self, cursor, harvester, total_fees, last_height):  # pylint: disable=no-self-use
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

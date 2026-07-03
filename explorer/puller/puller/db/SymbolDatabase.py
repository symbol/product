from puller.model.symbol.Block import BLOCK_TYPE_VALUES

from .DatabaseConnection import DatabaseConnection

SYNC_STATE_COLUMNS = [
	'status',
	'chain_height',
	'finalized_height',
	'finalized_hash',
	'finalized_epoch',
	'finalized_point',
	'last_synced_height',
	'last_synced_block_hash'
]

SYNC_STATE_STATUS_VALUES = ('initialized', 'healthy', 'repairing', 'unhealthy')
SYMBOL_SYNC_STATE_DEFINITIONS = [
	'id int PRIMARY KEY DEFAULT 1',
	'status symbol_sync_state_status NOT NULL',
	'chain_height int',
	'finalized_height int',
	'finalized_hash bytea',
	'finalized_epoch int',
	'finalized_point int',
	'last_synced_height int',
	'last_synced_block_hash bytea',
	'updated_at timestamp DEFAULT CURRENT_TIMESTAMP',
	'CONSTRAINT symbol_sync_state_singleton CHECK (id = 1)'
]
SYMBOL_BLOCK_DEFINITIONS = [
	'height bigint PRIMARY KEY',
	'hash bytea NOT NULL UNIQUE',
	'previous_hash bytea NOT NULL',
	'timestamp timestamp NOT NULL',
	'network_timestamp bigint NOT NULL',
	'total_fee int NOT NULL',
	'transactions_count int NOT NULL',
	'total_transactions_count int NOT NULL',
	'statements_count int NOT NULL',
	'difficulty bigint NOT NULL',
	'fee_multiplier bigint NOT NULL',
	'block_type symbol_block_type NOT NULL',
	'signer_public_key bytea NOT NULL',
	'signer_address bytea NOT NULL',
	'beneficiary_address bytea NOT NULL',
	'signature bytea NOT NULL',
	'size bigint NOT NULL',
	'proof_gamma bytea NOT NULL',
	'proof_verification_hash bytea NOT NULL',
	'proof_scalar bytea NOT NULL',
	'state_hash bytea NOT NULL',
	'transactions_hash bytea NOT NULL',
	'receipts_hash bytea NOT NULL',
	"state_hash_sub_cache_roots jsonb NOT NULL DEFAULT '[]'::jsonb",
	'voting_eligible_accounts_count bigint',
	'harvesting_eligible_accounts_count int',
	'total_voting_balance bigint',
	'previous_importance_block_hash bytea',
	'raw_payload jsonb NOT NULL',
	'created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP',
	'updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP'
]


def _create_enum_type(cursor, name, values):
	quoted_values = ', '.join(f"'{value}'" for value in values)
	cursor.execute(
		f'''
		DO $$
		BEGIN
			CREATE TYPE {name} AS ENUM ({quoted_values});
		EXCEPTION
			WHEN duplicate_object THEN NULL;
		END $$;
		'''
	)


def _create_table(cursor, name, definitions):
	cursor.execute(f'CREATE TABLE IF NOT EXISTS {name} ({", ".join(definitions)})')


class SymbolDatabase(DatabaseConnection):
	"""Database containing Symbol blockchain data."""

	def create_tables(self):
		"""Creates Symbol block synchronization tables."""

		cursor = self.connection.cursor()
		_create_enum_type(cursor, 'symbol_block_type', BLOCK_TYPE_VALUES)
		_create_enum_type(cursor, 'symbol_sync_state_status', SYNC_STATE_STATUS_VALUES)
		_create_table(cursor, 'symbol_sync_state', SYMBOL_SYNC_STATE_DEFINITIONS)
		_create_table(cursor, 'symbol_blocks', SYMBOL_BLOCK_DEFINITIONS)
		cursor.execute('CREATE INDEX IF NOT EXISTS idx_symbol_blocks_height_desc ON symbol_blocks(height DESC)')
		cursor.execute('CREATE INDEX IF NOT EXISTS idx_symbol_blocks_timestamp ON symbol_blocks(timestamp)')
		cursor.execute('CREATE INDEX IF NOT EXISTS idx_symbol_blocks_signer_address ON symbol_blocks(signer_address)')
		self.connection.commit()

	def check_connection(self):
		"""Checks whether the configured Symbol database is reachable and initialized."""

		return self.get_sync_state() is not None

	def get_sync_state(self):
		"""Gets the singleton Symbol sync state."""

		cursor = self.connection.cursor()
		cursor.execute(f'SELECT {", ".join(SYNC_STATE_COLUMNS)} FROM symbol_sync_state WHERE id = 1')
		result = cursor.fetchone()

		return dict(zip(SYNC_STATE_COLUMNS, result)) if result else None

	def upsert_sync_state(self, sync_state):
		"""Upserts the singleton Symbol sync state."""

		cursor = self.connection.cursor()
		self._execute_upsert_sync_state(cursor, sync_state)
		self.connection.commit()

	@staticmethod
	def _execute_upsert_sync_state(cursor, sync_state):
		cursor.execute(
			'''
			INSERT INTO symbol_sync_state (
				id,
				status,
				chain_height,
				finalized_height,
				finalized_hash,
				finalized_epoch,
				finalized_point,
				last_synced_height,
				last_synced_block_hash,
				updated_at
			)
			VALUES (1, %s, %s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
			ON CONFLICT (id) DO UPDATE SET
				status = EXCLUDED.status,
				chain_height = EXCLUDED.chain_height,
				finalized_height = EXCLUDED.finalized_height,
				finalized_hash = EXCLUDED.finalized_hash,
				finalized_epoch = EXCLUDED.finalized_epoch,
				finalized_point = EXCLUDED.finalized_point,
				last_synced_height = EXCLUDED.last_synced_height,
				last_synced_block_hash = EXCLUDED.last_synced_block_hash,
				updated_at = CURRENT_TIMESTAMP
			''',
			[
				sync_state['status'],
				sync_state['chain_height'],
				sync_state['finalized_height'],
				sync_state['finalized_hash'],
				sync_state['finalized_epoch'],
				sync_state['finalized_point'],
				sync_state['last_synced_height'],
				sync_state['last_synced_block_hash']
			])

	def get_block_hash(self, height):
		"""Gets a block hash by height."""

		cursor = self.connection.cursor()
		cursor.execute('SELECT hash FROM symbol_blocks WHERE height = %s', (height,))
		result = cursor.fetchone()

		return result[0] if result else None

	def get_block_hashes(self, start_height, end_height):
		"""Gets block hashes for an inclusive height range."""

		cursor = self.connection.cursor()
		cursor.execute(
			'''
			SELECT height, hash
			FROM symbol_blocks
			WHERE height BETWEEN %s AND %s
			ORDER BY height ASC
			''',
			(start_height, end_height))

		return cursor.fetchall()

	def delete_blocks_from_height(self, height):
		"""Deletes blocks from the supplied height for rollback repair."""

		cursor = self.connection.cursor()
		cursor.execute('DELETE FROM symbol_blocks WHERE height >= %s', (height,))
		self.connection.commit()

	def repair_rollback_from_height(self, height, sync_state):
		"""Deletes rollbacked blocks and updates sync state in one transaction."""

		cursor = self.connection.cursor()
		cursor.execute('DELETE FROM symbol_blocks WHERE height >= %s', (height,))
		self._execute_upsert_sync_state(cursor, sync_state)
		self.connection.commit()

	def upsert_blocks(self, blocks):
		"""Upserts Symbol block rows."""

		cursor = self.connection.cursor()
		for block in blocks:
			cursor.execute(
				'''
				INSERT INTO symbol_blocks (
					height,
					hash,
					previous_hash,
					timestamp,
					network_timestamp,
					total_fee,
					transactions_count,
					total_transactions_count,
					statements_count,
					difficulty,
					fee_multiplier,
					block_type,
					signer_public_key,
					signer_address,
					beneficiary_address,
					signature,
					size,
					proof_gamma,
					proof_verification_hash,
					proof_scalar,
					state_hash,
					transactions_hash,
					receipts_hash,
					state_hash_sub_cache_roots,
					voting_eligible_accounts_count,
					harvesting_eligible_accounts_count,
					total_voting_balance,
					previous_importance_block_hash,
					raw_payload,
					updated_at
				)
				VALUES (
					%(height)s,
					%(hash)s,
					%(previous_hash)s,
					%(timestamp)s,
					%(network_timestamp)s,
					%(total_fee)s,
					%(transactions_count)s,
					%(total_transactions_count)s,
					%(statements_count)s,
					%(difficulty)s,
					%(fee_multiplier)s,
					%(block_type)s,
					%(signer_public_key)s,
					%(signer_address)s,
					%(beneficiary_address)s,
					%(signature)s,
					%(size)s,
					%(proof_gamma)s,
					%(proof_verification_hash)s,
					%(proof_scalar)s,
					%(state_hash)s,
					%(transactions_hash)s,
					%(receipts_hash)s,
					%(state_hash_sub_cache_roots)s,
					%(voting_eligible_accounts_count)s,
					%(harvesting_eligible_accounts_count)s,
					%(total_voting_balance)s,
					%(previous_importance_block_hash)s,
					%(raw_payload)s,
					CURRENT_TIMESTAMP
				)
				ON CONFLICT (height) DO UPDATE SET
					hash = EXCLUDED.hash,
					previous_hash = EXCLUDED.previous_hash,
					timestamp = EXCLUDED.timestamp,
					network_timestamp = EXCLUDED.network_timestamp,
					total_fee = EXCLUDED.total_fee,
					transactions_count = EXCLUDED.transactions_count,
					total_transactions_count = EXCLUDED.total_transactions_count,
					statements_count = EXCLUDED.statements_count,
					difficulty = EXCLUDED.difficulty,
					fee_multiplier = EXCLUDED.fee_multiplier,
					block_type = EXCLUDED.block_type,
					signer_public_key = EXCLUDED.signer_public_key,
					signer_address = EXCLUDED.signer_address,
					beneficiary_address = EXCLUDED.beneficiary_address,
					signature = EXCLUDED.signature,
					size = EXCLUDED.size,
					proof_gamma = EXCLUDED.proof_gamma,
					proof_verification_hash = EXCLUDED.proof_verification_hash,
					proof_scalar = EXCLUDED.proof_scalar,
					state_hash = EXCLUDED.state_hash,
					transactions_hash = EXCLUDED.transactions_hash,
					receipts_hash = EXCLUDED.receipts_hash,
					state_hash_sub_cache_roots = EXCLUDED.state_hash_sub_cache_roots,
					voting_eligible_accounts_count = EXCLUDED.voting_eligible_accounts_count,
					harvesting_eligible_accounts_count = EXCLUDED.harvesting_eligible_accounts_count,
					total_voting_balance = EXCLUDED.total_voting_balance,
					previous_importance_block_hash = EXCLUDED.previous_importance_block_hash,
					raw_payload = EXCLUDED.raw_payload,
					updated_at = CURRENT_TIMESTAMP
				''',
				block)
		self.connection.commit()

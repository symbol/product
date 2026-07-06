from psycopg2.extras import Json

from puller.model.symbol.Block import BLOCK_TYPE_VALUES
from puller.model.symbol.Transaction import MESSAGE_TYPE_LABELS, TRANSACTION_TYPE_LABELS

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
SYMBOL_TRANSACTION_TYPE_VALUES = tuple(TRANSACTION_TYPE_LABELS.values())
SYMBOL_TRANSACTION_MOSAIC_ROLE_VALUES = ('transfer', 'hash_lock', 'secret_lock', 'revocation', 'restriction', 'definition')
SYMBOL_TRANSACTION_ADDRESS_ROLE_VALUES = ('signer', 'recipient', 'target', 'sender', 'cosignatory', 'mosaic_owner')
SYMBOL_TRANSACTION_MESSAGE_TYPE_VALUES = tuple(MESSAGE_TYPE_LABELS.values())
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
	'fee_multiplier int NOT NULL',
	'block_type symbol_block_type NOT NULL',
	'signer_public_key bytea NOT NULL',
	'signer_address bytea NOT NULL',
	'beneficiary_address bytea NOT NULL',
	'signature bytea NOT NULL',
	'size int NOT NULL',
	'proof_gamma bytea NOT NULL',
	'proof_verification_hash bytea NOT NULL',
	'proof_scalar bytea NOT NULL',
	'state_hash bytea NOT NULL',
	'transactions_hash bytea NOT NULL',
	'receipts_hash bytea NOT NULL',
	"state_hash_sub_cache_roots jsonb NOT NULL DEFAULT '[]'::jsonb",
	'voting_eligible_accounts_count int',
	'harvesting_eligible_accounts_count int',
	'total_voting_balance bigint',
	'previous_importance_block_hash bytea',
	'raw_payload jsonb NOT NULL',
	'created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP',
	'updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP'
]
SYMBOL_TRANSACTION_DEFINITIONS = [
	'id bigserial PRIMARY KEY',
	'hash bytea UNIQUE',
	'aggregate_hash bytea',
	'embedded_index int',
	'is_embedded boolean NOT NULL',
	'height bigint NOT NULL REFERENCES symbol_blocks(height)',
	'list_sequence bigint',
	'timestamp timestamp NOT NULL',
	'type int NOT NULL',
	'type_name symbol_transaction_type NOT NULL',
	'signer_public_key bytea NOT NULL',
	'signer_address bytea NOT NULL',
	'recipient_address bytea',
	'target_address bytea',
	'deadline timestamp',
	'network_deadline bigint',
	'max_fee bigint',
	'effective_fee bigint',
	'size int',
	'message_type symbol_transaction_message_type',
	'message_payload text',
	'body jsonb',
	'raw_payload jsonb NOT NULL',
	'created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP',
	'updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP',
	'UNIQUE (aggregate_hash, embedded_index)'
]
SYMBOL_TRANSACTION_MOSAIC_DEFINITIONS = [
	'transaction_id bigint NOT NULL REFERENCES symbol_transactions(id)',
	'height bigint NOT NULL REFERENCES symbol_blocks(height)',
	'mosaic_id varchar(16) NOT NULL',
	'amount bigint NOT NULL',
	'role symbol_transaction_mosaic_role NOT NULL',
	'position int NOT NULL',
	'PRIMARY KEY (transaction_id, mosaic_id, role, position)'
]
SYMBOL_TRANSACTION_ADDRESS_DEFINITIONS = [
	'transaction_id bigint NOT NULL REFERENCES symbol_transactions(id)',
	'height bigint NOT NULL REFERENCES symbol_blocks(height)',
	'address bytea NOT NULL',
	'role symbol_transaction_address_role NOT NULL',
	'PRIMARY KEY (transaction_id, address, role)'
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
		_create_enum_type(cursor, 'symbol_transaction_type', SYMBOL_TRANSACTION_TYPE_VALUES)
		_create_enum_type(cursor, 'symbol_transaction_mosaic_role', SYMBOL_TRANSACTION_MOSAIC_ROLE_VALUES)
		_create_enum_type(cursor, 'symbol_transaction_address_role', SYMBOL_TRANSACTION_ADDRESS_ROLE_VALUES)
		_create_enum_type(cursor, 'symbol_transaction_message_type', SYMBOL_TRANSACTION_MESSAGE_TYPE_VALUES)
		_create_table(cursor, 'symbol_sync_state', SYMBOL_SYNC_STATE_DEFINITIONS)
		_create_table(cursor, 'symbol_blocks', SYMBOL_BLOCK_DEFINITIONS)
		cursor.execute('CREATE SEQUENCE IF NOT EXISTS symbol_transaction_list_sequence_seq')
		_create_table(cursor, 'symbol_transactions', SYMBOL_TRANSACTION_DEFINITIONS)
		_create_table(cursor, 'symbol_transaction_mosaics', SYMBOL_TRANSACTION_MOSAIC_DEFINITIONS)
		_create_table(cursor, 'symbol_transaction_addresses', SYMBOL_TRANSACTION_ADDRESS_DEFINITIONS)
		cursor.execute('CREATE INDEX IF NOT EXISTS idx_symbol_blocks_height_desc ON symbol_blocks(height DESC)')
		cursor.execute('CREATE INDEX IF NOT EXISTS idx_symbol_blocks_timestamp ON symbol_blocks(timestamp)')
		cursor.execute('CREATE INDEX IF NOT EXISTS idx_symbol_blocks_signer_address ON symbol_blocks(signer_address)')
		cursor.execute('''
			CREATE INDEX IF NOT EXISTS idx_symbol_transactions_height_desc
			ON symbol_transactions(height DESC, id DESC)
			WHERE is_embedded = false
		''')
		cursor.execute('''
			CREATE INDEX IF NOT EXISTS idx_symbol_transactions_list_sequence_desc
			ON symbol_transactions(list_sequence DESC)
			WHERE is_embedded = false
		''')
		cursor.execute('''
			CREATE INDEX IF NOT EXISTS idx_symbol_transactions_type_height
			ON symbol_transactions(type, height DESC, id DESC)
		''')
		cursor.execute('''
			CREATE INDEX IF NOT EXISTS idx_symbol_transactions_signer_height
			ON symbol_transactions(signer_public_key, height DESC, id DESC)
		''')
		cursor.execute('CREATE INDEX IF NOT EXISTS idx_symbol_transactions_signer_address ON symbol_transactions(signer_address)')
		cursor.execute('''
			CREATE INDEX IF NOT EXISTS idx_symbol_transactions_recipient_height
			ON symbol_transactions(recipient_address, height DESC, id DESC)
		''')
		cursor.execute('CREATE INDEX IF NOT EXISTS idx_symbol_transactions_timestamp ON symbol_transactions(timestamp)')
		cursor.execute('''
			CREATE INDEX IF NOT EXISTS idx_symbol_transaction_mosaics_mosaic_height
			ON symbol_transaction_mosaics(mosaic_id, height DESC, transaction_id)
		''')
		cursor.execute('''
			CREATE INDEX IF NOT EXISTS idx_symbol_transaction_mosaics_mosaic_role_height
			ON symbol_transaction_mosaics(mosaic_id, role, height DESC, transaction_id)
		''')
		cursor.execute('''
			CREATE INDEX IF NOT EXISTS idx_symbol_transaction_addresses_address_height
			ON symbol_transaction_addresses(address, height DESC, transaction_id)
		''')
		cursor.execute('CREATE INDEX IF NOT EXISTS idx_symbol_transaction_addresses_height ON symbol_transaction_addresses(height)')
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
		self._delete_blocks_and_transactions_from_height(cursor, height)
		self.connection.commit()

	def repair_rollback_from_height(self, height, sync_state):
		"""Deletes rollbacked blocks and updates sync state in one transaction."""

		cursor = self.connection.cursor()
		self._delete_blocks_and_transactions_from_height(cursor, height)
		self._execute_upsert_sync_state(cursor, sync_state)
		self.connection.commit()

	@staticmethod
	def _delete_blocks_and_transactions_from_height(cursor, height):
		cursor.execute('DELETE FROM symbol_transaction_mosaics WHERE height >= %s', (height,))
		cursor.execute('DELETE FROM symbol_transaction_addresses WHERE height >= %s', (height,))
		cursor.execute('DELETE FROM symbol_transactions WHERE height >= %s', (height,))
		cursor.execute('DELETE FROM symbol_blocks WHERE height >= %s', (height,))

	def upsert_transactions_for_height(self, height, transaction_entries):
		"""Replaces persisted Symbol transactions and child index rows for one height."""

		cursor = self.connection.cursor()
		cursor.execute('DELETE FROM symbol_transaction_mosaics WHERE height = %s', (height,))
		cursor.execute('DELETE FROM symbol_transaction_addresses WHERE height = %s', (height,))
		cursor.execute('DELETE FROM symbol_transactions WHERE height = %s', (height,))
		for entry in transaction_entries:
			transaction_id = self._insert_transaction(cursor, entry)
			for mosaic_row in entry['mosaic_rows']:
				cursor.execute(
					'''
					INSERT INTO symbol_transaction_mosaics (
						transaction_id,
						height,
						mosaic_id,
						amount,
						role,
						position
					)
					VALUES (%(transaction_id)s, %(height)s, %(mosaic_id)s, %(amount)s, %(role)s, %(position)s)
					''',
					{
						**mosaic_row,
						'transaction_id': transaction_id,
						'height': entry['height']
					})
			for address_row in entry['address_rows']:
				cursor.execute(
					'''
					INSERT INTO symbol_transaction_addresses (
						transaction_id,
						height,
						address,
						role
					)
					VALUES (%(transaction_id)s, %(height)s, %(address)s, %(role)s)
					''',
					{
						**address_row,
						'transaction_id': transaction_id,
						'height': entry['height']
					})

		self.connection.commit()

	@staticmethod
	def _insert_transaction(cursor, transaction):
		params = {
			**transaction,
			'body': Json(transaction['body']),
			'raw_payload': Json(transaction['raw_payload'])
		}
		cursor.execute(
			'''
			INSERT INTO symbol_transactions (
				hash,
				aggregate_hash,
				embedded_index,
				is_embedded,
				height,
				list_sequence,
				timestamp,
				type,
				type_name,
				signer_public_key,
				signer_address,
				recipient_address,
				target_address,
				deadline,
				network_deadline,
				max_fee,
				effective_fee,
				size,
				message_type,
				message_payload,
				body,
				raw_payload,
				updated_at
			)
			VALUES (
				%(hash)s,
				%(aggregate_hash)s,
				%(embedded_index)s,
				%(is_embedded)s,
				%(height)s,
				CASE WHEN %(is_embedded)s THEN NULL ELSE nextval('symbol_transaction_list_sequence_seq') END,
				%(timestamp)s,
				%(type)s,
				%(type_name)s,
				%(signer_public_key)s,
				%(signer_address)s,
				%(recipient_address)s,
				%(target_address)s,
				%(deadline)s,
				%(network_deadline)s,
				%(max_fee)s,
				LEAST(%(max_fee)s, %(size)s * (SELECT fee_multiplier FROM symbol_blocks WHERE height = %(height)s)),
				%(size)s,
				%(message_type)s,
				%(message_payload)s,
				%(body)s,
				%(raw_payload)s,
				CURRENT_TIMESTAMP
			)
			RETURNING id
			''',
			params)

		return cursor.fetchone()[0]

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

# pylint: disable=too-many-lines
from psycopg2.extras import Json

from puller.model.symbol.Account import ACCOUNT_TYPE_VALUES
from puller.model.symbol.Block import BLOCK_TYPE_VALUES
from puller.model.symbol.Receipt import RECEIPT_TYPE_LABELS
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

SYMBOL_RECEIPT_TYPE_VALUES = tuple(RECEIPT_TYPE_LABELS.values())
SYMBOL_RECEIPT_GROUP_VALUES = ('balanceChange', 'balanceTransfer', 'artifactExpiry', 'inflation')
SYNC_STATE_STATUS_VALUES = ('initialized', 'healthy', 'repairing', 'unhealthy')
SYMBOL_TRANSACTION_TYPE_VALUES = tuple(TRANSACTION_TYPE_LABELS.values())
SYMBOL_TRANSACTION_MOSAIC_ROLE_VALUES = ('transfer', 'hash_lock', 'secret_lock', 'revocation', 'restriction', 'definition')
SYMBOL_TRANSACTION_ADDRESS_ROLE_VALUES = ('signer', 'recipient', 'target', 'sender', 'cosignatory', 'mosaic_owner')
SYMBOL_TRANSACTION_MESSAGE_TYPE_VALUES = tuple(MESSAGE_TYPE_LABELS.values())
ACCOUNT_REFRESH_STATE_STATUS_VALUES = ('healthy', 'refreshing', 'stale', 'unhealthy')
ACCOUNT_REFRESH_STATE_COLUMNS = [
	'last_successful_run_id',
	'last_started_at',
	'last_completed_at',
	'last_completed_height',
	'last_scanned_page',
	'status',
	'last_error'
]
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
	'total_fee bigint NOT NULL',
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
	'block_reward int',
	'raw_payload jsonb NOT NULL',
	'created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP',
	'updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP'
]
SYMBOL_ACCOUNT_REFRESH_STATE_DEFINITIONS = [
	'id int PRIMARY KEY DEFAULT 1',
	'last_successful_run_id varchar',
	'last_started_at timestamp',
	'last_completed_at timestamp',
	'last_completed_height bigint',
	'last_scanned_page int',
	"status symbol_account_refresh_state_status NOT NULL DEFAULT 'healthy'",
	'last_error text',
	'updated_at timestamp DEFAULT CURRENT_TIMESTAMP',
	'CONSTRAINT symbol_account_refresh_state_singleton CHECK (id = 1)'
]
SYMBOL_ACCOUNT_DEFINITIONS = [
	'address bytea PRIMARY KEY',
	'address_text varchar(39) UNIQUE NOT NULL',
	'public_key bytea UNIQUE',
	'account_type symbol_account_type',
	'address_height bigint',
	'importance bigint NOT NULL DEFAULT 0',
	'importance_percentage numeric NOT NULL DEFAULT 0',
	'is_harvesting_active boolean',
	'is_eligible_for_harvesting boolean',
	'linked_public_key bytea',
	'node_public_key bytea',
	'vrf_public_key bytea',
	"voting_public_keys jsonb NOT NULL DEFAULT '[]'::jsonb",
	"activity_buckets jsonb NOT NULL DEFAULT '[]'::jsonb",
	'raw_payload jsonb NOT NULL',
	'first_seen_height bigint',
	'last_seen_height bigint NOT NULL',
	'updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP'
]
SYMBOL_ACCOUNT_MOSAIC_DEFINITIONS = [
	'address bytea NOT NULL REFERENCES symbol_accounts(address)',
	'mosaic_id varchar(16) NOT NULL',
	'amount bigint NOT NULL',
	'updated_at_height bigint NOT NULL',
	'PRIMARY KEY (address, mosaic_id)'
]
SYMBOL_MULTISIG_DEFINITIONS = [
	'address bytea PRIMARY KEY REFERENCES symbol_accounts(address)',
	'min_approval int NOT NULL',
	'min_removal int NOT NULL',
	"cosignatory_addresses bytea[] NOT NULL DEFAULT '{}'",
	"multisig_addresses bytea[] NOT NULL DEFAULT '{}'",
	'updated_at_height bigint NOT NULL'
]
SYMBOL_ACCOUNT_REFRESH_ACCOUNT_DEFINITIONS = [
	'refresh_run_id varchar NOT NULL',
	'address bytea NOT NULL',
	'address_text varchar(39) NOT NULL',
	'account_search_id varchar NOT NULL',
	'account_search_order bigint NOT NULL',
	'public_key bytea',
	'account_type symbol_account_type',
	'importance bigint NOT NULL',
	'importance_percentage numeric NOT NULL DEFAULT 0',
	'snapshot_height bigint NOT NULL',
	'snapshot_at timestamp NOT NULL',
	'PRIMARY KEY (refresh_run_id, address)'
]
SYMBOL_ACCOUNT_REFRESH_MOSAIC_DEFINITIONS = [
	'refresh_run_id varchar NOT NULL',
	'address bytea NOT NULL',
	'mosaic_id varchar(16) NOT NULL',
	'amount bigint NOT NULL',
	'snapshot_height bigint NOT NULL',
	'snapshot_at timestamp NOT NULL',
	'PRIMARY KEY (refresh_run_id, address, mosaic_id)'
]
SYMBOL_ACCOUNT_LIST_RANK_DEFINITIONS = [
	'refresh_run_id varchar NOT NULL',
	'rank_scope varchar NOT NULL',
	'rank bigint NOT NULL',
	'address bytea NOT NULL',
	'sort_value_numeric numeric',
	'sort_value_text text',
	'mosaic_id varchar(16)',
	'updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP',
	'PRIMARY KEY (refresh_run_id, rank_scope, rank)'
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
SYMBOL_RECEIPT_DEFINITIONS = [
	'id bigserial PRIMARY KEY',
	'height bigint NOT NULL REFERENCES symbol_blocks(height)',
	'receipt_type symbol_receipt_type NOT NULL',
	'receipt_group symbol_receipt_group NOT NULL',
	'version int NOT NULL',
	'source_primary_id bigint',
	'source_secondary_id bigint',
	'sender_address bytea',
	'recipient_address bytea',
	'target_address bytea',
	'mosaic_id varchar(16)',
	'amount bigint NOT NULL DEFAULT 0',
	'artifact_id varchar(16)',
	'raw_payload jsonb NOT NULL'
]
SYMBOL_RECEIPT_INDEXES = [
	'CREATE INDEX IF NOT EXISTS idx_symbol_receipts_height_type ON symbol_receipts(height DESC, receipt_type)',
	'CREATE INDEX IF NOT EXISTS idx_symbol_receipts_type_height ON symbol_receipts(receipt_type, height DESC)',
	'CREATE INDEX IF NOT EXISTS idx_symbol_receipts_group_height ON symbol_receipts(receipt_group, height DESC)',
	'CREATE INDEX IF NOT EXISTS idx_symbol_receipts_target ON symbol_receipts(target_address)',
	'CREATE INDEX IF NOT EXISTS idx_symbol_receipts_target_group_height ON symbol_receipts(target_address, receipt_group, height DESC)',
	'CREATE INDEX IF NOT EXISTS idx_symbol_receipts_target_type_height ON symbol_receipts(target_address, receipt_type, height DESC)',
	'CREATE INDEX IF NOT EXISTS idx_symbol_receipts_sender_group_height ON symbol_receipts(sender_address, receipt_group, height DESC)',
	'CREATE INDEX IF NOT EXISTS idx_symbol_receipts_recipient_group_height ON symbol_receipts(recipient_address, receipt_group, height DESC)',
	'CREATE INDEX IF NOT EXISTS idx_symbol_receipts_mosaic ON symbol_receipts(mosaic_id)'
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

	def create_tables(self):  # pylint: disable=too-many-statements
		"""Creates Symbol block synchronization tables."""

		cursor = self.connection.cursor()
		_create_enum_type(cursor, 'symbol_account_type', ACCOUNT_TYPE_VALUES)
		_create_enum_type(cursor, 'symbol_block_type', BLOCK_TYPE_VALUES)
		_create_enum_type(cursor, 'symbol_receipt_type', SYMBOL_RECEIPT_TYPE_VALUES)
		_create_enum_type(cursor, 'symbol_receipt_group', SYMBOL_RECEIPT_GROUP_VALUES)
		_create_enum_type(cursor, 'symbol_account_refresh_state_status', ACCOUNT_REFRESH_STATE_STATUS_VALUES)
		_create_enum_type(cursor, 'symbol_sync_state_status', SYNC_STATE_STATUS_VALUES)
		_create_enum_type(cursor, 'symbol_transaction_type', SYMBOL_TRANSACTION_TYPE_VALUES)
		_create_enum_type(cursor, 'symbol_transaction_mosaic_role', SYMBOL_TRANSACTION_MOSAIC_ROLE_VALUES)
		_create_enum_type(cursor, 'symbol_transaction_address_role', SYMBOL_TRANSACTION_ADDRESS_ROLE_VALUES)
		_create_enum_type(cursor, 'symbol_transaction_message_type', SYMBOL_TRANSACTION_MESSAGE_TYPE_VALUES)
		_create_table(cursor, 'symbol_sync_state', SYMBOL_SYNC_STATE_DEFINITIONS)
		_create_table(cursor, 'symbol_blocks', SYMBOL_BLOCK_DEFINITIONS)
		_create_table(cursor, 'symbol_account_refresh_state', SYMBOL_ACCOUNT_REFRESH_STATE_DEFINITIONS)
		_create_table(cursor, 'symbol_accounts', SYMBOL_ACCOUNT_DEFINITIONS)
		_create_table(cursor, 'symbol_account_mosaics', SYMBOL_ACCOUNT_MOSAIC_DEFINITIONS)
		_create_table(cursor, 'symbol_multisig', SYMBOL_MULTISIG_DEFINITIONS)
		_create_table(cursor, 'symbol_account_refresh_accounts', SYMBOL_ACCOUNT_REFRESH_ACCOUNT_DEFINITIONS)
		_create_table(cursor, 'symbol_account_refresh_mosaics', SYMBOL_ACCOUNT_REFRESH_MOSAIC_DEFINITIONS)
		_create_table(cursor, 'symbol_account_list_ranks', SYMBOL_ACCOUNT_LIST_RANK_DEFINITIONS)
		cursor.execute('CREATE SEQUENCE IF NOT EXISTS symbol_transaction_list_sequence_seq')
		_create_table(cursor, 'symbol_transactions', SYMBOL_TRANSACTION_DEFINITIONS)
		_create_table(cursor, 'symbol_transaction_mosaics', SYMBOL_TRANSACTION_MOSAIC_DEFINITIONS)
		_create_table(cursor, 'symbol_transaction_addresses', SYMBOL_TRANSACTION_ADDRESS_DEFINITIONS)
		_create_table(cursor, 'symbol_receipts', SYMBOL_RECEIPT_DEFINITIONS)
		cursor.execute('CREATE INDEX IF NOT EXISTS idx_symbol_blocks_height_desc ON symbol_blocks(height DESC)')
		cursor.execute('CREATE INDEX IF NOT EXISTS idx_symbol_blocks_timestamp ON symbol_blocks(timestamp)')
		cursor.execute('CREATE INDEX IF NOT EXISTS idx_symbol_blocks_signer_address ON symbol_blocks(signer_address)')
		cursor.execute('CREATE INDEX IF NOT EXISTS idx_symbol_accounts_importance_desc ON symbol_accounts(importance DESC)')
		cursor.execute('CREATE INDEX IF NOT EXISTS idx_symbol_accounts_address_height ON symbol_accounts(address_height)')
		cursor.execute('CREATE INDEX IF NOT EXISTS idx_symbol_accounts_harvesting ON symbol_accounts(is_harvesting_active)')
		cursor.execute('CREATE INDEX IF NOT EXISTS idx_symbol_accounts_eligible ON symbol_accounts(is_eligible_for_harvesting)')
		cursor.execute('CREATE INDEX IF NOT EXISTS idx_symbol_account_mosaics_address ON symbol_account_mosaics(address)')
		cursor.execute('CREATE INDEX IF NOT EXISTS idx_symbol_account_mosaics_mosaic ON symbol_account_mosaics(mosaic_id)')
		cursor.execute(
			'CREATE INDEX IF NOT EXISTS idx_symbol_account_refresh_accounts_importance_desc '
			'ON symbol_account_refresh_accounts(refresh_run_id, importance_percentage DESC, address)')
		cursor.execute(
			'CREATE INDEX IF NOT EXISTS idx_symbol_account_refresh_accounts_search_order '
			'ON symbol_account_refresh_accounts(refresh_run_id, account_search_order ASC, address)')
		cursor.execute(
			'CREATE INDEX IF NOT EXISTS idx_symbol_account_refresh_accounts_search_id '
			'ON symbol_account_refresh_accounts(refresh_run_id, account_search_id, address)')
		cursor.execute(
			'CREATE INDEX IF NOT EXISTS idx_symbol_account_refresh_accounts_address_text '
			'ON symbol_account_refresh_accounts(refresh_run_id, address_text)')
		cursor.execute(
			'CREATE INDEX IF NOT EXISTS idx_symbol_account_refresh_mosaics_mosaic_amount_desc '
			'ON symbol_account_refresh_mosaics(refresh_run_id, mosaic_id, amount DESC, address)')
		cursor.execute(
			'CREATE INDEX IF NOT EXISTS idx_symbol_account_refresh_mosaics_address '
			'ON symbol_account_refresh_mosaics(refresh_run_id, address)')
		cursor.execute(
			'CREATE INDEX IF NOT EXISTS idx_symbol_account_list_ranks_page '
			'ON symbol_account_list_ranks(refresh_run_id, rank_scope, rank)')
		cursor.execute(
			'CREATE INDEX IF NOT EXISTS idx_symbol_account_list_ranks_address '
			'ON symbol_account_list_ranks(refresh_run_id, rank_scope, address)')
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
		for index_sql in SYMBOL_RECEIPT_INDEXES:
			cursor.execute(index_sql)
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

	def get_account_refresh_state(self):
		"""Gets the singleton Symbol account refresh state."""

		cursor = self.connection.cursor()
		cursor.execute(f'SELECT {", ".join(ACCOUNT_REFRESH_STATE_COLUMNS)} FROM symbol_account_refresh_state WHERE id = 1')
		result = cursor.fetchone()

		return dict(zip(ACCOUNT_REFRESH_STATE_COLUMNS, result)) if result else None

	def upsert_account_refresh_state(self, refresh_state):
		"""Upserts supplied fields on the singleton Symbol account refresh state."""

		cursor = self.connection.cursor()
		self._execute_upsert_account_refresh_state(cursor, refresh_state)
		self.connection.commit()

	@staticmethod
	def _execute_upsert_account_refresh_state(cursor, refresh_state):
		columns = list(refresh_state.keys())
		column_names = ', '.join(columns)
		value_placeholders = ', '.join([f'%({column})s' for column in columns])
		update_assignments = ', '.join([f'{column} = EXCLUDED.{column}' for column in columns])

		cursor.execute(
			f'''
			INSERT INTO symbol_account_refresh_state (id, {column_names}, updated_at)
			VALUES (1, {value_placeholders}, CURRENT_TIMESTAMP)
			ON CONFLICT (id) DO UPDATE SET
				{update_assignments},
				updated_at = CURRENT_TIMESTAMP
			''',
			refresh_state)

	def get_recently_harvesting_addresses(self, cutoff_timestamp):
		"""Gets distinct beneficiary addresses that harvested blocks at or after the cutoff timestamp."""

		cursor = self.connection.cursor()
		cursor.execute(
			'''
			SELECT DISTINCT beneficiary_address
			FROM symbol_blocks
			WHERE timestamp >= %s
			''',
			(cutoff_timestamp,))

		return {bytes(row[0]) for row in cursor.fetchall()}

	def upsert_account_current_state(
		self,
		account_row,
		mosaic_rows,
		overwrite_is_harvesting_active=True
	):
		"""Upserts one Symbol account current-state row and replaces its current mosaic rows."""

		cursor = self.connection.cursor()
		self._execute_upsert_account_current_state(
			cursor,
			account_row,
			mosaic_rows,
			overwrite_is_harvesting_active)
		self.connection.commit()

	@staticmethod
	def _execute_upsert_account_current_state(
		cursor,
		account_row,
		mosaic_rows,
		overwrite_is_harvesting_active=True
	):
		update_columns = [
			'address_text',
			'public_key',
			'account_type',
			'address_height',
			'importance',
			'is_eligible_for_harvesting',
			'linked_public_key',
			'node_public_key',
			'vrf_public_key',
			'voting_public_keys',
			'activity_buckets',
			'raw_payload',
			'last_seen_height'
		]
		if overwrite_is_harvesting_active:
			update_columns.append('is_harvesting_active')

		update_assignments = ', '.join([f'{column} = EXCLUDED.{column}' for column in update_columns])
		cursor.execute(
			f'''
			INSERT INTO symbol_accounts (
				address,
				address_text,
				public_key,
				account_type,
				address_height,
				importance,
				importance_percentage,
				is_harvesting_active,
				is_eligible_for_harvesting,
				linked_public_key,
				node_public_key,
				vrf_public_key,
				voting_public_keys,
				activity_buckets,
				raw_payload,
				first_seen_height,
				last_seen_height,
				updated_at
			)
			VALUES (
				%(address)s,
				%(address_text)s,
				%(public_key)s,
				%(account_type)s,
				%(address_height)s,
				%(importance)s,
				%(importance_percentage)s,
				%(is_harvesting_active)s,
				%(is_eligible_for_harvesting)s,
				%(linked_public_key)s,
				%(node_public_key)s,
				%(vrf_public_key)s,
				%(voting_public_keys)s,
				%(activity_buckets)s,
				%(raw_payload)s,
				%(first_seen_height)s,
				%(last_seen_height)s,
				CURRENT_TIMESTAMP
			)
			ON CONFLICT (address) DO UPDATE SET
				{update_assignments},
				first_seen_height = COALESCE(symbol_accounts.first_seen_height, EXCLUDED.first_seen_height),
				updated_at = CURRENT_TIMESTAMP
			''',
			account_row)
		cursor.execute('DELETE FROM symbol_account_mosaics WHERE address = %s', (account_row['address'],))
		for mosaic_row in mosaic_rows:
			cursor.execute(
				'''
				INSERT INTO symbol_account_mosaics (
					address,
					mosaic_id,
					amount,
					updated_at_height
				)
				VALUES (
					%(address)s,
					%(mosaic_id)s,
					%(amount)s,
					%(updated_at_height)s
				)
				''',
				mosaic_row)

	def upsert_multisig(self, address, multisig_row_or_none):
		"""Upserts or deletes one Symbol multisig current-state row."""

		cursor = self.connection.cursor()
		if multisig_row_or_none is None:
			cursor.execute('DELETE FROM symbol_multisig WHERE address = %s', (address,))
			self.connection.commit()
			return

		cursor.execute(
			'''
			INSERT INTO symbol_multisig (
				address,
				min_approval,
				min_removal,
				cosignatory_addresses,
				multisig_addresses,
				updated_at_height
			)
			VALUES (
				%(address)s,
				%(min_approval)s,
				%(min_removal)s,
				%(cosignatory_addresses)s,
				%(multisig_addresses)s,
				%(updated_at_height)s
			)
			ON CONFLICT (address) DO UPDATE SET
				min_approval = EXCLUDED.min_approval,
				min_removal = EXCLUDED.min_removal,
				cosignatory_addresses = EXCLUDED.cosignatory_addresses,
				multisig_addresses = EXCLUDED.multisig_addresses,
				updated_at_height = EXCLUDED.updated_at_height
			''',
			multisig_row_or_none)
		self.connection.commit()

	def insert_account_refresh_snapshot_rows(  # pylint: disable=too-many-arguments,too-many-positional-arguments
		self,
		refresh_run_id,
		account_search_id,
		account_search_order,
		account_row,
		mosaic_rows,
		snapshot_height,
		snapshot_at
	):
		"""Inserts or replaces one account's immutable refresh snapshot rows for a run."""

		cursor = self.connection.cursor()
		self._execute_insert_account_refresh_snapshot_rows(
			cursor,
			refresh_run_id,
			account_search_id,
			account_search_order,
			account_row,
			mosaic_rows,
			snapshot_height,
			snapshot_at)
		self.connection.commit()

	@staticmethod
	def _execute_insert_account_refresh_snapshot_rows(  # pylint: disable=too-many-arguments,too-many-positional-arguments
		cursor,
		refresh_run_id,
		account_search_id,
		account_search_order,
		account_row,
		mosaic_rows,
		snapshot_height,
		snapshot_at
	):
		cursor.execute(
			'''
			INSERT INTO symbol_account_refresh_accounts (
				refresh_run_id,
				address,
				address_text,
				account_search_id,
				account_search_order,
				public_key,
				account_type,
				importance,
				importance_percentage,
				snapshot_height,
				snapshot_at
			)
			VALUES (
				%(refresh_run_id)s,
				%(address)s,
				%(address_text)s,
				%(account_search_id)s,
				%(account_search_order)s,
				%(public_key)s,
				%(account_type)s,
				%(importance)s,
				%(importance_percentage)s,
				%(snapshot_height)s,
				%(snapshot_at)s
			)
			ON CONFLICT (refresh_run_id, address) DO UPDATE SET
				address_text = EXCLUDED.address_text,
				account_search_id = EXCLUDED.account_search_id,
				account_search_order = EXCLUDED.account_search_order,
				public_key = EXCLUDED.public_key,
				account_type = EXCLUDED.account_type,
				importance = EXCLUDED.importance,
				importance_percentage = EXCLUDED.importance_percentage,
				snapshot_height = EXCLUDED.snapshot_height,
				snapshot_at = EXCLUDED.snapshot_at
			''',
			{
				**account_row,
				'refresh_run_id': refresh_run_id,
				'account_search_id': account_search_id,
				'account_search_order': account_search_order,
				'snapshot_height': snapshot_height,
				'snapshot_at': snapshot_at
			})
		cursor.execute(
			'''
			DELETE FROM symbol_account_refresh_mosaics
			WHERE refresh_run_id = %s AND address = %s
			''',
			(refresh_run_id, account_row['address']))
		for mosaic_row in mosaic_rows:
			cursor.execute(
				'''
				INSERT INTO symbol_account_refresh_mosaics (
					refresh_run_id,
					address,
					mosaic_id,
					amount,
					snapshot_height,
					snapshot_at
				)
				VALUES (
					%(refresh_run_id)s,
					%(address)s,
					%(mosaic_id)s,
					%(amount)s,
					%(snapshot_height)s,
					%(snapshot_at)s
				)
				''',
				{
					**mosaic_row,
					'refresh_run_id': refresh_run_id,
					'snapshot_height': snapshot_height,
					'snapshot_at': snapshot_at
				})

	def upsert_account_refresh_page(self, account_entries, last_scanned_page):
		"""Upserts one account refresh page's current-state rows, snapshot rows, and diagnostic cursor in one transaction."""

		cursor = self.connection.cursor()
		for entry in account_entries:
			self._execute_upsert_account_current_state(
				cursor,
				entry['account_row'],
				entry['mosaic_rows'],
				overwrite_importance_percentage=False,
				overwrite_is_harvesting_active=True)
			self._execute_insert_account_refresh_snapshot_rows(
				cursor,
				entry['refresh_run_id'],
				entry['account_search_id'],
				entry['account_search_order'],
				entry['account_row'],
				entry['mosaic_rows'],
				entry['snapshot_height'],
				entry['snapshot_at'])
		self._execute_upsert_account_refresh_state(cursor, {'last_scanned_page': last_scanned_page})
		self.connection.commit()

	def update_account_importance_rates(self, refresh_run_id):
		"""Updates snapshot and current-state importance percentages for a completed account refresh run."""

		cursor = self.connection.cursor()
		cursor.execute(
			'''
			SELECT COALESCE(SUM(importance), 0)
			FROM symbol_account_refresh_accounts
			WHERE refresh_run_id = %s
			''',
			(refresh_run_id,))
		total_importance = cursor.fetchone()[0]
		cursor.execute(
			'''
			UPDATE symbol_account_refresh_accounts
			SET importance_percentage = CASE
				WHEN %s = 0 THEN 0
				ELSE importance::numeric / %s::numeric
			END
			WHERE refresh_run_id = %s
			''',
			(total_importance, total_importance, refresh_run_id))
		cursor.execute(
			'''
			UPDATE symbol_accounts
			SET importance_percentage = snapshot.importance_percentage,
				updated_at = CURRENT_TIMESTAMP
			FROM symbol_account_refresh_accounts snapshot
			WHERE symbol_accounts.address = snapshot.address
				AND snapshot.refresh_run_id = %s
			''',
			(refresh_run_id,))
		self.connection.commit()

	def rebuild_account_list_ranks(self, refresh_run_id, native_mosaic_id):
		"""Rebuilds account list rank scopes for one account refresh run."""

		cursor = self.connection.cursor()
		cursor.execute('DELETE FROM symbol_account_list_ranks WHERE refresh_run_id = %s', (refresh_run_id,))
		cursor.execute(
			'''
			INSERT INTO symbol_account_list_ranks (
				refresh_run_id,
				rank_scope,
				rank,
				address,
				sort_value_numeric,
				sort_value_text,
				mosaic_id
			)
			SELECT
				refresh_run_id,
				'ID',
				ROW_NUMBER() OVER (ORDER BY account_search_order ASC, address) - 1,
				address,
				NULL,
				account_search_id,
				NULL
			FROM symbol_account_refresh_accounts
			WHERE refresh_run_id = %s
			''',
			(refresh_run_id,))
		cursor.execute(
			'''
			INSERT INTO symbol_account_list_ranks (
				refresh_run_id,
				rank_scope,
				rank,
				address,
				sort_value_numeric,
				sort_value_text,
				mosaic_id
			)
			SELECT
				refresh_run_id,
				'IMPORTANCE',
				ROW_NUMBER() OVER (ORDER BY importance_percentage DESC, address) - 1,
				address,
				importance_percentage,
				NULL,
				NULL
			FROM symbol_account_refresh_accounts
			WHERE refresh_run_id = %s
			''',
			(refresh_run_id,))
		cursor.execute(
			'''
			INSERT INTO symbol_account_list_ranks (
				refresh_run_id,
				rank_scope,
				rank,
				address,
				sort_value_numeric,
				sort_value_text,
				mosaic_id
			)
			SELECT
				refresh_run_id,
				%s,
				ROW_NUMBER() OVER (ORDER BY amount DESC, address) - 1,
				address,
				amount,
				NULL,
				%s
			FROM symbol_account_refresh_mosaics
			WHERE refresh_run_id = %s AND mosaic_id = %s
			''',
			(f'BALANCE:{native_mosaic_id}', native_mosaic_id, refresh_run_id, native_mosaic_id))
		self.connection.commit()

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
		self._delete_rollback_affected_rows_from_height(cursor, height)
		self._stale_mark_account_refresh_state_if_needed(cursor, height)
		self.connection.commit()

	def repair_rollback_from_height(self, height, sync_state):
		"""Deletes rollbacked blocks and updates sync state in one transaction."""

		cursor = self.connection.cursor()
		self._delete_rollback_affected_rows_from_height(cursor, height)
		self._stale_mark_account_refresh_state_if_needed(cursor, height)
		self._execute_upsert_sync_state(cursor, sync_state)
		self.connection.commit()

	@staticmethod
	def _delete_rollback_affected_rows_from_height(cursor, height):
		cursor.execute('DELETE FROM symbol_transaction_mosaics WHERE height >= %s', (height,))
		cursor.execute('DELETE FROM symbol_transaction_addresses WHERE height >= %s', (height,))
		cursor.execute('DELETE FROM symbol_transactions WHERE height >= %s', (height,))
		cursor.execute('DELETE FROM symbol_receipts WHERE height >= %s', (height,))
		cursor.execute('DELETE FROM symbol_blocks WHERE height >= %s', (height,))
		cursor.execute('DELETE FROM symbol_multisig WHERE updated_at_height >= %s', (height,))
		cursor.execute('DELETE FROM symbol_account_mosaics WHERE updated_at_height >= %s', (height,))
		cursor.execute('DELETE FROM symbol_accounts WHERE last_seen_height >= %s', (height,))

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

	def upsert_receipts_for_height(self, height, receipts, block_reward):
		"""Replaces receipts for a height and updates its block reward."""

		cursor = self.connection.cursor()
		cursor.execute('DELETE FROM symbol_receipts WHERE height = %s', (height,))
		for receipt in receipts:
			cursor.execute(
				'''
				INSERT INTO symbol_receipts (
					height,
					receipt_type,
					receipt_group,
					version,
					source_primary_id,
					source_secondary_id,
					sender_address,
					recipient_address,
					target_address,
					mosaic_id,
					amount,
					artifact_id,
					raw_payload
				)
				VALUES (
					%(height)s,
					%(receipt_type)s,
					%(receipt_group)s,
					%(version)s,
					%(source_primary_id)s,
					%(source_secondary_id)s,
					%(sender_address)s,
					%(recipient_address)s,
					%(target_address)s,
					%(mosaic_id)s,
					%(amount)s,
					%(artifact_id)s,
					%(raw_payload)s
				)
				''',
				{**receipt, 'raw_payload': Json(receipt['raw_payload'])})
		cursor.execute(
			'UPDATE symbol_blocks SET block_reward = %s, updated_at = CURRENT_TIMESTAMP WHERE height = %s',
			(block_reward, height))
		self.connection.commit()

	@staticmethod
	def _stale_mark_account_refresh_state_if_needed(cursor, fork_height):
		cursor.execute(
			'''
			UPDATE symbol_account_refresh_state
			SET status = 'stale',
				updated_at = CURRENT_TIMESTAMP
			WHERE id = 1 AND last_completed_height >= %s AND status != 'stale'
			''',
			(fork_height,))

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

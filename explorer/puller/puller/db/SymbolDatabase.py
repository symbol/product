# pylint: disable=too-many-lines
import threading
import time
from collections import namedtuple
from contextlib import contextmanager

from common.symbol.ReceiptTypes import RECEIPT_TYPE_LABELS
from common.symbol.Transaction import MESSAGE_TYPE_LABELS
from psycopg2 import Error as PsycopgError
from psycopg2 import errorcodes, sql
from psycopg2.extras import Json
from zenlog import log

from puller.model.symbol.Account import ACCOUNT_TYPE_VALUES
from puller.model.symbol.Block import BLOCK_TYPE_VALUES
from puller.model.symbol.Lock import LOCK_HASH_ALGORITHM_LABELS, LOCK_STATUS_LABELS, create_hash_lock_key, create_secret_lock_search_key
from puller.model.symbol.Metadata import (
	METADATA_TRANSACTION_TYPE_LABELS,
	METADATA_TYPE_LABELS,
	canonical_metadata_hex,
	canonical_metadata_key,
	metadata_target_from_relations
)
from puller.model.symbol.MosaicRestriction import (
	MOSAIC_RESTRICTION_ENTRY_TYPE_BY_TRANSACTION_TYPE,
	MosaicRestrictionEntryType,
	MosaicRestrictionKey,
	create_mosaic_restriction_key,
	mosaic_restriction_entry_type_label
)
from puller.model.symbol.Namespace import NAMESPACE_ALIAS_TYPE_LABELS, NAMESPACE_REGISTRATION_TYPE_LABELS
from puller.model.symbol.Transaction import TRANSACTION_TYPE_LABELS

from .AccountRetentionConfiguration import (
	ACCOUNT_RETENTION_TIME_BUDGET_SECONDS,
	DEFAULT_ACCOUNT_RETENTION_CONFIGURATION,
	AccountRetentionConfiguration
)
from .DatabaseConnection import DatabaseConnection

RollbackRefreshEntries = namedtuple(
	'RollbackRefreshEntries',
	['namespace_entries', 'mosaic_entries', 'metadata_entries', 'hash_lock_entries', 'secret_lock_entries',
		'mosaic_restriction_entries'],
	defaults=((), (), (), (), (), ()))


class AccountRetentionTimeLimit(Exception):
	"""Indicates that the current bounded retention pass reached its deadline."""


SYNC_STATE_COLUMNS = [
	'status',
	'chain_height',
	'finalized_height',
	'finalized_hash',
	'finalized_epoch',
	'finalized_point',
	'last_synced_height',
	'last_synced_block_hash',
	'dirty_state_from_height'
]

SYMBOL_RECEIPT_TYPE_VALUES = tuple(RECEIPT_TYPE_LABELS.values())
SYMBOL_RECEIPT_GROUP_VALUES = ('balanceChange', 'balanceTransfer', 'artifactExpiry', 'inflation')
SYNC_STATE_STATUS_VALUES = ('initialized', 'healthy', 'repairing', 'unhealthy')
SYMBOL_TRANSACTION_TYPE_VALUES = tuple(TRANSACTION_TYPE_LABELS.values())
SYMBOL_TRANSACTION_MOSAIC_ROLE_VALUES = (
	'transfer',
	'hash_lock',
	'secret_lock',
	'revocation',
	'restriction',
	'definition',
	'metadata_target'
)
SYMBOL_TRANSACTION_ADDRESS_ROLE_VALUES = ('signer', 'recipient', 'target', 'sender', 'cosignatory', 'mosaic_owner')
SYMBOL_TRANSACTION_MESSAGE_TYPE_VALUES = tuple(MESSAGE_TYPE_LABELS.values())
SYMBOL_NAMESPACE_REGISTRATION_TYPE_VALUES = tuple(NAMESPACE_REGISTRATION_TYPE_LABELS.values())
SYMBOL_NAMESPACE_ALIAS_TYPE_VALUES = tuple(NAMESPACE_ALIAS_TYPE_LABELS.values())
SYMBOL_ALIAS_ARTIFACT_TYPE_VALUES = ('mosaic', 'namespace', 'account')
SYMBOL_METADATA_TYPE_VALUES = tuple(METADATA_TYPE_LABELS.values())
SYMBOL_MOSAIC_RESTRICTION_ENTRY_TYPE_VALUES = tuple(entry_type.value for entry_type in MosaicRestrictionEntryType)
SYMBOL_LOCK_STATUS_VALUES = tuple(LOCK_STATUS_LABELS.values())
SYMBOL_LOCK_HASH_ALGORITHM_VALUES = tuple(LOCK_HASH_ALGORITHM_LABELS.values())
ACCOUNT_REFRESH_STATE_STATUS_VALUES = ('healthy', 'refreshing', 'stale', 'unhealthy')
ACCOUNT_RETENTION_BATCH_SIZE = 5000
ACCOUNT_RETENTION_MIN_BATCH_SIZE = 500
ACCOUNT_RETENTION_MAX_BATCHES = 20
SYMBOL_WORKFLOW_LOCK_KEY = (0x53594D42, 0x41434354)
ACCOUNT_REFRESH_STATE_COLUMNS = [
	'last_successful_run_id',
	'previous_successful_run_id',
	'running_run_id',
	'is_retention_ready',
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
	'dirty_state_from_height bigint',
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
	'previous_successful_run_id varchar',
	'running_run_id varchar',
	'is_retention_ready boolean NOT NULL DEFAULT false',
	'CONSTRAINT symbol_account_refresh_state_singleton CHECK (id = 1)'
]
ACCOUNT_REFRESH_STATE_INDEXES = [
	'CREATE INDEX IF NOT EXISTS idx_symbol_account_refresh_state_last_successful_run_id '
	'ON symbol_account_refresh_state(last_successful_run_id)',
	'CREATE INDEX IF NOT EXISTS idx_symbol_account_refresh_state_last_completed_height '
	'ON symbol_account_refresh_state(last_completed_height)',
	'CREATE INDEX IF NOT EXISTS idx_symbol_account_refresh_state_status '
	'ON symbol_account_refresh_state(status)'
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
	'account_search_order bigint NOT NULL',
	'public_key bytea',
	'account_type symbol_account_type',
	'importance bigint NOT NULL',
	'importance_percentage numeric NOT NULL DEFAULT 0',
	'snapshot_height bigint NOT NULL',
	'snapshot_at timestamp NOT NULL',
	'PRIMARY KEY (refresh_run_id, address)'
]
SYMBOL_ACCOUNT_REFRESH_MOSAIC_FOREIGN_KEY_NAME = 'symbol_account_refresh_mosaics_account_fk'
SYMBOL_ACCOUNT_REFRESH_MOSAIC_DEFINITIONS = [
	'refresh_run_id varchar NOT NULL',
	'address bytea NOT NULL',
	'mosaic_id varchar(16) NOT NULL',
	'amount bigint NOT NULL',
	'snapshot_height bigint NOT NULL',
	'snapshot_at timestamp NOT NULL',
	'PRIMARY KEY (refresh_run_id, address, mosaic_id)',
	f'CONSTRAINT {SYMBOL_ACCOUNT_REFRESH_MOSAIC_FOREIGN_KEY_NAME} '
	'FOREIGN KEY (refresh_run_id, address) REFERENCES symbol_account_refresh_accounts(refresh_run_id, address)'
]
SYMBOL_ACCOUNT_LIST_RANK_DEFINITIONS = [
	'refresh_run_id varchar NOT NULL',
	'rank_scope varchar NOT NULL',
	'rank bigint NOT NULL',
	'address bytea NOT NULL',
	'sort_value_numeric numeric',
	'mosaic_id varchar(16)',
	'updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP',
	'PRIMARY KEY (refresh_run_id, rank_scope, rank)'
]
ACCOUNT_REFRESH_INDEXES = [
	'CREATE INDEX IF NOT EXISTS idx_symbol_account_refresh_accounts_importance_desc '
	'ON symbol_account_refresh_accounts(refresh_run_id, importance_percentage DESC, address)',
	'CREATE INDEX IF NOT EXISTS idx_symbol_account_refresh_accounts_search_order '
	'ON symbol_account_refresh_accounts(refresh_run_id, account_search_order ASC, address)',
	'CREATE INDEX IF NOT EXISTS idx_symbol_account_refresh_accounts_address_text '
	'ON symbol_account_refresh_accounts(refresh_run_id, address_text)',
	'CREATE INDEX IF NOT EXISTS idx_symbol_account_refresh_mosaics_mosaic_amount_desc '
	'ON symbol_account_refresh_mosaics(refresh_run_id, mosaic_id, amount DESC, address)',
	'CREATE INDEX IF NOT EXISTS idx_symbol_account_refresh_mosaics_address '
	'ON symbol_account_refresh_mosaics(refresh_run_id, address)',
	'CREATE INDEX IF NOT EXISTS idx_symbol_account_list_ranks_address '
	'ON symbol_account_list_ranks(refresh_run_id, rank_scope, address)'
]
SYMBOL_NAMESPACE_DEFINITIONS = [
	'namespace_id varchar(16) PRIMARY KEY',
	'parent_id varchar(16)',
	'root_id varchar(16) NOT NULL',
	'name varchar',
	'full_name varchar UNIQUE',
	'depth int NOT NULL',
	'registration_type symbol_namespace_registration_type NOT NULL',
	'owner_address bytea NOT NULL',
	'start_height bigint NOT NULL',
	'end_height bigint',
	'alias_type symbol_namespace_alias_type NOT NULL',
	'alias_mosaic_id varchar(16)',
	'alias_address bytea',
	'raw_payload jsonb NOT NULL',
	'updated_at_height bigint NOT NULL'
]
SYMBOL_ALIAS_NAME_DEFINITIONS = [
	'artifact_type symbol_alias_artifact_type NOT NULL',
	'artifact_id varchar NOT NULL',
	'name varchar NOT NULL',
	'updated_at_height bigint NOT NULL',
	'UNIQUE (artifact_type, artifact_id, name)'
]
SYMBOL_NAMESPACE_INDEXES = [
	'CREATE INDEX IF NOT EXISTS idx_symbol_namespaces_registration_height '
	'ON symbol_namespaces(start_height DESC, namespace_id)',
	'CREATE INDEX IF NOT EXISTS idx_symbol_namespaces_owner_height '
	'ON symbol_namespaces(owner_address, start_height DESC)',
	'CREATE INDEX IF NOT EXISTS idx_symbol_namespaces_alias_height '
	'ON symbol_namespaces(alias_type, start_height DESC)',
	'CREATE INDEX IF NOT EXISTS idx_symbol_namespaces_alias_registration_height '
	'ON symbol_namespaces(alias_type, registration_type, start_height DESC)',
	'CREATE INDEX IF NOT EXISTS idx_symbol_namespaces_parent ON symbol_namespaces(parent_id)',
	'CREATE INDEX IF NOT EXISTS idx_symbol_namespaces_root ON symbol_namespaces(root_id)',
	'CREATE INDEX IF NOT EXISTS idx_symbol_namespaces_name ON symbol_namespaces(name)',
	'CREATE INDEX IF NOT EXISTS idx_symbol_namespaces_end_height ON symbol_namespaces(end_height)',
	'CREATE INDEX IF NOT EXISTS idx_symbol_namespaces_registration ON symbol_namespaces(registration_type)',
	'CREATE INDEX IF NOT EXISTS idx_symbol_namespaces_alias_mosaic ON symbol_namespaces(alias_mosaic_id)',
	'CREATE INDEX IF NOT EXISTS idx_symbol_namespaces_alias_address ON symbol_namespaces(alias_address)',
	'CREATE INDEX IF NOT EXISTS idx_symbol_namespaces_updated_height ON symbol_namespaces(updated_at_height)',
	'CREATE INDEX IF NOT EXISTS idx_symbol_alias_names_artifact_id ON symbol_alias_names(artifact_id)',
	'CREATE INDEX IF NOT EXISTS idx_symbol_alias_names_name ON symbol_alias_names(name)',
	'CREATE INDEX IF NOT EXISTS idx_symbol_alias_names_updated_height ON symbol_alias_names(updated_at_height)'
]
SYMBOL_MOSAIC_DEFINITIONS = [
	'mosaic_id varchar(16) PRIMARY KEY',
	'owner_address bytea NOT NULL',
	'start_height bigint NOT NULL',
	'duration bigint NOT NULL',
	'expiration_height bigint',
	'supply bigint NOT NULL',
	'divisibility int NOT NULL',
	'flags int NOT NULL',
	'supply_mutable boolean NOT NULL',
	'transferable boolean NOT NULL',
	'restrictable boolean NOT NULL',
	'revokable boolean NOT NULL',
	"alias_names jsonb NOT NULL DEFAULT '[]'::jsonb",
	'raw_payload jsonb NOT NULL',
	'updated_at_height bigint NOT NULL'
]
SYMBOL_METADATA_DEFINITIONS = [
	'composite_hash bytea PRIMARY KEY',
	'metadata_type symbol_metadata_type NOT NULL',
	'scoped_metadata_key varchar NOT NULL',
	'source_address bytea NOT NULL',
	'target_address bytea',
	'target_id varchar(16)',
	'value_hex text NOT NULL',
	'value_utf8 text NOT NULL',
	'raw_payload jsonb NOT NULL',
	'updated_at_height bigint NOT NULL'
]
MOSAIC_ALIAS_NAMES_SUBQUERY = '''
(
	SELECT COALESCE(jsonb_agg(name ORDER BY name), '[]'::jsonb)
	FROM symbol_alias_names
	WHERE artifact_type = 'mosaic' AND artifact_id = %(mosaic_id)s
)
'''
SYMBOL_MOSAIC_INDEXES = [
	'CREATE INDEX IF NOT EXISTS idx_symbol_mosaics_start_height_desc ON symbol_mosaics(start_height DESC, mosaic_id)',
	'CREATE INDEX IF NOT EXISTS idx_symbol_mosaics_owner ON symbol_mosaics(owner_address)',
	'CREATE INDEX IF NOT EXISTS idx_symbol_mosaics_expiration ON symbol_mosaics(expiration_height)',
	'CREATE INDEX IF NOT EXISTS idx_symbol_mosaics_supply ON symbol_mosaics(supply)',
	'CREATE INDEX IF NOT EXISTS idx_symbol_mosaics_supply_mutable ON symbol_mosaics(supply_mutable)',
	'CREATE INDEX IF NOT EXISTS idx_symbol_mosaics_transferable ON symbol_mosaics(transferable)',
	'CREATE INDEX IF NOT EXISTS idx_symbol_mosaics_restrictable ON symbol_mosaics(restrictable)',
	'CREATE INDEX IF NOT EXISTS idx_symbol_mosaics_revokable ON symbol_mosaics(revokable)',
	'CREATE INDEX IF NOT EXISTS idx_symbol_mosaics_updated_height ON symbol_mosaics(updated_at_height)'
]
SYMBOL_METADATA_INDEXES = [
	'CREATE INDEX IF NOT EXISTS idx_symbol_metadata_target_address_height '
	'ON symbol_metadata(target_address, updated_at_height DESC)',
	'CREATE INDEX IF NOT EXISTS idx_symbol_metadata_type ON symbol_metadata(metadata_type)',
	'CREATE INDEX IF NOT EXISTS idx_symbol_metadata_scoped_key ON symbol_metadata(scoped_metadata_key)',
	'CREATE INDEX IF NOT EXISTS idx_symbol_metadata_source ON symbol_metadata(source_address)',
	'CREATE INDEX IF NOT EXISTS idx_symbol_metadata_target_id ON symbol_metadata(target_id)',
	'CREATE INDEX IF NOT EXISTS idx_symbol_metadata_updated_height ON symbol_metadata(updated_at_height)'
]
SYMBOL_MOSAIC_RESTRICTION_DEFINITIONS = [
	'composite_hash bytea PRIMARY KEY',
	'entry_type symbol_mosaic_restriction_entry_type NOT NULL',
	'mosaic_id varchar(16) NOT NULL',
	'target_address bytea',
	'restrictions jsonb NOT NULL',
	'raw_payload jsonb NOT NULL',
	'updated_at_height bigint NOT NULL',
	'CONSTRAINT symbol_mosaic_restrictions_target_address_consistency '
	"CHECK ((entry_type = 'address' AND target_address IS NOT NULL) OR "
	"(entry_type = 'global' AND target_address IS NULL))",
	'CONSTRAINT symbol_mosaic_restrictions_logical_key_unique '
	'UNIQUE NULLS NOT DISTINCT (mosaic_id, entry_type, target_address)'
]
SYMBOL_MOSAIC_RESTRICTION_INDEXES = [
	'CREATE INDEX IF NOT EXISTS idx_symbol_mosaic_restrictions_entry_type '
	'ON symbol_mosaic_restrictions(entry_type)',
	'CREATE INDEX IF NOT EXISTS idx_symbol_mosaic_restrictions_target_address '
	'ON symbol_mosaic_restrictions(target_address)',
	'CREATE INDEX IF NOT EXISTS idx_symbol_mosaic_restrictions_updated_height '
	'ON symbol_mosaic_restrictions(updated_at_height)'
]
SYMBOL_HASH_LOCK_DEFINITIONS = [
	'hash bytea PRIMARY KEY',
	'owner_address bytea NOT NULL',
	'mosaic_id varchar(16) NOT NULL',
	'amount bigint NOT NULL',
	'end_height bigint NOT NULL',
	'status symbol_lock_status NOT NULL',
	'raw_payload jsonb NOT NULL',
	'updated_at_height bigint NOT NULL'
]
SYMBOL_SECRET_LOCK_DEFINITIONS = [
	'composite_hash bytea PRIMARY KEY',
	'owner_address bytea NOT NULL',
	'recipient_address bytea NOT NULL',
	'secret bytea NOT NULL',
	'hash_algorithm symbol_lock_hash_algorithm NOT NULL',
	'mosaic_id varchar(16) NOT NULL',
	'amount bigint NOT NULL',
	'end_height bigint NOT NULL',
	'status symbol_lock_status NOT NULL',
	'raw_payload jsonb NOT NULL',
	'updated_at_height bigint NOT NULL'
]
SYMBOL_LOCK_INDEXES = [
	'CREATE INDEX IF NOT EXISTS idx_symbol_hash_locks_owner_end_height '
	'ON symbol_hash_locks(owner_address, end_height DESC, hash DESC)',
	'CREATE INDEX IF NOT EXISTS idx_symbol_hash_locks_mosaic_end_height '
	'ON symbol_hash_locks(mosaic_id, end_height DESC, hash DESC)',
	'CREATE INDEX IF NOT EXISTS idx_symbol_hash_locks_status_end_height '
	'ON symbol_hash_locks(status, end_height DESC, hash DESC)',
	'CREATE INDEX IF NOT EXISTS idx_symbol_hash_locks_end_height '
	'ON symbol_hash_locks(end_height DESC, hash DESC)',
	'CREATE INDEX IF NOT EXISTS idx_symbol_hash_locks_updated_at_height '
	'ON symbol_hash_locks(updated_at_height)',
	'CREATE INDEX IF NOT EXISTS idx_symbol_secret_locks_owner_end_height '
	'ON symbol_secret_locks(owner_address, end_height DESC, composite_hash DESC)',
	'CREATE INDEX IF NOT EXISTS idx_symbol_secret_locks_recipient_end_height '
	'ON symbol_secret_locks(recipient_address, end_height DESC, composite_hash DESC)',
	'CREATE INDEX IF NOT EXISTS idx_symbol_secret_locks_mosaic_end_height '
	'ON symbol_secret_locks(mosaic_id, end_height DESC, composite_hash DESC)',
	'CREATE INDEX IF NOT EXISTS idx_symbol_secret_locks_status_end_height '
	'ON symbol_secret_locks(status, end_height DESC, composite_hash DESC)',
	'CREATE INDEX IF NOT EXISTS idx_symbol_secret_locks_hash_algorithm_end_height '
	'ON symbol_secret_locks(hash_algorithm, end_height DESC, composite_hash DESC)',
	'CREATE INDEX IF NOT EXISTS idx_symbol_secret_locks_end_height '
	'ON symbol_secret_locks(end_height DESC, composite_hash DESC)',
	'CREATE INDEX IF NOT EXISTS idx_symbol_secret_locks_updated_at_height '
	'ON symbol_secret_locks(updated_at_height)',
	'CREATE INDEX IF NOT EXISTS idx_symbol_secret_locks_search '
	'ON symbol_secret_locks(secret, recipient_address, hash_algorithm, owner_address)'
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


class SymbolDatabase(DatabaseConnection):  # pylint: disable=too-many-public-methods
	"""Database containing Symbol blockchain data."""

	def __init__(  # pylint: disable=too-many-arguments,too-many-positional-arguments
		self, db_config, commit_observer=None, time_source=time.monotonic, retention_config=None,
		retention_time_source=None, retention_time_budget_seconds=ACCOUNT_RETENTION_TIME_BUDGET_SECONDS, retention_logger=log
	):
		"""Creates a Symbol database wrapper with an optional commit observation hook."""

		super().__init__(db_config)
		self._commit_observer = commit_observer
		self._time_source = time_source
		self.retention_config = (
			DEFAULT_ACCOUNT_RETENTION_CONFIGURATION if retention_config is None else AccountRetentionConfiguration(*retention_config))
		self._retention_time_source = time.monotonic if retention_time_source is None else retention_time_source
		self._retention_time_budget_seconds = retention_time_budget_seconds
		self._retention_logger = retention_logger
		self._workflow_guard = threading.Lock()

	def _commit(self):
		started_at = self._read_commit_time()
		try:
			self.connection.commit()
		except Exception:
			self._notify_commit_observer(started_at, False)
			raise

		self._notify_commit_observer(started_at, True)

	def _read_commit_time(self):
		try:
			return self._time_source()
		except Exception:  # pylint: disable=broad-exception-caught
			return None

	def _notify_commit_observer(self, started_at, succeeded):
		if self._commit_observer is None:
			return

		try:
			ended_at = self._read_commit_time()
			elapsed_seconds = None if started_at is None or ended_at is None else ended_at - started_at
			self._commit_observer(elapsed_seconds, succeeded)
		except Exception:  # pylint: disable=broad-exception-caught
			# Performance observation must never alter database commit semantics.
			return

	@staticmethod
	def _fetch_account_rank_index_details(cursor, schema_name, index_name):
		cursor.execute(
			'''
			SELECT
				table_class.relname,
				access_method.amname,
				index_data.indisunique,
				index_data.indisprimary,
				index_data.indisvalid,
				index_data.indisready,
				index_data.indislive,
				index_data.indnkeyatts,
				index_data.indnatts,
				ARRAY(
					SELECT option_data.option_value
					FROM unnest(index_data.indoption::smallint[]) WITH ORDINALITY AS option_data(option_value, position)
					ORDER BY option_data.position
				) = ARRAY[0, 0, 0]::smallint[],
				ARRAY(
					SELECT collation_data.collation_oid
					FROM unnest(index_data.indcollation::oid[]) WITH ORDINALITY AS collation_data(collation_oid, position)
					ORDER BY collation_data.position
				) = ARRAY(
				SELECT column_data.attcollation
				FROM unnest(index_data.indkey::smallint[]) WITH ORDINALITY AS indexed_column(attnum, position)
				JOIN pg_attribute AS column_data
					ON column_data.attrelid = index_data.indrelid AND column_data.attnum = indexed_column.attnum
				WHERE indexed_column.position <= index_data.indnkeyatts
				ORDER BY indexed_column.position
			),
				ARRAY(
					SELECT operator_data.operator_class_oid
					FROM unnest(index_data.indclass::oid[]) WITH ORDINALITY AS operator_data(operator_class_oid, position)
					ORDER BY operator_data.position
				) = ARRAY(
					SELECT operator_class.oid
					FROM (VALUES ('text_ops', 1), ('text_ops', 2), ('int8_ops', 3)) AS expected_class(name, position)
					JOIN pg_opclass AS operator_class
						ON operator_class.opcmethod = access_method.oid AND operator_class.opcname::text = expected_class.name
					JOIN pg_namespace AS operator_class_namespace
						ON operator_class_namespace.oid = operator_class.opcnamespace AND operator_class_namespace.nspname = 'pg_catalog'
					ORDER BY expected_class.position
			),
				pg_get_expr(index_data.indexprs, index_data.indrelid),
				pg_get_expr(index_data.indpred, index_data.indrelid),
				ARRAY(
					SELECT pg_get_indexdef(index_data.indexrelid, key_number, true)
					FROM generate_series(1, index_data.indnkeyatts) AS key_numbers(key_number)
					ORDER BY key_number
				),
				EXISTS (
					SELECT 1 FROM pg_constraint AS constraint_data
					WHERE constraint_data.conindid = index_data.indexrelid
				)
			FROM pg_class AS index_class
			JOIN pg_namespace AS index_namespace ON index_namespace.oid = index_class.relnamespace
			JOIN pg_index AS index_data ON index_data.indexrelid = index_class.oid
			JOIN pg_class AS table_class ON table_class.oid = index_data.indrelid
			JOIN pg_am AS access_method ON access_method.oid = index_class.relam
			WHERE index_namespace.nspname = %s AND index_class.relname = %s
			''',
			(schema_name, index_name))
		return cursor.fetchone()

	@staticmethod
	def _is_expected_account_rank_primary_key(cursor, schema_name):
		cursor.execute(
			'''
			SELECT
				constraint_data.conname,
				index_data.indisvalid,
				index_data.indisready,
				index_data.indislive,
				index_data.indisunique,
				index_data.indisprimary,
				index_data.indnkeyatts,
				index_data.indnatts,
				ARRAY(
					SELECT option_data.option_value
					FROM unnest(index_data.indoption::smallint[]) WITH ORDINALITY AS option_data(option_value, position)
					ORDER BY option_data.position
				) = ARRAY[0, 0, 0]::smallint[],
				ARRAY(
					SELECT collation_data.collation_oid
					FROM unnest(index_data.indcollation::oid[]) WITH ORDINALITY AS collation_data(collation_oid, position)
					ORDER BY collation_data.position
				) = ARRAY(
					SELECT column_data.attcollation
					FROM unnest(index_data.indkey::smallint[]) WITH ORDINALITY AS indexed_column(attnum, position)
					JOIN pg_attribute AS column_data
						ON column_data.attrelid = index_data.indrelid AND column_data.attnum = indexed_column.attnum
					WHERE indexed_column.position <= index_data.indnkeyatts
					ORDER BY indexed_column.position
				),
				ARRAY(
					SELECT operator_data.operator_class_oid
					FROM unnest(index_data.indclass::oid[]) WITH ORDINALITY AS operator_data(operator_class_oid, position)
					ORDER BY operator_data.position
				) = ARRAY(
					SELECT operator_class.oid
					FROM (VALUES ('text_ops', 1), ('text_ops', 2), ('int8_ops', 3)) AS expected_class(name, position)
					JOIN pg_opclass AS operator_class
						ON operator_class.opcmethod = access_method.oid AND operator_class.opcname::text = expected_class.name
					JOIN pg_namespace AS operator_class_namespace
						ON operator_class_namespace.oid = operator_class.opcnamespace AND operator_class_namespace.nspname = 'pg_catalog'
					ORDER BY expected_class.position
				),
				access_method.amname,
				pg_get_expr(index_data.indexprs, index_data.indrelid),
				pg_get_expr(index_data.indpred, index_data.indrelid),
				ARRAY(
					SELECT pg_get_indexdef(index_data.indexrelid, key_number, true)
					FROM generate_series(1, index_data.indnkeyatts) AS key_numbers(key_number)
					ORDER BY key_number
				)
			FROM pg_constraint AS constraint_data
			JOIN pg_class AS table_class ON table_class.oid = constraint_data.conrelid
			JOIN pg_namespace AS table_namespace ON table_namespace.oid = table_class.relnamespace
			JOIN pg_index AS index_data ON index_data.indexrelid = constraint_data.conindid
			JOIN pg_class AS index_class ON index_class.oid = index_data.indexrelid
			JOIN pg_am AS access_method ON access_method.oid = index_class.relam
			WHERE table_namespace.nspname = %s
				AND table_class.relname = 'symbol_account_list_ranks'
				AND constraint_data.contype = 'p'
			''',
			(schema_name,))
		primary_key = cursor.fetchone()
		return primary_key == (
			'symbol_account_list_ranks_pkey', True, True, True, True, True, 3, 3, True, True, True, 'btree', None, None,
			['refresh_run_id', 'rank_scope', 'rank'])

	def _drop_legacy_account_rank_page_index(self, cursor):
		cursor.execute('SELECT current_schema()')
		schema_name = cursor.fetchone()[0]
		cursor.execute(
			'''
			SELECT 1
			FROM pg_class AS index_class
			JOIN pg_namespace AS index_namespace ON index_namespace.oid = index_class.relnamespace
			WHERE index_namespace.nspname = %s AND index_class.relname = %s
			''',
			(schema_name, 'idx_symbol_account_list_ranks_page'))
		if not cursor.fetchone():
			return

		# Fail without waiting if the table lock cannot be acquired. Once acquired,
		# it can block reads and writes until commit or rollback; recheck the catalog under the lock.
		cursor.execute(
			sql.SQL('LOCK TABLE {}.{} IN ACCESS EXCLUSIVE MODE NOWAIT').format(
				sql.Identifier(schema_name), sql.Identifier('symbol_account_list_ranks')))
		if not self._is_expected_account_rank_primary_key(cursor, schema_name):
			self.connection.rollback()
			raise RuntimeError(
				'Cannot remove idx_symbol_account_list_ranks_page: '
				'symbol_account_list_ranks_pkey is missing or does not match the expected valid primary key')

		index_details = self._fetch_account_rank_index_details(
			cursor, schema_name, 'idx_symbol_account_list_ranks_page')
		is_expected_page_index = index_details == (
			'symbol_account_list_ranks', 'btree', False, False, True, True, True, 3, 3, True, True, True, None, None,
			['refresh_run_id', 'rank_scope', 'rank'], False)
		if not is_expected_page_index:
			self.connection.rollback()
			raise RuntimeError(
				'Cannot remove idx_symbol_account_list_ranks_page: '
				'catalog definition does not match the expected unowned rank paging index')

		cursor.execute(
			sql.SQL('DROP INDEX {}.{}').format(
				sql.Identifier(schema_name), sql.Identifier('idx_symbol_account_list_ranks_page')))

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
		_create_enum_type(cursor, 'symbol_namespace_registration_type', SYMBOL_NAMESPACE_REGISTRATION_TYPE_VALUES)
		_create_enum_type(cursor, 'symbol_namespace_alias_type', SYMBOL_NAMESPACE_ALIAS_TYPE_VALUES)
		_create_enum_type(cursor, 'symbol_alias_artifact_type', SYMBOL_ALIAS_ARTIFACT_TYPE_VALUES)
		_create_enum_type(cursor, 'symbol_metadata_type', SYMBOL_METADATA_TYPE_VALUES)
		_create_enum_type(cursor, 'symbol_mosaic_restriction_entry_type', SYMBOL_MOSAIC_RESTRICTION_ENTRY_TYPE_VALUES)
		_create_enum_type(cursor, 'symbol_lock_status', SYMBOL_LOCK_STATUS_VALUES)
		_create_enum_type(cursor, 'symbol_lock_hash_algorithm', SYMBOL_LOCK_HASH_ALGORITHM_VALUES)
		# Account retention columns are migrated below; other schema changes retain
		# the existing greenfield deployment lifecycle.
		_create_table(cursor, 'symbol_sync_state', SYMBOL_SYNC_STATE_DEFINITIONS)
		_create_table(cursor, 'symbol_blocks', SYMBOL_BLOCK_DEFINITIONS)
		_create_table(cursor, 'symbol_account_refresh_state', SYMBOL_ACCOUNT_REFRESH_STATE_DEFINITIONS)
		cursor.execute('''
			SELECT column_name FROM information_schema.columns
			WHERE table_schema = current_schema() AND table_name = 'symbol_account_refresh_state'
				AND column_name IN ('previous_successful_run_id', 'running_run_id', 'is_retention_ready')
		''')
		if len(cursor.fetchall()) != 3:
			cursor.execute('''
				ALTER TABLE symbol_account_refresh_state
				ADD COLUMN IF NOT EXISTS previous_successful_run_id varchar,
				ADD COLUMN IF NOT EXISTS running_run_id varchar,
				ADD COLUMN IF NOT EXISTS is_retention_ready boolean NOT NULL DEFAULT false
			''')

		_create_table(cursor, 'symbol_accounts', SYMBOL_ACCOUNT_DEFINITIONS)
		_create_table(cursor, 'symbol_account_mosaics', SYMBOL_ACCOUNT_MOSAIC_DEFINITIONS)
		_create_table(cursor, 'symbol_multisig', SYMBOL_MULTISIG_DEFINITIONS)
		_create_table(cursor, 'symbol_account_refresh_accounts', SYMBOL_ACCOUNT_REFRESH_ACCOUNT_DEFINITIONS)
		_create_table(cursor, 'symbol_account_refresh_mosaics', SYMBOL_ACCOUNT_REFRESH_MOSAIC_DEFINITIONS)
		_create_table(cursor, 'symbol_account_list_ranks', SYMBOL_ACCOUNT_LIST_RANK_DEFINITIONS)
		for index_sql in ACCOUNT_REFRESH_STATE_INDEXES:
			cursor.execute(index_sql)
		for index_sql in ACCOUNT_REFRESH_INDEXES:
			cursor.execute(index_sql)
		_create_table(cursor, 'symbol_namespaces', SYMBOL_NAMESPACE_DEFINITIONS)
		_create_table(cursor, 'symbol_alias_names', SYMBOL_ALIAS_NAME_DEFINITIONS)
		for index_sql in SYMBOL_NAMESPACE_INDEXES:
			cursor.execute(index_sql)
		_create_table(cursor, 'symbol_mosaics', SYMBOL_MOSAIC_DEFINITIONS)
		for index_sql in SYMBOL_MOSAIC_INDEXES:
			cursor.execute(index_sql)
		_create_table(cursor, 'symbol_metadata', SYMBOL_METADATA_DEFINITIONS)
		for index_sql in SYMBOL_METADATA_INDEXES:
			cursor.execute(index_sql)
		_create_table(cursor, 'symbol_mosaic_restrictions', SYMBOL_MOSAIC_RESTRICTION_DEFINITIONS)
		for index_sql in SYMBOL_MOSAIC_RESTRICTION_INDEXES:
			cursor.execute(index_sql)
		_create_table(cursor, 'symbol_hash_locks', SYMBOL_HASH_LOCK_DEFINITIONS)
		_create_table(cursor, 'symbol_secret_locks', SYMBOL_SECRET_LOCK_DEFINITIONS)
		for index_sql in SYMBOL_LOCK_INDEXES:
			cursor.execute(index_sql)
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
		cursor.execute('CREATE INDEX IF NOT EXISTS idx_symbol_transactions_height_all ON symbol_transactions(height)')
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
		cursor.execute('CREATE INDEX IF NOT EXISTS idx_symbol_transaction_mosaics_height ON symbol_transaction_mosaics(height)')
		cursor.execute('''
			CREATE INDEX IF NOT EXISTS idx_symbol_transaction_addresses_address_height
			ON symbol_transaction_addresses(address, height DESC, transaction_id)
		''')
		cursor.execute('CREATE INDEX IF NOT EXISTS idx_symbol_transaction_addresses_height ON symbol_transaction_addresses(height)')
		for index_sql in SYMBOL_RECEIPT_INDEXES:
			cursor.execute(index_sql)
		self._drop_legacy_account_rank_page_index(cursor)
		self._commit()

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
		self._commit()

	def checkpoint_sync_state(self, sync_state):
		"""Publishes one fully written Symbol batch and clears its dirty marker atomically."""

		with self._database_transaction() as cursor:
			self._execute_upsert_sync_state(cursor, sync_state)

	def mark_sync_write_intent(self, height):
		"""Persists the earliest height whose batch may start a local write."""

		with self._database_transaction() as cursor:
			cursor.execute(
				'''
				INSERT INTO symbol_sync_state (id, status, dirty_state_from_height)
				VALUES (1, 'initialized', %s)
				ON CONFLICT (id) DO UPDATE SET
					dirty_state_from_height = LEAST(
						COALESCE(symbol_sync_state.dirty_state_from_height, EXCLUDED.dirty_state_from_height),
						EXCLUDED.dirty_state_from_height
					)
				WHERE symbol_sync_state.dirty_state_from_height IS NULL
					OR EXCLUDED.dirty_state_from_height < symbol_sync_state.dirty_state_from_height
				''',
				(height,))

	def mark_sync_unhealthy(self):
		"""Updates the failure status after the caller has confirmed a dirty marker."""

		with self._database_transaction() as cursor:
			cursor.execute(
				'''
				UPDATE symbol_sync_state
				SET status = 'unhealthy', updated_at = CURRENT_TIMESTAMP
				WHERE id = 1
				''')

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
				dirty_state_from_height,
				updated_at
			)
			VALUES (1, %s, %s, %s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
			ON CONFLICT (id) DO UPDATE SET
				status = EXCLUDED.status,
				chain_height = EXCLUDED.chain_height,
				finalized_height = EXCLUDED.finalized_height,
				finalized_hash = EXCLUDED.finalized_hash,
				finalized_epoch = EXCLUDED.finalized_epoch,
				finalized_point = EXCLUDED.finalized_point,
				last_synced_height = EXCLUDED.last_synced_height,
				last_synced_block_hash = EXCLUDED.last_synced_block_hash,
				dirty_state_from_height = EXCLUDED.dirty_state_from_height,
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
				sync_state['last_synced_block_hash'],
				sync_state['dirty_state_from_height']
			])

	def get_account_refresh_state(self):
		"""Gets the singleton Symbol account refresh state."""

		with self._database_transaction() as cursor:
			cursor.execute(f'SELECT {", ".join(ACCOUNT_REFRESH_STATE_COLUMNS)} FROM symbol_account_refresh_state WHERE id = 1')
			result = cursor.fetchone()

		return dict(zip(ACCOUNT_REFRESH_STATE_COLUMNS, result)) if result else None

	@contextmanager
	def _database_transaction(self):
		try:
			cursor = self.connection.cursor()
			yield cursor
			self._commit()
		except Exception:
			self.connection.rollback()
			raise

	@contextmanager
	def workflow_lock(self):
		"""Excludes Symbol refresh and synchronization across database sessions."""

		if not self._workflow_guard.acquire(blocking=False):
			raise RuntimeError('Symbol workflow is already running on this connection')

		is_lock_acquired = False
		has_primary_error = False
		try:
			with self._database_transaction() as cursor:
				cursor.execute('SELECT pg_try_advisory_lock(%s, %s)', SYMBOL_WORKFLOW_LOCK_KEY)
				is_lock_acquired = cursor.fetchone()[0]

			if not is_lock_acquired:
				raise RuntimeError('Another Symbol workflow is running')

			yield
		except BaseException:  # pylint: disable=broad-exception-caught
			has_primary_error = True
			raise
		finally:
			try:
				if is_lock_acquired:
					# A caller error may leave its transaction aborted; release the session lock afterward.
					try:
						self.connection.rollback()
						with self._database_transaction() as cursor:
							cursor.execute('SELECT pg_advisory_unlock(%s, %s)', SYMBOL_WORKFLOW_LOCK_KEY)
							if not cursor.fetchone()[0]:
								raise RuntimeError('Symbol workflow lock was not held')
					except BaseException as error:  # pylint: disable=broad-exception-caught
						if not has_primary_error:
							raise

						sqlstate = error.pgcode if isinstance(error, PsycopgError) else None  # pylint: disable=no-member
						try:
							self._retention_logger.error(
								f'Failed to release Symbol workflow lock: error_type={type(error).__name__} sqlstate={sqlstate}')
						except BaseException:  # pylint: disable=broad-exception-caught
							# A logging failure must not replace the primary workflow exception.
							pass
			finally:
				self._workflow_guard.release()

	def begin_account_refresh(self, refresh_run_id, started_at):
		"""Records the new owner after workflow exclusion has been acquired."""

		with self._database_transaction() as cursor:
			self._execute_upsert_account_refresh_state(cursor, {
				'running_run_id': refresh_run_id,
				'status': 'refreshing',
				'last_started_at': started_at,
				'last_scanned_page': None,
				'last_error': None
			})

	def recover_abandoned_account_refresh(self):
		"""Clears a former refresh owner after acquiring the shared workflow lock."""

		with self._database_transaction() as cursor:
			cursor.execute('''
				UPDATE symbol_account_refresh_state
				SET running_run_id = NULL, status = 'unhealthy', last_error = 'Account refresh was interrupted',
					updated_at = CURRENT_TIMESTAMP
				WHERE id = 1 AND running_run_id IS NOT NULL
			''')

	def mark_account_refresh_failed(self, refresh_run_id, last_error):
		"""Records a failed account refresh."""

		with self._database_transaction() as cursor:
			cursor.execute('''
				UPDATE symbol_account_refresh_state
				SET status = 'unhealthy', last_error = %s, running_run_id = NULL, updated_at = CURRENT_TIMESTAMP
				WHERE id = 1 AND running_run_id = %s
			''', (last_error, refresh_run_id))

	def prune_account_refresh_generations(  # pylint: disable=too-many-locals,too-many-branches,too-many-statements
		self, batch_size=ACCOUNT_RETENTION_BATCH_SIZE, max_batches=ACCOUNT_RETENTION_MAX_BATCHES
	):
		"""Deletes bounded committed batches while the caller owns the workflow lock."""

		tables = ('symbol_account_list_ranks', 'symbol_account_refresh_mosaics', 'symbol_account_refresh_accounts')
		deadline = self._retention_time_source() + self._retention_time_budget_seconds
		minimum_batch_size = ACCOUNT_RETENTION_MIN_BATCH_SIZE
		delete_timeout_count = 0
		for attempt in range(1, max_batches + 1):
			run_id = None
			table = None
			is_delete = False
			try:
				with self._database_transaction() as cursor:
					self._execute_retention_statement(cursor, deadline, '''
						SELECT last_successful_run_id, previous_successful_run_id, running_run_id, is_retention_ready
						FROM symbol_account_refresh_state WHERE id = 1 FOR UPDATE
					''')
					state = cursor.fetchone()
					if not state or not state[3]:
						self._retention_logger.info(
							f'Symbol account snapshot retention stopped reason=migration_pending attempt={attempt} batch_size={batch_size}')
						return

					protected = [run_id for run_id in state[:3] if run_id is not None]
					run_id = self._find_unprotected_account_generation(cursor, tables, protected, deadline)
					if run_id is None:
						self._retention_logger.info(
							f'Symbol account snapshot retention stopped reason=complete attempt={attempt} batch_size={batch_size}')
						return

					self._retention_logger.info(f'Symbol account snapshot retention candidate run_id={run_id}')
					counts = dict.fromkeys(tables, 0)
					for table in tables:
						# Table names are the fixed internal allowlist above.
						self._retention_logger.info(
							f'Symbol account snapshot retention attempt={attempt} run_id={run_id} table={table} batch_size={batch_size}')
						self._set_retention_delete_timeouts(cursor, deadline, batch_size)
						is_delete = True
						cursor.execute(f'''
							DELETE FROM {table} WHERE ctid IN (
								SELECT ctid FROM {table} WHERE refresh_run_id = %s LIMIT %s
							)
						''', (run_id, batch_size))
						is_delete = False
						counts[table] = cursor.rowcount
						if cursor.rowcount:
							break

					if self._retention_time_source() >= deadline:
						raise AccountRetentionTimeLimit()

				self._retention_logger.info(
					f'Symbol account snapshot retention attempt={attempt} run_id={run_id} batch_size={batch_size} deleted={counts}')
			except AccountRetentionTimeLimit:
				self._retention_logger.info(
					f'Symbol account snapshot retention stopped reason=deadline attempt={attempt} '
					f'run_id={run_id} table={table} batch_size={batch_size}')
				return
			except PsycopgError as error:
				if error.pgcode == errorcodes.LOCK_NOT_AVAILABLE and error.diag.message_primary == 'canceling statement due to lock timeout':
					self._retention_logger.info(
						f'Symbol account snapshot retention stopped reason=lock_timeout attempt={attempt} '
						f'run_id={run_id} table={table} batch_size={batch_size}')
					return

				# SQLSTATE 57014 also covers external cancellation. Unknown or translated diagnostics fail closed.
				if error.pgcode != errorcodes.QUERY_CANCELED or error.diag.message_primary != 'canceling statement due to statement timeout':
					self._retention_logger.info(
						f'Symbol account snapshot retention reason=database_error '
						f'error_type={type(error).__name__} sqlstate={error.pgcode}')
					raise

				if not is_delete or batch_size <= minimum_batch_size:
					stop_reason = 'non_delete' if not is_delete else 'minimum_batch'
					self._retention_logger.info(
						f'Symbol account snapshot retention stopped reason=statement_timeout attempt={attempt} '
						f'run_id={run_id} table={table} batch_size={batch_size} stop_reason={stop_reason}')
					return

				delete_timeout_count += 1

				if attempt == max_batches or int((deadline - self._retention_time_source()) * 1000) <= self.retention_config.lock_timeout_ms:
					stop_reason = 'attempt_limit' if attempt == max_batches else 'deadline'
					self._retention_logger.info(
						f'Symbol account snapshot retention reason=statement_timeout attempt={attempt} '
						f'run_id={run_id} table={table} batch_size={batch_size} stop_reason={stop_reason}')
					return

				next_batch_size = (
					max(minimum_batch_size, batch_size // 2) if delete_timeout_count == 1 else minimum_batch_size)
				self._retention_logger.info(
					f'Symbol account snapshot retention reason=statement_timeout attempt={attempt} '
					f'run_id={run_id} table={table} batch_size={batch_size} next_batch_size={next_batch_size}')
				batch_size = next_batch_size

		self._retention_logger.info(
			f'Symbol account snapshot retention stopped reason=attempt_limit attempts={max_batches} batch_size={batch_size}')

	def _execute_retention_statement(self, cursor, deadline, statement, parameters=()):
		self._set_retention_timeouts(cursor, deadline)
		cursor.execute(statement, parameters)

	def _set_retention_timeouts(self, cursor, deadline):
		remaining_ms = int((deadline - self._retention_time_source()) * 1000)
		if remaining_ms <= self.retention_config.lock_timeout_ms:
			raise AccountRetentionTimeLimit()

		timeout_ms = min(remaining_ms, self.retention_config.statement_timeout_ms)
		cursor.execute(
			"SELECT set_config('statement_timeout', %s, true), set_config('lock_timeout', %s, true)",
			(f'{timeout_ms}ms', f'{self.retention_config.lock_timeout_ms}ms'))

	def _set_retention_delete_timeouts(self, cursor, deadline, batch_size):
		remaining_ms = int((deadline - self._retention_time_source()) * 1000)
		if remaining_ms <= self.retention_config.lock_timeout_ms:
			raise AccountRetentionTimeLimit()

		timeout_ms = min(self.retention_config.statement_timeout_ms, remaining_ms)
		if batch_size > ACCOUNT_RETENTION_MIN_BATCH_SIZE:
			timeout_ms = min(
				self.retention_config.statement_timeout_ms,
				max(self.retention_config.lock_timeout_ms + 1, remaining_ms // 3))

		cursor.execute(
			"SELECT set_config('statement_timeout', %s, true), set_config('lock_timeout', %s, true)",
			(f'{timeout_ms}ms', f'{self.retention_config.lock_timeout_ms}ms'))

	def _find_unprotected_account_generation(self, cursor, tables, protected, deadline):
		for table in tables:
			# Each table's primary key begins with refresh_run_id. Skip entire protected
			# runs with index seeks instead of scanning every row in those runs.
			self._execute_retention_statement(
				cursor, deadline,
				f'SELECT refresh_run_id FROM {table} ORDER BY refresh_run_id LIMIT 1')
			row = cursor.fetchone()
			while row and row[0] in protected:
				self._execute_retention_statement(
					cursor, deadline,
					f'SELECT refresh_run_id FROM {table} WHERE refresh_run_id > %s ORDER BY refresh_run_id LIMIT 1',
					(row[0],))
				row = cursor.fetchone()

			if row:
				return row[0]

		return None

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

		with self._database_transaction() as cursor:
			cursor.execute(
				'''
				SELECT DISTINCT beneficiary_address
				FROM symbol_blocks
				WHERE timestamp >= %s
				''',
				(cutoff_timestamp,))

			return {bytes(row[0]) for row in cursor.fetchall()}

	def upsert_namespace(self, namespace_row, alias_name_rows):
		"""Upserts one namespace and replaces the alias-name rows derived from it."""

		with self._database_transaction() as cursor:
			self._execute_upsert_namespace(cursor, namespace_row, alias_name_rows)

	def apply_namespace_entries(self, namespace_entries):
		"""Applies namespace upsert and delete entries atomically in input order."""

		with self._database_transaction() as cursor:
			self._execute_namespace_entries(cursor, namespace_entries)

	@staticmethod
	def _execute_namespace_entries(cursor, namespace_entries):
		for entry in namespace_entries:
			if 'namespace_id' in entry:
				SymbolDatabase._execute_delete_namespace(cursor, entry['namespace_id'])
			else:
				SymbolDatabase._execute_upsert_namespace(cursor, entry['row'], entry['alias_rows'])

	@staticmethod
	def _execute_mosaic_entries(cursor, mosaic_entries):
		for entry in mosaic_entries:
			if 'mosaic_id' in entry:
				SymbolDatabase._execute_delete_mosaic(cursor, entry['mosaic_id'])
			else:
				SymbolDatabase._execute_upsert_mosaic(cursor, entry['row'])

	@staticmethod
	def _execute_metadata_entries(cursor, metadata_entries):
		for entry in metadata_entries:
			if 'key' in entry:
				SymbolDatabase._execute_delete_metadata_by_key(cursor, entry['key'])
			else:
				SymbolDatabase._execute_upsert_metadata(cursor, entry['row'])

	@staticmethod
	def _execute_hash_lock_entries(cursor, hash_lock_entries):
		for entry in hash_lock_entries:
			if 'hash' in entry:
				SymbolDatabase._execute_delete_hash_lock(cursor, entry['hash'])
			else:
				SymbolDatabase._execute_upsert_hash_lock(cursor, entry['row'])

	@staticmethod
	def _execute_secret_lock_entries(cursor, secret_lock_entries):
		for entry in secret_lock_entries:
			SymbolDatabase._execute_replace_secret_locks(cursor, entry['key'], entry['rows'])

	@staticmethod
	def _execute_mosaic_restriction_entries(cursor, mosaic_restriction_entries):
		for entry in mosaic_restriction_entries:
			SymbolDatabase._execute_replace_mosaic_restrictions(cursor, entry['key'], entry['rows'])

	@staticmethod
	def _execute_refresh_mosaic_alias_names(cursor, mosaic_ids):
		for mosaic_id in mosaic_ids:
			cursor.execute(
				f'UPDATE symbol_mosaics SET alias_names = {MOSAIC_ALIAS_NAMES_SUBQUERY} WHERE mosaic_id = %(target_mosaic_id)s',
				{'mosaic_id': mosaic_id, 'target_mosaic_id': mosaic_id})

	@staticmethod
	def _execute_upsert_namespace(cursor, namespace_row, alias_name_rows):
		cursor.execute(
			'''
			INSERT INTO symbol_namespaces (
				namespace_id, parent_id, root_id, name, full_name, depth, registration_type, owner_address,
				start_height, end_height, alias_type, alias_mosaic_id, alias_address, raw_payload, updated_at_height
			)
			VALUES (
				%(namespace_id)s, %(parent_id)s, %(root_id)s, %(name)s, %(full_name)s, %(depth)s, %(registration_type)s,
				%(owner_address)s, %(start_height)s, %(end_height)s, %(alias_type)s, %(alias_mosaic_id)s, %(alias_address)s,
				%(raw_payload)s, %(updated_at_height)s
			)
			ON CONFLICT (namespace_id) DO UPDATE SET
				parent_id = EXCLUDED.parent_id, root_id = EXCLUDED.root_id, name = EXCLUDED.name, full_name = EXCLUDED.full_name,
				depth = EXCLUDED.depth, registration_type = EXCLUDED.registration_type, owner_address = EXCLUDED.owner_address,
				start_height = EXCLUDED.start_height, end_height = EXCLUDED.end_height, alias_type = EXCLUDED.alias_type,
				alias_mosaic_id = EXCLUDED.alias_mosaic_id, alias_address = EXCLUDED.alias_address,
				raw_payload = EXCLUDED.raw_payload, updated_at_height = EXCLUDED.updated_at_height
			''',
			{**namespace_row, 'raw_payload': Json(namespace_row['raw_payload'])})
		cursor.execute(
			'DELETE FROM symbol_alias_names WHERE name = %s RETURNING artifact_type, artifact_id',
			(namespace_row['full_name'],))
		mosaic_ids = {
			artifact_id
			for artifact_type, artifact_id in cursor.fetchall()
			if 'mosaic' == artifact_type
		}
		for alias_name_row in alias_name_rows:
			cursor.execute(
				'''
				INSERT INTO symbol_alias_names (artifact_type, artifact_id, name, updated_at_height)
				VALUES (%(artifact_type)s, %(artifact_id)s, %(name)s, %(updated_at_height)s)
				''',
				alias_name_row)
			if 'mosaic' == alias_name_row['artifact_type']:
				mosaic_ids.add(alias_name_row['artifact_id'])

		SymbolDatabase._execute_refresh_mosaic_alias_names(cursor, mosaic_ids)

	def upsert_mosaic(self, mosaic_row):
		"""Upserts one mosaic current-state row and derives its alias names."""

		with self._database_transaction() as cursor:
			self._execute_upsert_mosaic(cursor, mosaic_row)

	@staticmethod
	def _execute_upsert_mosaic(cursor, mosaic_row):
		cursor.execute(
			f'''
			INSERT INTO symbol_mosaics (
				mosaic_id, owner_address, start_height, duration, expiration_height, supply, divisibility, flags,
				supply_mutable, transferable, restrictable, revokable, alias_names, raw_payload, updated_at_height
			)
			VALUES (
				%(mosaic_id)s, %(owner_address)s, %(start_height)s, %(duration)s, %(expiration_height)s, %(supply)s,
				%(divisibility)s, %(flags)s, %(supply_mutable)s, %(transferable)s, %(restrictable)s, %(revokable)s,
				{MOSAIC_ALIAS_NAMES_SUBQUERY}, %(raw_payload)s, %(updated_at_height)s
			)
			ON CONFLICT (mosaic_id) DO UPDATE SET
				owner_address = EXCLUDED.owner_address, start_height = EXCLUDED.start_height, duration = EXCLUDED.duration,
				expiration_height = EXCLUDED.expiration_height, supply = EXCLUDED.supply, divisibility = EXCLUDED.divisibility,
				flags = EXCLUDED.flags, supply_mutable = EXCLUDED.supply_mutable, transferable = EXCLUDED.transferable,
				restrictable = EXCLUDED.restrictable, revokable = EXCLUDED.revokable, alias_names = {MOSAIC_ALIAS_NAMES_SUBQUERY},
				raw_payload = EXCLUDED.raw_payload, updated_at_height = EXCLUDED.updated_at_height
			''',
			{**mosaic_row, 'raw_payload': Json(mosaic_row['raw_payload'])})

	def delete_mosaic(self, mosaic_id):
		"""Deletes one mosaic current-state row when it exists."""

		with self._database_transaction() as cursor:
			self._execute_delete_mosaic(cursor, mosaic_id)

	@staticmethod
	def _execute_delete_mosaic(cursor, mosaic_id):
		cursor.execute('DELETE FROM symbol_mosaics WHERE mosaic_id = %s', (mosaic_id,))

	def get_mosaic_ids_updated_from_height(self, height):
		"""Gets mosaic ids whose current state was observed at or after a height."""

		cursor = self.connection.cursor()
		cursor.execute(
			'SELECT mosaic_id FROM symbol_mosaics WHERE updated_at_height >= %s ORDER BY mosaic_id',
			(height,))

		return [row[0] for row in cursor.fetchall()]

	def upsert_metadata(self, metadata_row):
		"""Upserts one Symbol metadata current-state row."""

		with self._database_transaction() as cursor:
			self._execute_upsert_metadata(cursor, metadata_row)

	@staticmethod
	def _execute_upsert_metadata(cursor, metadata_row):
		metadata_key = canonical_metadata_key(metadata_row)
		metadata_row = {**metadata_row, **metadata_key}
		cursor.execute(
			'''
			INSERT INTO symbol_metadata (
				composite_hash, metadata_type, scoped_metadata_key, source_address, target_address, target_id,
				value_hex, value_utf8, raw_payload, updated_at_height
			)
			VALUES (
				%(composite_hash)s, %(metadata_type)s, %(scoped_metadata_key)s, %(source_address)s, %(target_address)s,
				%(target_id)s, %(value_hex)s, %(value_utf8)s, %(raw_payload)s, %(updated_at_height)s
			)
			ON CONFLICT (composite_hash) DO UPDATE SET
				metadata_type = EXCLUDED.metadata_type,
				scoped_metadata_key = EXCLUDED.scoped_metadata_key,
				source_address = EXCLUDED.source_address,
				target_address = EXCLUDED.target_address,
				target_id = EXCLUDED.target_id,
				value_hex = EXCLUDED.value_hex,
				value_utf8 = EXCLUDED.value_utf8,
				raw_payload = EXCLUDED.raw_payload,
				updated_at_height = EXCLUDED.updated_at_height
			''',
			{**metadata_row, 'raw_payload': Json(metadata_row['raw_payload'])})

	def delete_metadata_by_key(self, metadata_key):
		"""Deletes metadata matching its natural key when it exists."""

		with self._database_transaction() as cursor:
			self._execute_delete_metadata_by_key(cursor, metadata_key)

	@staticmethod
	def _execute_delete_metadata_by_key(cursor, metadata_key):
		metadata_key = canonical_metadata_key(metadata_key)
		cursor.execute(
			'''
			DELETE FROM symbol_metadata
			WHERE metadata_type = %(metadata_type)s
				AND source_address = %(source_address)s
				AND scoped_metadata_key = %(scoped_metadata_key)s
				AND target_address IS NOT DISTINCT FROM %(target_address)s
				AND target_id IS NOT DISTINCT FROM %(target_id)s
			''',
			metadata_key)

	def get_metadata_keys_updated_from_height(self, height):  # pylint: disable=invalid-name
		"""Gets natural metadata keys observed at or after a height."""

		cursor = self.connection.cursor()
		cursor.execute(
			'''
			SELECT metadata_type, source_address, target_address, scoped_metadata_key, target_id
			FROM symbol_metadata
			WHERE updated_at_height >= %s
			ORDER BY composite_hash
			''',
			(height,))

		columns = ('metadata_type', 'source_address', 'target_address', 'scoped_metadata_key', 'target_id')
		return [
			canonical_metadata_key({
				**dict(zip(columns, row)),
				'source_address': bytes(row[1]),
				'target_address': bytes(row[2]) if row[2] is not None else None
			})
			for row in cursor.fetchall()
		]

	def get_confirmed_metadata_keys_since(self, height):
		"""Gets Metadata natural keys from confirmed transactions at or after a height."""

		cursor = self.connection.cursor()
		cursor.execute(
			'''
			SELECT
				transactions.height,
				transactions.id,
				transactions.type,
				transactions.signer_address,
				transactions.target_address,
				transactions.body,
				metadata_targets.mosaic_id,
				metadata_targets.amount,
				metadata_targets.position
			FROM symbol_transactions transactions
			LEFT JOIN symbol_transaction_mosaics metadata_targets
				ON metadata_targets.transaction_id = transactions.id
				AND metadata_targets.role = 'metadata_target'
			WHERE transactions.height >= %s AND transactions.type = ANY(%s)
			ORDER BY transactions.height, transactions.id, metadata_targets.mosaic_id
			''',
			(height, list(METADATA_TRANSACTION_TYPE_LABELS)))

		transaction_rows = []
		for row in cursor.fetchall():
			if not transaction_rows or transaction_rows[-1][0][1] != row[1]:
				transaction_rows.append([row])
			else:
				transaction_rows[-1].append(row)

		return [self._metadata_key_from_confirmed_transaction_rows(rows) for rows in transaction_rows]

	@staticmethod
	def _metadata_key_from_confirmed_transaction_rows(rows):
		height, transaction_id, transaction_type, signer_address, target_address, body, *_ = rows[0]
		metadata_type = METADATA_TRANSACTION_TYPE_LABELS[transaction_type]
		if not isinstance(body, dict):
			raise ValueError(
				f'Invalid confirmed Symbol {metadata_type} Metadata transaction body at height {height}, id {transaction_id}')

		metadata_target_rows = [
			{'mosaic_id': row[6], 'amount': row[7], 'position': row[8]}
			for row in rows
			if row[6] is not None
		]
		target_id = metadata_target_from_relations(
			metadata_type,
			metadata_target_rows,
			f'at height {height}, id {transaction_id}')
		if 'namespace' == metadata_type:
			target_id = body.get('targetNamespaceId')

		return canonical_metadata_key({
			'metadata_type': metadata_type,
			'source_address': bytes(signer_address),
			'target_address': bytes(target_address) if target_address is not None else None,
			'scoped_metadata_key': body.get('scopedMetadataKey'),
			'target_id': target_id
		})

	def replace_mosaic_restrictions(self, restriction_key, restriction_rows):
		"""Replaces all current Mosaic Restriction rows matching one logical key."""

		with self._database_transaction() as cursor:
			self._execute_replace_mosaic_restrictions(cursor, restriction_key, restriction_rows)

	@staticmethod
	def _execute_replace_mosaic_restrictions(cursor, restriction_key, restriction_rows):
		if not isinstance(restriction_key, MosaicRestrictionKey):
			raise ValueError('Invalid Symbol mosaic restriction logical key')
		entry_type = mosaic_restriction_entry_type_label(restriction_key.entry_type)
		cursor.execute(
			'''
			DELETE FROM symbol_mosaic_restrictions
			WHERE entry_type = %(entry_type)s
				AND mosaic_id = %(mosaic_id)s
				AND target_address IS NOT DISTINCT FROM %(target_address)s
			''',
			{
				'entry_type': entry_type,
				'mosaic_id': restriction_key.mosaic_id,
				'target_address': restriction_key.target_address
			})
		for restriction_row in restriction_rows:
			cursor.execute(
				'''
				INSERT INTO symbol_mosaic_restrictions (
					composite_hash, entry_type, mosaic_id, target_address, restrictions, raw_payload, updated_at_height
				)
				VALUES (
					%(composite_hash)s, %(entry_type)s, %(mosaic_id)s, %(target_address)s,
					%(restrictions)s, %(raw_payload)s, %(updated_at_height)s
				)
				''',
				{
					**restriction_row,
					'entry_type': mosaic_restriction_entry_type_label(restriction_row['entry_type']),
					'restrictions': Json(restriction_row['restrictions']),
					'raw_payload': Json(restriction_row['raw_payload'])
				})

	def get_mosaic_restriction_keys_updated_from_height(self, height):  # pylint: disable=invalid-name
		"""Gets current Mosaic Restriction logical keys observed at or after a height."""

		cursor = self.connection.cursor()
		cursor.execute(
			'''
			SELECT entry_type, mosaic_id, target_address
			FROM symbol_mosaic_restrictions
			WHERE updated_at_height >= %s
			ORDER BY updated_at_height, composite_hash
			''',
			(height,))

		return [
			create_mosaic_restriction_key(
				MosaicRestrictionEntryType(row[0]),
				row[1],
				bytes(row[2]) if row[2] is not None else None)
			for row in cursor.fetchall()
		]

	def get_confirmed_mosaic_restriction_keys_since(self, height):  # pylint: disable=invalid-name
		"""Gets Mosaic Restriction logical keys from persisted transactions at or after a height."""

		cursor = self.connection.cursor()
		cursor.execute(
			'''
			SELECT
				transactions.height,
				transactions.id,
				transactions.type,
				transactions.target_address,
				restriction_mosaics.mosaic_id,
				restriction_mosaics.position
			FROM symbol_transactions transactions
			LEFT JOIN symbol_transaction_mosaics restriction_mosaics
				ON restriction_mosaics.transaction_id = transactions.id
				AND restriction_mosaics.role = 'restriction'
				AND restriction_mosaics.position = 0
			WHERE transactions.height >= %s AND transactions.type = ANY(%s)
			ORDER BY transactions.height, transactions.id, restriction_mosaics.mosaic_id
			''',
			(
				height,
				list(MOSAIC_RESTRICTION_ENTRY_TYPE_BY_TRANSACTION_TYPE)
			))

		transaction_rows = []
		for row in cursor.fetchall():
			if not transaction_rows or transaction_rows[-1][0][1] != row[1]:
				transaction_rows.append([row])
			else:
				transaction_rows[-1].append(row)

		return [self._mosaic_restriction_key_from_confirmed_transaction_rows(rows) for rows in transaction_rows]

	@staticmethod
	def _mosaic_restriction_key_from_confirmed_transaction_rows(rows):
		height, transaction_id, transaction_type, target_address, *_ = rows[0]
		entry_type = MOSAIC_RESTRICTION_ENTRY_TYPE_BY_TRANSACTION_TYPE.get(transaction_type)
		if entry_type is None:
			raise ValueError(f'Unsupported confirmed Symbol Mosaic Restriction transaction at height {height}, id {transaction_id}')

		position_zero_rows = [row for row in rows if row[4] is not None and row[5] == 0]
		if len(position_zero_rows) != 1:
			raise ValueError(
				f'Invalid confirmed Symbol {entry_type.value} Mosaic Restriction transaction at height {height}, id {transaction_id}')
		mosaic_id = position_zero_rows[0][4]
		resolved_target = bytes(target_address) if target_address is not None else None
		if entry_type is MosaicRestrictionEntryType.ADDRESS and resolved_target is None:
			raise ValueError(
				f'Invalid confirmed Symbol address Mosaic Restriction target at height {height}, id {transaction_id}')
		if entry_type is MosaicRestrictionEntryType.GLOBAL:
			resolved_target = None
		return create_mosaic_restriction_key(entry_type, mosaic_id, resolved_target)

	def upsert_hash_lock(self, hash_lock_row):
		"""Upserts one Hash Lock current-state row by its aggregate bonded hash."""

		with self._database_transaction() as cursor:
			self._execute_upsert_hash_lock(cursor, hash_lock_row)

	def delete_hash_lock(self, hash_lock):
		"""Deletes one Hash Lock current-state row by its aggregate bonded hash."""

		with self._database_transaction() as cursor:
			self._execute_delete_hash_lock(cursor, hash_lock)

	@staticmethod
	def _execute_upsert_hash_lock(cursor, hash_lock_row):
		cursor.execute(
			'''
			INSERT INTO symbol_hash_locks (
				hash, owner_address, mosaic_id, amount, end_height, status, raw_payload, updated_at_height
			)
			VALUES (
				%(hash)s, %(owner_address)s, %(mosaic_id)s, %(amount)s, %(end_height)s, %(status)s,
				%(raw_payload)s, %(updated_at_height)s
			)
			ON CONFLICT (hash) DO UPDATE SET
				owner_address = EXCLUDED.owner_address,
				mosaic_id = EXCLUDED.mosaic_id,
				amount = EXCLUDED.amount,
				end_height = EXCLUDED.end_height,
				status = EXCLUDED.status,
				raw_payload = EXCLUDED.raw_payload,
				updated_at_height = EXCLUDED.updated_at_height
			''',
			{**hash_lock_row, 'raw_payload': Json(hash_lock_row['raw_payload'])})

	@staticmethod
	def _execute_delete_hash_lock(cursor, hash_lock):
		cursor.execute('DELETE FROM symbol_hash_locks WHERE hash = %s', (hash_lock.hash,))

	def replace_secret_locks(self, search_key, secret_lock_rows):
		"""Replaces all Secret Lock rows matching one logical key, including an empty replacement."""

		with self._database_transaction() as cursor:
			self._execute_replace_secret_locks(cursor, search_key, secret_lock_rows)

	@staticmethod
	def _execute_replace_secret_locks(cursor, search_key, secret_lock_rows):
		SymbolDatabase._execute_delete_secret_locks(cursor, search_key)
		for secret_lock_row in secret_lock_rows:
			SymbolDatabase._execute_upsert_secret_lock(cursor, secret_lock_row)

	@staticmethod
	def _execute_delete_secret_locks(cursor, search_key):
		where_clause = '''
			WHERE recipient_address = %(recipient_address)s
				AND secret = %(secret)s
				AND hash_algorithm = %(hash_algorithm)s
		'''
		parameters = {
			'recipient_address': search_key.recipient_address,
			'secret': search_key.secret,
			'hash_algorithm': search_key.hash_algorithm
		}
		if search_key.owner_address is not None:
			where_clause += ' AND owner_address = %(owner_address)s'
			parameters['owner_address'] = search_key.owner_address

		cursor.execute(f'DELETE FROM symbol_secret_locks {where_clause}', parameters)

	@staticmethod
	def _execute_upsert_secret_lock(cursor, secret_lock_row):
		cursor.execute(
			'''
			INSERT INTO symbol_secret_locks (
				composite_hash, owner_address, recipient_address, secret, hash_algorithm, mosaic_id,
				amount, end_height, status, raw_payload, updated_at_height
			)
			VALUES (
				%(composite_hash)s, %(owner_address)s, %(recipient_address)s, %(secret)s, %(hash_algorithm)s,
				%(mosaic_id)s, %(amount)s, %(end_height)s, %(status)s, %(raw_payload)s, %(updated_at_height)s
			)
			ON CONFLICT (composite_hash) DO UPDATE SET
				owner_address = EXCLUDED.owner_address,
				recipient_address = EXCLUDED.recipient_address,
				secret = EXCLUDED.secret,
				hash_algorithm = EXCLUDED.hash_algorithm,
				mosaic_id = EXCLUDED.mosaic_id,
				amount = EXCLUDED.amount,
				end_height = EXCLUDED.end_height,
				status = EXCLUDED.status,
				raw_payload = EXCLUDED.raw_payload,
				updated_at_height = EXCLUDED.updated_at_height
			''',
			{**secret_lock_row, 'raw_payload': Json(secret_lock_row['raw_payload'])})

	def get_hash_lock_hashes_updated_from_height(self, height):  # pylint: disable=invalid-name
		"""Gets Hash Lock keys whose current state was observed at or after a height."""

		cursor = self.connection.cursor()
		cursor.execute(
			'SELECT hash FROM symbol_hash_locks WHERE updated_at_height >= %s ORDER BY updated_at_height, hash',
			(height,))

		return [create_hash_lock_key(bytes(row[0])) for row in cursor.fetchall()]

	def get_secret_lock_search_keys_updated_from_height(self, height):  # pylint: disable=invalid-name
		"""Gets Secret Lock logical keys whose current state was observed at or after a height."""

		return self._get_secret_lock_search_keys(
			'updated_at_height >= %s',
			(height,),
			'updated_at_height')

	def get_hash_lock_hashes_reaching_finalized_height(self, finalized_height):  # pylint: disable=invalid-name
		"""Gets Hash Lock keys whose end height has reached finalization."""

		cursor = self.connection.cursor()
		cursor.execute(
			'''
			SELECT hash
			FROM symbol_hash_locks
			WHERE end_height <= %s
			ORDER BY end_height, hash
			''',
			(finalized_height,))

		return [create_hash_lock_key(bytes(row[0])) for row in cursor.fetchall()]

	def get_secret_lock_search_keys_reaching_finalized_height(self, finalized_height):  # pylint: disable=invalid-name
		"""Gets Secret Lock logical keys whose end height has reached finalization."""

		return self._get_secret_lock_search_keys(
			'end_height <= %s',
			(finalized_height,),
			'end_height')

	def _get_secret_lock_search_keys(self, predicate, parameters, sort_column):
		# Keep the interpolated ORDER BY identifier restricted to the updated-height and finalized-height contracts.
		sort_column = {
			'updated_at_height': 'updated_at_height',
			'end_height': 'end_height'
		}[sort_column]
		cursor = self.connection.cursor()
		cursor.execute(
			f'''
			SELECT owner_address, recipient_address, secret, hash_algorithm
			FROM symbol_secret_locks
			WHERE {predicate}
			ORDER BY {sort_column}, composite_hash
			''',
			parameters)

		return [
			create_secret_lock_search_key(
				bytes(row[0]), bytes(row[1]), bytes(row[2]), row[3])
			for row in cursor.fetchall()
		]

	def apply_finalization_lock_entries(self, hash_lock_entries, secret_lock_entries):
		"""Applies finalized Hash and Secret Lock replacements in one transaction."""

		with self._database_transaction() as cursor:
			self._execute_hash_lock_entries(cursor, hash_lock_entries)
			self._execute_secret_lock_entries(cursor, secret_lock_entries)

	def delete_namespace(self, namespace_id):
		"""Deletes one namespace and its derived alias-name rows when it exists."""

		with self._database_transaction() as cursor:
			self._execute_delete_namespace(cursor, namespace_id)

	@staticmethod
	def _execute_delete_namespace(cursor, namespace_id):
		cursor.execute('SELECT full_name FROM symbol_namespaces WHERE namespace_id = %s', (namespace_id,))
		result = cursor.fetchone()
		if not result:
			return

		cursor.execute(
			'DELETE FROM symbol_alias_names WHERE name = %s RETURNING artifact_type, artifact_id',
			(result[0],))
		mosaic_ids = {
			artifact_id
			for artifact_type, artifact_id in cursor.fetchall()
			if 'mosaic' == artifact_type
		}
		cursor.execute('DELETE FROM symbol_namespaces WHERE namespace_id = %s', (namespace_id,))
		SymbolDatabase._execute_refresh_mosaic_alias_names(cursor, mosaic_ids)

	def get_namespace_ids_updated_from_height(self, height):  # pylint: disable=invalid-name
		"""Gets namespace ids whose current state was observed at or after a height."""

		cursor = self.connection.cursor()
		cursor.execute(
			'SELECT namespace_id FROM symbol_namespaces WHERE updated_at_height >= %s ORDER BY namespace_id',
			(height,))

		return [row[0] for row in cursor.fetchall()]

	def get_namespace_ids_by_root_ids(self, root_ids):
		"""Gets persisted descendant namespace ids grouped by their requested root ids."""

		if not root_ids:
			return {}

		cursor = self.connection.cursor()
		cursor.execute(
			'''
			SELECT root_id, namespace_id
			FROM symbol_namespaces
			WHERE root_id = ANY(%s) AND depth > 1
			ORDER BY root_id, depth, namespace_id
			''',
			(root_ids,))

		descendant_ids_by_root = {}
		for root_id, namespace_id in cursor.fetchall():
			descendant_ids_by_root.setdefault(root_id, []).append(namespace_id)

		return descendant_ids_by_root

	def upsert_account_current_state(
		self,
		account_row,
		mosaic_rows,
		overwrite_is_harvesting_active=True
	):
		"""Upserts one Symbol account current-state row and replaces its current mosaic rows."""

		with self._database_transaction() as cursor:
			self._execute_upsert_account_current_state(
				cursor,
				account_row,
				mosaic_rows,
				overwrite_is_harvesting_active)

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
			self._commit()
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
		self._commit()

	@staticmethod
	def _execute_insert_account_refresh_snapshot_rows(  # pylint: disable=too-many-arguments,too-many-positional-arguments
		cursor,
		refresh_run_id,
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

		with self._database_transaction() as cursor:
			for entry in account_entries:
				self._execute_upsert_account_current_state(
					cursor,
					entry['account_row'],
					entry['mosaic_rows'],
					overwrite_is_harvesting_active=True)
				self._execute_insert_account_refresh_snapshot_rows(
					cursor,
					entry['refresh_run_id'],
					entry['account_search_order'],
					entry['account_row'],
					entry['mosaic_rows'],
					entry['snapshot_height'],
					entry['snapshot_at'])
			self._execute_upsert_account_refresh_state(cursor, {'last_scanned_page': last_scanned_page})

	def finalize_account_refresh(self, refresh_run_id, native_mosaic_id, completed_height, completed_at):
		"""Publishes one refresh run: importance rates, list ranks, current-state importance, success marker."""

		with self._database_transaction() as cursor:
			cursor.execute('SELECT running_run_id FROM symbol_account_refresh_state WHERE id = 1 FOR UPDATE')
			owner = cursor.fetchone()
			if not owner or owner[0] != refresh_run_id:
				raise RuntimeError('Symbol account refresh does not own the running ID')

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

			cursor.execute('DELETE FROM symbol_account_list_ranks WHERE refresh_run_id = %s', (refresh_run_id,))
			cursor.execute(
				'''
				INSERT INTO symbol_account_list_ranks (
					refresh_run_id,
					rank_scope,
					rank,
					address,
					sort_value_numeric,
					mosaic_id
				)
				SELECT
					refresh_run_id,
					'ID',
					ROW_NUMBER() OVER (ORDER BY account_search_order ASC, address) - 1,
					address,
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
					mosaic_id
				)
				SELECT
					refresh_run_id,
					'IMPORTANCE',
					ROW_NUMBER() OVER (ORDER BY importance_percentage DESC, address) - 1,
					address,
					importance_percentage,
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
					mosaic_id
				)
				SELECT
					refresh_run_id,
					%s,
					ROW_NUMBER() OVER (ORDER BY amount DESC, address) - 1,
					address,
					amount,
					%s
				FROM symbol_account_refresh_mosaics
				WHERE refresh_run_id = %s AND mosaic_id = %s
				''',
				(f'BALANCE:{native_mosaic_id}', native_mosaic_id, refresh_run_id, native_mosaic_id))
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
			cursor.execute('''
				UPDATE symbol_account_refresh_state
				SET previous_successful_run_id = last_successful_run_id,
					last_successful_run_id = %s, running_run_id = NULL, is_retention_ready = true,
					last_completed_at = %s, last_completed_height = %s, status = 'healthy',
					last_error = NULL, updated_at = CURRENT_TIMESTAMP
				WHERE id = 1 AND running_run_id = %s
			''', (refresh_run_id, completed_at, completed_height, refresh_run_id))

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

		with self._database_transaction() as cursor:
			self._delete_rollback_affected_rows_from_height(cursor, height)
			self._stale_mark_account_refresh_state_if_needed(cursor, height)

	def repair_rollback_from_height(self, height, sync_state, refresh_entries):
		"""Repairs rollbacked chain and refreshed current state in one transaction."""

		with self._database_transaction() as cursor:
			self._delete_rollback_affected_rows_from_height(cursor, height)
			self._stale_mark_account_refresh_state_if_needed(cursor, height)
			self._execute_namespace_entries(cursor, refresh_entries.namespace_entries)
			self._execute_mosaic_entries(cursor, refresh_entries.mosaic_entries)
			self._execute_metadata_entries(cursor, refresh_entries.metadata_entries)
			self._execute_hash_lock_entries(cursor, refresh_entries.hash_lock_entries)
			self._execute_secret_lock_entries(cursor, refresh_entries.secret_lock_entries)
			self._execute_mosaic_restriction_entries(cursor, refresh_entries.mosaic_restriction_entries)
			self._execute_upsert_sync_state(cursor, sync_state)

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
		cursor.execute('DELETE FROM symbol_hash_locks WHERE updated_at_height >= %s', (height,))
		cursor.execute('DELETE FROM symbol_secret_locks WHERE updated_at_height >= %s', (height,))
		cursor.execute('DELETE FROM symbol_mosaic_restrictions WHERE updated_at_height >= %s', (height,))

	def upsert_transactions_for_height(self, height, transaction_entries):
		"""Replaces persisted Symbol transactions and child index rows for one height atomically."""

		with self._database_transaction() as cursor:
			cursor.execute('DELETE FROM symbol_transaction_mosaics WHERE height = %s', (height,))
			cursor.execute('DELETE FROM symbol_transaction_addresses WHERE height = %s', (height,))
			cursor.execute('DELETE FROM symbol_transactions WHERE height = %s', (height,))
			for entry in transaction_entries:
				transaction_id = SymbolDatabase._insert_transaction(cursor, entry)
				for mosaic_row in entry['mosaic_rows']:
					if 'metadata_target' == mosaic_row['role']:
						mosaic_row = {
							**mosaic_row,
							'mosaic_id': canonical_metadata_hex(mosaic_row['mosaic_id'], 'target id')
						}
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
				LEAST(%(max_fee)s, CAST(%(size)s AS bigint) * (SELECT fee_multiplier FROM symbol_blocks WHERE height = %(height)s)),
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
		"""Replaces receipts for a height and updates its block reward atomically."""

		with self._database_transaction() as cursor:
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
		"""Upserts Symbol block rows atomically."""

		with self._database_transaction() as cursor:
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

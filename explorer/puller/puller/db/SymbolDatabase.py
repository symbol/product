# pylint: disable=too-many-lines
import threading
import time
from collections import namedtuple
from contextlib import contextmanager
from types import MappingProxyType

from common.symbol.ReceiptTypes import RECEIPT_TYPE_LABELS
from common.symbol.Transaction import MESSAGE_TYPE_LABELS
from psycopg2 import Error as PsycopgError
from psycopg2 import errorcodes
from psycopg2.extras import Json
from symbolchain.sc import ReceiptType, TransactionType
from zenlog import log

from puller.model.symbol.Account import ACCOUNT_TYPE_VALUES
from puller.model.symbol.Block import BLOCK_TYPE_VALUES
from puller.model.symbol.ForkRecoveryStopReason import ForkRecoveryStopReason
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
		'mosaic_restriction_entries', 'account_entries'],
	defaults=((), (), (), (), (), (), ()))


RollbackHashLockEvidence = namedtuple(
	'RollbackHashLockEvidence', (
		'keys', 'refund_owner_addresses', 'states', 'prunable_keys', 'has_incomplete_replay', 'pruning_heights', 'receiptless_creations'),
	defaults=(frozenset(), frozenset(), frozenset(), frozenset(), False, MappingProxyType({}), frozenset()))


class AccountRetentionTimeLimit(Exception):
	"""Indicates that the current bounded retention pass reached its deadline."""


class ForkCheckpointConflict(ValueError):
	"""Indicates that stored history or its writer checkpoint changed after reconciliation."""


class ReconciliationStatementError(Exception):
	"""Indicates a failed PostgreSQL statement in the bounded comparison scope."""


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

FORK_RECOVERY_COLUMNS = (
	'verified_height', 'verified_hash', 'verified_epoch', 'verified_point', 'legacy_tip', 'legacy_lock_history',
	'continuity_height', 'continuity_revision', 'reusable_height', 'reusable_hash', 'resume_height', 'stop_reason',
	'block_revision', 'progress', 'invalidations', 'legacy_history_height'
)
FORK_REPLAY_PROGRESS_KEYS = ('replacement_proof', 'replay_hash_lock_keys', 'replay_hash_lock_proof')
FORK_RECOVERY_STOP_REASONS = tuple(reason.value for reason in ForkRecoveryStopReason)
FORK_RECOVERY_DEFINITIONS = [
	'id int PRIMARY KEY DEFAULT 1 CHECK (id = 1)',
	'verified_height bigint',
	'verified_hash bytea',
	'verified_epoch int',
	'verified_point int',
	'legacy_tip bigint',
	'legacy_lock_history boolean NOT NULL',
	'legacy_history_height bigint',
	'continuity_height bigint',
	'continuity_revision bigint NOT NULL DEFAULT 0',
	'reusable_height bigint',
	'reusable_hash bytea',
	'resume_height bigint',
	'stop_reason symbol_fork_recovery_stop_reason',
	'block_revision bigint NOT NULL DEFAULT 0',
	'progress jsonb',
	'invalidations int NOT NULL DEFAULT 0',
	'CHECK ((verified_height IS NULL) = (verified_hash IS NULL))',
	'CHECK ((reusable_height IS NULL) = (reusable_hash IS NULL))'
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
	'valid_run_id',
	'height_ready_run_id',
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
	'valid_run_id varchar',
	'height_ready_run_id varchar',
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
	'address_height bigint',
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
	'ON symbol_metadata(target_address, updated_at_height DESC, composite_hash ASC)',
	'CREATE INDEX IF NOT EXISTS idx_symbol_metadata_target_address_type_height_hash '
	'ON symbol_metadata(target_address, metadata_type, updated_at_height DESC, composite_hash ASC)',
	'CREATE INDEX IF NOT EXISTS idx_symbol_metadata_type_target_id_height_hash '
	'ON symbol_metadata(metadata_type, target_id, updated_at_height DESC, composite_hash ASC)',
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
		self._reconciliation_remaining_ms = None

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
		_create_table(cursor, 'symbol_sync_state', SYMBOL_SYNC_STATE_DEFINITIONS)
		_create_table(cursor, 'symbol_blocks', SYMBOL_BLOCK_DEFINITIONS)
		_create_enum_type(cursor, 'symbol_fork_recovery_stop_reason', FORK_RECOVERY_STOP_REASONS)
		_create_table(cursor, 'symbol_fork_recovery', FORK_RECOVERY_DEFINITIONS)
		# These definitions initialize new tables; upgrade existing account refresh tables with
		# puller.workflows.migrate_account_refresh before starting the new Puller.
		_create_table(cursor, 'symbol_account_refresh_state', SYMBOL_ACCOUNT_REFRESH_STATE_DEFINITIONS)

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
		self._commit()

	def check_connection(self):
		"""Checks whether the configured Symbol database is reachable and initialized."""

		return self.get_sync_state() is not None

	def get_sync_state(self):
		"""Gets the singleton Symbol sync state."""

		cursor = self.connection.cursor()
		self._execute_reconciliation_statement(cursor, f'SELECT {", ".join(SYNC_STATE_COLUMNS)} FROM symbol_sync_state WHERE id = 1')
		result = cursor.fetchone()

		return dict(zip(SYNC_STATE_COLUMNS, result)) if result else None

	def get_maximum_finalized_sync_height(self):
		"""Reads the cap floor on either the current or pre-migration schema."""

		with self._database_transaction() as cursor:
			cursor.execute("SELECT to_regclass('symbol_sync_state'), to_regclass('symbol_fork_recovery')")
			sync_table, recovery_table = cursor.fetchone()
			published_height = verified_height = 0
			if sync_table is not None:
				cursor.execute('SELECT finalized_height FROM symbol_sync_state WHERE id = 1')
				published_height = (cursor.fetchone() or (0,))[0] or 0

			if recovery_table is not None:
				cursor.execute('SELECT verified_height FROM symbol_fork_recovery WHERE id = 1')
				verified_height = (cursor.fetchone() or (0,))[0] or 0

		return max(published_height, verified_height)

	def try_get_fork_recovery_state(self):
		"""Reads the internal recovery state, or returns None if it has no singleton row."""

		with self._database_transaction() as cursor:
			self._execute_reconciliation_statement(cursor, f'SELECT {", ".join(FORK_RECOVERY_COLUMNS)} FROM symbol_fork_recovery WHERE id = 1')
			return self._decode_fork_recovery_state(cursor.fetchone())

	@staticmethod
	def _decode_fork_recovery_state(row):
		if not row:
			return None

		recovery = dict(zip(FORK_RECOVERY_COLUMNS, row))
		for name in ('verified_hash', 'reusable_hash'):
			value = recovery[name]
			recovery[name] = bytes(value) if value is not None else None

		if recovery['stop_reason'] is not None:
			recovery['stop_reason'] = ForkRecoveryStopReason(recovery['stop_reason'])

		progress = recovery['progress'] or {}
		recovery['admin_progress'] = progress.pop('administrative', None)
		recovery['progress'] = progress or None
		return recovery

	def initialize_fork_recovery(self):
		"""Records a verified genesis boundary for a new DB or a pending legacy migration."""

		with self._database_transaction() as cursor:
			cursor.execute("""
				SELECT EXISTS (
					SELECT 1 FROM pg_catalog.pg_attribute
					WHERE attrelid = to_regclass('symbol_fork_recovery')
						AND attname = 'legacy_history_height' AND NOT attisdropped
				)
			""")
			if cursor.fetchone()[0]:
				cursor.execute('SELECT 1 FROM symbol_fork_recovery WHERE id = 1')
				if cursor.fetchone():
					return

		with self._database_transaction() as cursor:
			# Lock before taking the snapshot, including at repeatable read. The block lock also serializes initializers.
			cursor.execute("""
				LOCK TABLE symbol_blocks, symbol_transactions, symbol_transaction_mosaics, symbol_transaction_addresses,
					symbol_receipts, symbol_hash_locks, symbol_secret_locks IN SHARE ROW EXCLUSIVE MODE
			""")
			_create_enum_type(cursor, 'symbol_fork_recovery_stop_reason', FORK_RECOVERY_STOP_REASONS)
			_create_table(cursor, 'symbol_fork_recovery', FORK_RECOVERY_DEFINITIONS)
			cursor.execute('ALTER TABLE symbol_fork_recovery ADD COLUMN IF NOT EXISTS legacy_history_height bigint')
			cursor.execute('SELECT 1 FROM symbol_fork_recovery WHERE id = 1')
			if cursor.fetchone():
				# The cutoff cannot be recovered from history written after an earlier migration.
				return

			cursor.execute("""
				SELECT GREATEST(
						(SELECT MAX(height) FROM symbol_blocks),
						(SELECT MAX(height) FROM symbol_transactions),
						(SELECT MAX(height) FROM symbol_transaction_mosaics),
						(SELECT MAX(height) FROM symbol_transaction_addresses),
						(SELECT MAX(height) FROM symbol_receipts),
						(SELECT MAX(updated_at_height) FROM symbol_hash_locks),
						(SELECT MAX(updated_at_height) FROM symbol_secret_locks)
					),
					EXISTS (
						SELECT 1 FROM symbol_sync_state
						WHERE finalized_height IS NOT NULL OR finalized_hash IS NOT NULL
							OR last_synced_height IS NOT NULL OR last_synced_block_hash IS NOT NULL
							OR dirty_state_from_height IS NOT NULL
					)
			""")
			legacy_history_height, has_legacy_checkpoint = cursor.fetchone()
			if legacy_history_height is not None or has_legacy_checkpoint:
				cursor.execute("""
					INSERT INTO symbol_fork_recovery (legacy_tip, legacy_lock_history, legacy_history_height, stop_reason)
					VALUES (0, true, %s, %s)
				""", (legacy_history_height, ForkRecoveryStopReason.MIGRATION_PENDING.value))
				self._execute_update_legacy_tip(cursor)
			else:
				cursor.execute("""
					INSERT INTO symbol_fork_recovery (verified_height, verified_hash, legacy_lock_history, continuity_height)
					VALUES (0, %s, false, 0)
				""", (bytes(32),))

			# A database trigger also invalidates evidence if an administrator changes history directly.
			cursor.execute("""
				CREATE OR REPLACE FUNCTION symbol_record_block_revision() RETURNS trigger
				LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
				BEGIN
					UPDATE symbol_fork_recovery SET block_revision = pg_catalog.txid_current()
					WHERE id = 1 AND block_revision != pg_catalog.txid_current();
					RETURN NULL;
				END
				$$
			""")
			cursor.execute("""
				CREATE OR REPLACE TRIGGER symbol_record_block_revision
				AFTER INSERT OR UPDATE OF height, hash, previous_hash OR DELETE OR TRUNCATE ON symbol_blocks
				FOR EACH STATEMENT EXECUTE FUNCTION symbol_record_block_revision()
			""")

	def get_contiguous_block_tip(self):
		"""Checks the ordered stored heights and parent links from the genesis boundary."""

		with self._database_transaction() as cursor:
			return self._select_contiguous_block_tip(cursor)

	@staticmethod
	def _select_contiguous_block_tip(cursor):
		cursor.execute("""
			WITH ordered AS (
				SELECT height, ROW_NUMBER() OVER (ORDER BY height) AS expected_height, previous_hash,
					LAG(hash, 1, %s) OVER (ORDER BY height) AS expected_previous_hash
				FROM symbol_blocks
			)
			SELECT COALESCE(MIN(expected_height - 1) FILTER (
				WHERE height != expected_height OR previous_hash != expected_previous_hash
			), MAX(expected_height), 0)
			FROM ordered
		""", (bytes(32),))
		return cursor.fetchone()[0]

	def _execute_update_legacy_tip(self, cursor):
		cursor.execute('SELECT block_revision FROM symbol_fork_recovery WHERE id = 1 AND legacy_tip IS NOT NULL')
		row = cursor.fetchone()
		if row:
			revision = row[0]
			height = self._select_contiguous_block_tip(cursor)
			# A concurrent history change requires a fresh scan on the next run.
			cursor.execute("""
				UPDATE symbol_fork_recovery SET legacy_tip = %s, continuity_revision = %s
				WHERE id = 1 AND block_revision = %s
			""", (height, revision, revision))

	def update_fork_reconciliation(self, progress, invalidations, stop_reason, *, recheck_legacy_tip=False):
		"""Commits comparison progress and the account-refresh gate after a complete evidence page."""

		with self._database_transaction() as cursor:
			if recheck_legacy_tip:
				self._execute_update_legacy_tip(cursor)

			self._execute_update_fork_reconciliation(cursor, progress, invalidations, stop_reason)

	def discard_transient_fork_progress(self, expected, progress):
		"""Discards only the abandoned comparison owned by an unchanged clean checkpoint."""

		try:
			with self._database_transaction() as cursor:
				self._execute_lock_fork_checkpoint(cursor, expected)
				cursor.execute("""
					UPDATE symbol_fork_recovery SET progress = NULL, stop_reason = NULL
					WHERE id = 1 AND progress = %(progress)s AND invalidations = %(invalidations)s
						AND stop_reason = %(stop_reason)s AND legacy_tip IS NULL AND resume_height IS NULL
						AND NOT (progress ?| %(replay_keys)s::text[])
						AND EXISTS (SELECT 1 FROM symbol_sync_state WHERE id = 1 AND status = 'healthy')
				""", {
					'progress': Json(progress),
					'invalidations': expected['invalidations'],
					'stop_reason': ForkRecoveryStopReason.RECONCILIATION_WAIT.value,
					'replay_keys': list(FORK_REPLAY_PROGRESS_KEYS)
				})
				return bool(cursor.rowcount)
		except ForkCheckpointConflict:
			return False

	def stop_fork_recovery(self, reason):
		"""Marks recovery blocked and changes only the public health status."""

		with self._database_transaction() as cursor:
			cursor.execute('UPDATE symbol_fork_recovery SET stop_reason = %s WHERE id = 1', (reason.value,))
			cursor.execute("""
				INSERT INTO symbol_sync_state (id, status) VALUES (1, 'unhealthy')
				ON CONFLICT (id) DO UPDATE SET status = 'unhealthy', updated_at = CURRENT_TIMESTAMP
			""")

	def reopen_fork_reconciliation(self, expected, stop_reason, proof):
		"""Reopens a terminal stop after its history and checkpoint have been verified."""

		with self._database_transaction() as cursor:
			self._execute_lock_terminal_stop(cursor, expected)
			self._execute_update_fork_reconciliation(cursor, proof, 0, stop_reason)

	def _execute_update_fork_reconciliation(self, cursor, progress, invalidations, stop_reason):
		# Repair and normal checkpoints own the durable replay keys. Keep them from the locked row.
		self._execute_reconciliation_statement(cursor, """
			UPDATE symbol_fork_recovery SET
				progress = NULLIF((COALESCE(%(progress)s::jsonb, '{}'::jsonb) - %(replay_keys)s::text[]) || COALESCE((
					SELECT jsonb_object_agg(key, progress -> key)
					FROM unnest(%(replay_keys)s::text[]) AS replay(key)
					WHERE progress ? key
				), '{}'::jsonb), '{}'::jsonb),
				invalidations = %(invalidations)s, stop_reason = %(stop_reason)s
			WHERE id = 1
		""", {
			'progress': Json(progress) if progress is not None else None,
			'replay_keys': list(FORK_REPLAY_PROGRESS_KEYS),
			'invalidations': invalidations,
			'stop_reason': stop_reason.value if stop_reason is not None else None
		})

	def save_fork_admin_proof(self, expected, proof):
		"""Stores only the administrative proof while the terminal stop is still in force."""

		with self._database_transaction() as cursor:
			self._execute_lock_terminal_stop(cursor, expected)
			if proof is None:
				cursor.execute("UPDATE symbol_fork_recovery SET progress = NULLIF(progress - 'administrative', '{}'::jsonb) WHERE id = 1")
			else:
				cursor.execute("""
					UPDATE symbol_fork_recovery SET progress = COALESCE(progress, '{}'::jsonb) || %s WHERE id = 1
				""", (Json({'administrative': proof}),))

	@classmethod
	def _execute_lock_terminal_stop(cls, cursor, expected):
		cls._execute_lock_fork_checkpoint(cursor, expected)
		cursor.execute('SELECT stop_reason, invalidations FROM symbol_fork_recovery WHERE id = 1 FOR UPDATE')
		if (ForkRecoveryStopReason.EVIDENCE_INVALIDATED.value, expected['invalidations']) != cursor.fetchone():
			raise ValueError('Terminal Symbol recovery stop changed before commit')

	@classmethod
	def _execute_apply_fork_checkpoint(cls, cursor, recovery, *, should_publish_reusable_tip):
		stop_reason = recovery['stop_reason']
		recovery_values = {
			**recovery, 'stop_reason': stop_reason.value if stop_reason is not None else None,
			'should_publish_reusable_tip': should_publish_reusable_tip,
			'progress': Json(recovery['replay_progress']) if recovery.get('replay_progress') else None
		}
		cursor.execute(f"""
			UPDATE symbol_fork_recovery SET
				verified_height = %(verified_height)s, verified_hash = %(verified_hash)s,
				verified_epoch = %(verified_epoch)s, verified_point = %(verified_point)s,
				legacy_tip = NULL, continuity_height = %(continuity_height)s, continuity_revision = block_revision,
				reusable_height = CASE WHEN %(should_publish_reusable_tip)s THEN %(reusable_height)s ELSE reusable_height END,
				reusable_hash = CASE WHEN %(should_publish_reusable_tip)s THEN %(reusable_hash)s ELSE reusable_hash END,
				resume_height = %(resume_height)s, stop_reason = %(stop_reason)s,
				progress = %(progress)s, invalidations = 0
			WHERE id = 1
			RETURNING {', '.join(FORK_RECOVERY_COLUMNS)}
		""", recovery_values)
		return cls._decode_fork_recovery_state(cursor.fetchone())

	@staticmethod
	def _execute_invalidate_reusable_tip(cursor, height=None):
		cursor.execute("""
			UPDATE symbol_fork_recovery SET reusable_height = NULL, reusable_hash = NULL
			WHERE id = 1 AND reusable_height IS NOT NULL AND (%(height)s IS NULL OR %(height)s <= reusable_height)
		""", {'height': height})

	def upsert_sync_state(self, sync_state):
		"""Upserts the singleton Symbol sync state."""

		with self._database_transaction() as cursor:
			self._execute_upsert_sync_state(cursor, sync_state)

	def checkpoint_sync_state(self, sync_state):
		"""Publishes a verified synchronization checkpoint and returns its committed recovery state."""

		committed_recovery = None
		with self._database_transaction() as cursor:
			recovery = sync_state.get('fork_recovery')
			if recovery is not None:
				self._execute_check_fork_checkpoint(cursor, sync_state, recovery)
				committed_recovery = self._execute_apply_fork_checkpoint(cursor, recovery, should_publish_reusable_tip=True)

			self._execute_upsert_sync_state(cursor, sync_state)

		return committed_recovery

	@staticmethod
	def _execute_lock_fork_checkpoint(cursor, recovery):
		# The workflow lock excludes other Pullers. Re-read the writer's watermark and
		# evidence in the commit transaction as well, so a stale plan cannot clear a marker.
		cursor.execute("""
			SELECT last_synced_height, last_synced_block_hash, dirty_state_from_height
			FROM symbol_sync_state WHERE id = 1 FOR UPDATE
		""")
		height, block_hash, dirty = cursor.fetchone() or (None, None, None)
		current = (height, bytes(block_hash) if block_hash is not None else None, dirty)
		if current != recovery['expected_sync']:
			raise ForkCheckpointConflict('Symbol synchronization checkpoint changed before commit')

		cursor.execute('SELECT block_revision FROM symbol_fork_recovery WHERE id = 1 FOR UPDATE')
		if cursor.fetchone()[0] != recovery['expected_revision']:
			raise ForkCheckpointConflict('Stored Symbol block history changed before recovery commit')

	@classmethod
	def _execute_check_fork_checkpoint(cls, cursor, sync_state, recovery):
		cls._execute_lock_fork_checkpoint(cursor, recovery)
		verified_height = recovery['verified_height']
		next_height = sync_state['last_synced_height'] or 0
		next_dirty = sync_state['dirty_state_from_height']
		if verified_height > next_height or (next_dirty is not None and verified_height >= next_dirty):
			raise ValueError('Verified finalization exceeds clean synchronization range')

		cls._execute_check_block_hash(cursor, next_height, sync_state['last_synced_block_hash'], 'Checkpoint')
		cls._execute_check_block_hash(cursor, verified_height, recovery['verified_hash'], 'Finalized')

	@staticmethod
	def _execute_check_block_hash(cursor, height, block_hash, label):
		if height:
			cursor.execute('SELECT hash FROM symbol_blocks WHERE height = %s FOR SHARE', (height,))
			row = cursor.fetchone()
			if row is None or bytes(row[0]) != block_hash:
				raise ValueError(f'{label} block hash does not match local database')

	def mark_sync_write_intent(self, height, *, expected_checkpoint=None):
		"""Persists the earliest write height, optionally guarded by a reconciled checkpoint."""

		with self._database_transaction() as cursor:
			if expected_checkpoint is not None:
				self._execute_lock_fork_checkpoint(cursor, expected_checkpoint)

			self._execute_invalidate_reusable_tip(cursor, height)
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
		"""Updates failure status without replacing checkpoints or their markers."""

		with self._database_transaction() as cursor:
			self._execute_mark_sync_unhealthy(cursor)

	@staticmethod
	def _execute_mark_sync_unhealthy(cursor):
		cursor.execute("""
			UPDATE symbol_sync_state
			SET status = 'unhealthy', updated_at = CURRENT_TIMESTAMP
			WHERE id = 1
		""")

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
			self._set_reconciliation_statement_timeout(cursor)
			self._commit()
		except Exception as exception:
			self.connection.rollback()
			if self._reconciliation_remaining_ms is not None and isinstance(exception, PsycopgError):
				raise ReconciliationStatementError() from exception

			raise

	@contextmanager
	def reconciliation_statements(self, remaining_ms):
		"""Bounds comparison statements inside the exclusive Symbol workflow."""

		previous_remaining_ms = self._reconciliation_remaining_ms
		self._reconciliation_remaining_ms = remaining_ms
		try:
			yield
		finally:
			self._reconciliation_remaining_ms = previous_remaining_ms

	@contextmanager
	def independent_reconciliation(self):
		"""Preserves independent SQL timeouts while classifying reconciliation errors."""

		with self.reconciliation_statements(None):
			try:
				yield
			except PsycopgError as exception:
				raise ReconciliationStatementError() from exception

	def _execute_reconciliation_statement(self, cursor, statement, parameters=()):
		self._set_reconciliation_statement_timeout(cursor)
		cursor.execute(statement, parameters)

	def _set_reconciliation_statement_timeout(self, cursor):
		if self._reconciliation_remaining_ms is None:
			return

		remaining_ms = self._reconciliation_remaining_ms()
		if remaining_ms <= 0:
			raise ReconciliationStatementError()

		cursor.execute("""
			SELECT pg_catalog.set_config(
				'statement_timeout', LEAST(%(remaining)s, COALESCE(NULLIF(setting::int, 0), %(remaining)s))::text, true)
			FROM pg_catalog.pg_settings WHERE name = 'statement_timeout'
		""", {'remaining': remaining_ms})

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
		self._execute_upsert_multisig(cursor, address, multisig_row_or_none)
		self._commit()

	@staticmethod
	def _execute_upsert_multisig(cursor, address, multisig_row_or_none):
		if multisig_row_or_none is None:
			cursor.execute('DELETE FROM symbol_multisig WHERE address = %s', (address,))
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
				snapshot_at,
				address_height
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
				%(snapshot_at)s,
				%(address_height)s
			)
			ON CONFLICT (refresh_run_id, address) DO UPDATE SET
				address_text = EXCLUDED.address_text,
				account_search_order = EXCLUDED.account_search_order,
				public_key = EXCLUDED.public_key,
				account_type = EXCLUDED.account_type,
				importance = EXCLUDED.importance,
				importance_percentage = EXCLUDED.importance_percentage,
				snapshot_height = EXCLUDED.snapshot_height,
				snapshot_at = EXCLUDED.snapshot_at,
				address_height = EXCLUDED.address_height
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
			if account_entries:
				self._execute_invalidate_reusable_tip(cursor)

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
				SELECT COALESCE(SUM(importance), 0), COUNT(*) FILTER (WHERE address_height IS NULL)
				FROM symbol_account_refresh_accounts
				WHERE refresh_run_id = %s
				''',
				(refresh_run_id,))
			total_importance, missing_height_count = cursor.fetchone()
			# Legacy rows may have NULL heights; a newly published generation must be complete.
			if missing_height_count:
				raise RuntimeError('Symbol account refresh has missing address heights')

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
					valid_run_id = %s, height_ready_run_id = %s,
					last_completed_at = %s, last_completed_height = %s, status = 'healthy',
					last_error = NULL, updated_at = CURRENT_TIMESTAMP
				WHERE id = 1 AND running_run_id = %s
			''', (refresh_run_id, refresh_run_id, refresh_run_id, completed_at, completed_height, refresh_run_id))

	def get_block_hash(self, height):
		"""Gets a block hash by height."""

		with self._database_transaction() as cursor:
			self._execute_reconciliation_statement(cursor, 'SELECT hash FROM symbol_blocks WHERE height = %s', (height,))
			result = cursor.fetchone()

		return result[0] if result else None

	def get_block_hashes(self, start_height, end_height):
		"""Gets block hashes for an inclusive height range."""

		with self._database_transaction() as cursor:
			cursor.execute(
				'''
				SELECT height, hash
				FROM symbol_blocks
				WHERE height BETWEEN %s AND %s
				ORDER BY height ASC
				''',
				(start_height, end_height))
			block_hashes = cursor.fetchall()

		return block_hashes

	def get_block_chain_evidence(self, start_height, end_height):
		"""Gets the stored hashes and parent links for a bounded comparison page."""

		with self._database_transaction() as cursor:
			self._execute_reconciliation_statement(cursor, """
				SELECT height, hash, previous_hash FROM symbol_blocks
				WHERE height BETWEEN %s AND %s ORDER BY height
			""", (start_height, end_height))
			return cursor.fetchall()

	def get_max_block_height(self):
		"""Gets the highest persisted block height, including an incomplete dirty batch."""

		with self._database_transaction() as cursor:
			self._execute_reconciliation_statement(cursor, 'SELECT MAX(height) FROM symbol_blocks')
			result = cursor.fetchone()

		return result[0] if result else None

	def get_rollback_account_addresses(self, height):
		"""Gets account keys touched by orphaned block beneficiaries, transaction roles, or receipt addresses."""

		restriction_types = (
			TransactionType.ACCOUNT_ADDRESS_RESTRICTION.value,
			TransactionType.MOSAIC_ADDRESS_RESTRICTION.value)
		with self._database_transaction() as cursor:
			cursor.execute(
				'''
				SELECT address FROM (
					SELECT beneficiary_address AS address FROM symbol_blocks WHERE height >= %s
					UNION
					SELECT transaction_address.address
					FROM symbol_transaction_addresses AS transaction_address
					JOIN symbol_transactions AS t ON t.id = transaction_address.transaction_id
					WHERE transaction_address.height >= %s
					AND NOT (t.type = ANY(%s) AND transaction_address.role = 'target')
					UNION
					SELECT target_address AS address FROM symbol_receipts WHERE height >= %s AND target_address IS NOT NULL
					UNION
					SELECT sender_address AS address FROM symbol_receipts WHERE height >= %s AND sender_address IS NOT NULL
					UNION
					SELECT recipient_address AS address FROM symbol_receipts WHERE height >= %s AND recipient_address IS NOT NULL
				) AS rollback_addresses
				WHERE address IS NOT NULL
				ORDER BY address
				''',
				(height, height, list(restriction_types), height, height, height))
			rows = cursor.fetchall()

		return [bytes(row[0]) for row in rows]

	def get_rollback_inflation_mosaic_ids(self, height):
		"""Gets mosaic ids paid by orphaned inflation receipts before those receipts are deleted."""

		with self._database_transaction() as cursor:
			cursor.execute(
				'''
				SELECT DISTINCT mosaic_id
				FROM symbol_receipts
				WHERE height >= %s AND receipt_group = 'inflation' AND mosaic_id IS NOT NULL
				ORDER BY mosaic_id
				''',
				(height,))
			rows = cursor.fetchall()

		return [row[0] for row in rows]

	def get_rollback_beneficiary_timestamps(self, height, addresses):
		"""Gets the latest surviving beneficiary block timestamp for each supplied account key."""

		if not addresses:
			return {}

		with self._database_transaction() as cursor:
			cursor.execute(
				'''
				SELECT beneficiary_address, MAX(timestamp)
				FROM symbol_blocks
				WHERE height < %s AND beneficiary_address = ANY(%s)
				GROUP BY beneficiary_address
				''',
				(height, addresses))
			rows = cursor.fetchall()

		return {bytes(address): timestamp for address, timestamp in rows}

	def try_get_rollback_hash_lock_evidence(  # pylint: disable=too-many-arguments,too-many-locals
		self, height, common_height, finalized_height, *, replay_end, additional_keys=(), allow_receiptless_creations=False
	):
		"""Returns affected keys, refund owners and proven retained state and pruning bounds, or None for incomplete evidence."""

		lock_transaction_types = (
			TransactionType.AGGREGATE_BONDED.value, TransactionType.HASH_LOCK.value,
			TransactionType.SECRET_LOCK.value, TransactionType.SECRET_PROOF.value)
		lock_receipt_types = tuple(
			receipt_type.value
			for receipt_type in (
				ReceiptType.LOCK_HASH_CREATED,
				ReceiptType.LOCK_HASH_COMPLETED,
				ReceiptType.LOCK_HASH_EXPIRED,
				ReceiptType.LOCK_SECRET_CREATED,
				ReceiptType.LOCK_SECRET_COMPLETED,
				ReceiptType.LOCK_SECRET_EXPIRED))
		# At Catapult b3222548d6c8, CompletedAggregateObserver uses the aggregate entity hash as the
		# lock key and credits the lock owner. Neither it nor HashLockObserver includes the key in
		# its receipt. NotificationPublisher uses a one-based source for each top-level transaction.
		# Core validates activity against the latest creation at the transaction source. LockInfo::isActive
		# requires that creation to be unused and unexpired, even when an earlier creation is still stored.
		# The current row can reflect another proven lifetime of the same key.
		# LockInfoHistory::prune removes oldest first, so every retained lifetime must reach its end for deletion.
		# When a matching dirty block is incomplete, canonical events will be refetched and verified before repair.
		# Normal ingestion stores the original receipt code. Treat a code that cannot be reconciled with its label as unproven.
		# Decimal strings can contain the sign, padding and between-digit underscores accepted by int().
		# Receiptless creation candidates can explain a provisional current row. They must be re-proven on the canonical branch.
		with self._database_transaction() as cursor:
			self._execute_reconciliation_statement(
				cursor,
				'''
				WITH retained_replay_keys AS (
					SELECT UNNEST(%(additional_keys)s::text[]) AS lock_hash
				), incomplete_replay AS (
					SELECT 1 FROM symbol_blocks AS b WHERE b.height BETWEEN %(height)s AND %(replay_end)s
						AND (b.transactions_count, b.total_transactions_count) <> (
							SELECT COUNT(*) FILTER (WHERE NOT t.is_embedded), COUNT(*)
							FROM symbol_transactions AS t WHERE t.height = b.height)
					LIMIT 1
				), tail_events AS (
					SELECT id, height, type, type_name, is_embedded, signer_public_key, signer_address, raw_payload, body, hash
					FROM symbol_transactions
					WHERE height >= %(height)s AND (
						type = ANY(%(transaction_types)s) OR type_name::text = ANY(%(transaction_labels)s)
						OR raw_payload #>> '{transaction,type}' = ANY(%(raw_transaction_types)s))
				), tail_hash_lock_keys AS (
					SELECT lock_hash FROM retained_replay_keys
					UNION ALL
					SELECT UPPER(ENCODE(hash, 'hex')) AS lock_hash FROM tail_events
					WHERE type = %(aggregate_type)s OR type_name::text = %(aggregate_label)s
						OR raw_payload #>> '{transaction,type}' = %(aggregate_type)s::text
					UNION ALL
					SELECT UPPER(lock_key.value)
					FROM tail_events
					CROSS JOIN LATERAL (VALUES (body ->> 'hash'), (raw_payload #>> '{transaction,hash}')) AS lock_key(value)
					WHERE type = %(hash_lock_type)s OR type_name::text = %(hash_lock_label)s
						OR raw_payload #>> '{transaction,type}' = %(hash_lock_type)s::text
				), creation_candidates AS (
					SELECT id, height, type, type_name, is_embedded, signer_public_key, signer_address, raw_payload, body, hash,
						UPPER(body ->> 'hash') AS lock_hash
					FROM (
						SELECT * FROM tail_events
						UNION ALL
						SELECT id, height, type, type_name, is_embedded, signer_public_key, signer_address, raw_payload, body, hash
						FROM symbol_transactions AS earlier
						WHERE height < %(height)s
							AND EXISTS (
								SELECT 1 FROM tail_hash_lock_keys AS k
								WHERE k.lock_hash IN (UPPER(earlier.body ->> 'hash'), UPPER(earlier.raw_payload #>> '{transaction,hash}')))
					) AS t
					WHERE type = %(hash_lock_type)s OR type_name::text = %(hash_lock_label)s
						OR raw_payload #>> '{transaction,type}' = %(hash_lock_type)s::text
				), aggregate_candidates AS (
					SELECT *, UPPER(ENCODE(hash, 'hex')) AS lock_hash
					FROM (
						SELECT * FROM tail_events
						UNION ALL
						SELECT id, height, type, type_name, is_embedded, signer_public_key, signer_address, raw_payload, body, hash
						FROM symbol_transactions AS earlier
						WHERE height < %(height)s AND EXISTS (
							SELECT 1 FROM tail_hash_lock_keys AS k
							WHERE k.lock_hash IN (UPPER(ENCODE(earlier.hash, 'hex')), UPPER(earlier.raw_payload #>> '{meta,hash}')))
					) AS t
					WHERE type = %(aggregate_type)s OR type_name::text = %(aggregate_label)s
						OR raw_payload #>> '{transaction,type}' = %(aggregate_type)s::text
				), aggregates AS (
					SELECT id, height, signer_address, signer_public_key, raw_payload, hash, lock_hash
					FROM aggregate_candidates
					WHERE type = %(aggregate_type)s AND type_name::text = %(aggregate_label)s AND NOT is_embedded
						AND raw_payload #> '{transaction,type}' = to_jsonb(type) AND NOT ((raw_payload -> 'meta') ? 'aggregateHash')
						AND octet_length(hash) = 32 AND jsonb_typeof(raw_payload #> '{meta,hash}') = 'string'
						AND (raw_payload #>> '{meta,hash}') ~ '^[0-9A-Fa-f]{64}$'
						AND UPPER(raw_payload #>> '{meta,hash}') = lock_hash
				), proven_hash_locks AS (
					SELECT id, height, signer_address, signer_public_key, raw_payload, body, lock_hash, hash AS transaction_hash
					FROM creation_candidates
					WHERE type = %(hash_lock_type)s AND type_name::text = %(hash_lock_label)s AND NOT is_embedded
						AND raw_payload #> '{transaction,type}' = to_jsonb(type) AND NOT ((raw_payload -> 'meta') ? 'aggregateHash')
						AND jsonb_typeof(body -> 'hash') = 'string' AND lock_hash ~ '^[0-9A-F]{64}$'
						AND jsonb_typeof(raw_payload #> '{transaction,hash}') = 'string'
						AND (raw_payload #>> '{transaction,hash}') ~ '^[0-9A-Fa-f]{64}$'
						AND lock_hash = UPPER(raw_payload #>> '{transaction,hash}')
						AND octet_length(signer_address) = 24
						AND EXISTS (
							SELECT 1 FROM symbol_transaction_addresses AS a
							WHERE a.transaction_id = creation_candidates.id AND a.height = creation_candidates.height
								AND a.role = 'signer' AND a.address = creation_candidates.signer_address)
				), unique_lock_sources AS (
					SELECT t.*, t.raw_payload #> '{meta,index}' AS source_index
					FROM (
						SELECT id, height, signer_address, signer_public_key, raw_payload, lock_hash FROM proven_hash_locks
						UNION ALL
						SELECT id, height, signer_address, signer_public_key, raw_payload, lock_hash FROM aggregates
					) AS t
					WHERE t.raw_payload #>> '{meta,height}' = t.height::text
						AND (t.raw_payload #>> '{meta,index}') ~ '^[0-9]+$'
						AND jsonb_typeof(t.raw_payload #> '{meta,index}') = 'number'
						AND t.raw_payload #> '{meta,index}' < to_jsonb(2147483647)
						AND 1 = (
							SELECT COUNT(*) FROM symbol_transactions AS same_source
							WHERE same_source.height = t.height AND NOT same_source.is_embedded
								AND same_source.raw_payload #> '{meta,index}' = t.raw_payload #> '{meta,index}')
				), creation_facts AS (
					SELECT t.*, lock.body, lock.transaction_hash, m.mosaic_id, m.amount,
						CASE WHEN lock.body -> 'duration' = t.raw_payload #> '{transaction,duration}'
							AND (t.raw_payload #>> '{transaction,duration}') ~ '^[0-9]{1,20}$'
							THEN t.height + (t.raw_payload #>> '{transaction,duration}')::numeric
						END AS end_height
					FROM unique_lock_sources AS t
					JOIN proven_hash_locks AS lock ON lock.id = t.id
					JOIN symbol_transaction_mosaics AS m ON m.transaction_id = t.id AND m.height = t.height
						AND m.role = 'hash_lock' AND m.position = 0 AND m.mosaic_id ~ '^[0-7][0-9A-Fa-f]{15}$' AND m.amount > 0
				), proven_creations AS (
					SELECT t.*, r.id AS receipt_id
					FROM creation_facts AS t
					JOIN symbol_receipts AS r ON r.height = t.height AND r.receipt_type::text = %(hash_created_label)s
						AND (r.raw_payload -> 'type' = to_jsonb(%(hash_created_type)s)
							OR REGEXP_REPLACE(REGEXP_REPLACE(r.raw_payload ->> 'type', '(?<=[0-9])_(?=[0-9])', '', 'g'),
								'^[[:space:]]*[+]?0*|[[:space:]]+$', '', 'g')
								= %(hash_created_type)s::text)
						AND r.source_primary_id > 0 AND r.source_secondary_id = 0
						AND t.source_index = to_jsonb(r.source_primary_id::numeric - 1)
						AND t.signer_address = r.target_address AND UPPER(t.mosaic_id) = UPPER(r.mosaic_id) AND t.amount = r.amount
						AND jsonb_typeof(r.raw_payload -> 'targetAddress') = 'string'
						AND UPPER(r.raw_payload ->> 'targetAddress') = UPPER(ENCODE(r.target_address, 'hex'))
					WHERE 1 = (
						SELECT COUNT(*) FROM symbol_receipts AS same_source
						WHERE same_source.height = r.height AND same_source.receipt_type = r.receipt_type
							AND same_source.source_primary_id = r.source_primary_id AND same_source.source_secondary_id = 0)
						AND 1 = (
							SELECT COUNT(*) FROM symbol_transaction_mosaics AS relation
							WHERE relation.transaction_id = t.id AND relation.role = 'hash_lock' AND relation.position = 0)
				), proven_lifetimes AS (
					SELECT creation.*
					FROM proven_creations AS creation
					WHERE creation.end_height > creation.height AND creation.end_height <= %(max_end_height)s
						AND jsonb_typeof(creation.raw_payload #> '{transaction,signerPublicKey}') = 'string'
						AND octet_length(creation.signer_public_key) = 32
						AND UPPER(creation.raw_payload #>> '{transaction,signerPublicKey}') = UPPER(ENCODE(creation.signer_public_key, 'hex'))
				), receiptless_creations AS (
					SELECT t.id, t.height, t.lock_hash, t.transaction_hash
					FROM creation_facts AS t
					JOIN symbol_blocks AS b ON b.height = t.height
					WHERE %(allow_receiptless_creations)s AND t.height BETWEEN %(height)s AND %(replay_end)s
						AND b.receipts_hash = %(zero_hash)s AND b.statements_count = 0
						AND NOT EXISTS (SELECT 1 FROM symbol_receipts AS r WHERE r.height = t.height)
						AND octet_length(t.transaction_hash) = 32
						AND UPPER(t.raw_payload #>> '{meta,hash}') = UPPER(ENCODE(t.transaction_hash, 'hex'))
						AND octet_length(t.signer_public_key) = 32
						AND UPPER(t.raw_payload #>> '{transaction,signerPublicKey}') = UPPER(ENCODE(t.signer_public_key, 'hex'))
						AND jsonb_typeof(t.raw_payload #> '{transaction,mosaicId}') = 'string'
						AND t.body -> 'mosaicId' = t.raw_payload #> '{transaction,mosaicId}'
						AND UPPER(t.raw_payload #>> '{transaction,mosaicId}') = UPPER(t.mosaic_id)
						AND t.amount = CASE WHEN (t.raw_payload #>> '{transaction,amount}') ~ '^[0-9]{1,20}$'
							THEN (t.raw_payload #>> '{transaction,amount}')::numeric END
						AND t.end_height > t.height AND t.end_height <= %(max_end_height)s
						AND 1 = (SELECT COUNT(*) FROM symbol_transaction_mosaics AS relation WHERE relation.transaction_id = t.id)
						AND NOT EXISTS (
							SELECT 1 FROM creation_candidates AS earlier WHERE earlier.height < %(height)s
								AND t.lock_hash IN (earlier.lock_hash, UPPER(earlier.raw_payload #>> '{transaction,hash}')))
						AND NOT EXISTS (
							SELECT 1 FROM symbol_hash_locks AS current_lock
							WHERE current_lock.hash = DECODE(t.lock_hash, 'hex') AND (
								current_lock.updated_at_height < t.height OR
								(current_lock.owner_address, UPPER(current_lock.mosaic_id), current_lock.amount,
									current_lock.end_height, current_lock.status::text) IS DISTINCT FROM
									(t.signer_address, UPPER(t.mosaic_id), t.amount, t.end_height, 'unused')))
				), proven_aggregates AS (
					SELECT t.id, t.height, t.lock_hash, t.source_index, creation.id AS creation_id,
						creation.signer_address AS owner_address, creation.mosaic_id, creation.amount
					FROM unique_lock_sources AS t
					JOIN aggregates AS a ON a.id = t.id
					CROSS JOIN LATERAL (
						SELECT * FROM proven_lifetimes AS c
						WHERE c.lock_hash = t.lock_hash AND (c.height, c.source_index) < (t.height, t.source_index)
						ORDER BY c.height DESC, c.source_index DESC
						LIMIT 1
					) AS creation
					WHERE octet_length(t.signer_address) = 24
						AND t.height < creation.end_height
						AND EXISTS (
							SELECT 1 FROM symbol_transaction_addresses AS signer
							WHERE signer.transaction_id = t.id AND signer.height = t.height
								AND signer.role = 'signer' AND signer.address = t.signer_address)
						AND NOT EXISTS (
							SELECT 1 FROM creation_candidates AS candidate
							LEFT JOIN unique_lock_sources AS source ON source.id = candidate.id
							LEFT JOIN proven_lifetimes AS lifetime ON lifetime.id = candidate.id
							WHERE lifetime.id IS NULL AND candidate.height <= t.height
								AND t.lock_hash IN (candidate.lock_hash, UPPER(candidate.raw_payload #>> '{transaction,hash}'))
								AND (candidate.height < t.height OR source.source_index IS NULL OR source.source_index <= t.source_index))
						AND NOT EXISTS (
							SELECT 1 FROM aggregate_candidates AS previous
							LEFT JOIN unique_lock_sources AS source ON source.id = previous.id
							WHERE previous.id <> t.id AND previous.height BETWEEN creation.height AND t.height
								AND t.lock_hash IN (previous.lock_hash, UPPER(previous.raw_payload #>> '{meta,hash}'))
								AND (previous.height > creation.height OR source.source_index IS NULL OR source.source_index > creation.source_index)
								AND (previous.height < t.height OR source.source_index IS NULL OR source.source_index < t.source_index))
						AND (t.height BETWEEN %(height)s AND %(replay_end)s AND EXISTS (SELECT 1 FROM incomplete_replay)
							OR NOT EXISTS (
							SELECT 1 FROM symbol_hash_locks AS current_lock WHERE current_lock.hash = a.hash
								AND NOT EXISTS (
									SELECT 1 FROM proven_lifetimes AS current_creation
									WHERE current_creation.lock_hash = t.lock_hash
										AND current_lock.owner_address = current_creation.signer_address
										AND UPPER(current_lock.mosaic_id) = UPPER(current_creation.mosaic_id)
										AND current_lock.amount = current_creation.amount
										AND current_lock.end_height = current_creation.end_height)))
				), proven_completions AS (
					SELECT r.id AS receipt_id, t.id AS transaction_id, t.height, t.source_index, t.creation_id
					FROM proven_aggregates AS t
					JOIN symbol_receipts AS r ON r.height = t.height AND r.receipt_type::text = %(hash_completed_label)s
						AND (r.raw_payload -> 'type' = to_jsonb(%(hash_completed_type)s)
							OR REGEXP_REPLACE(REGEXP_REPLACE(r.raw_payload ->> 'type', '(?<=[0-9])_(?=[0-9])', '', 'g'),
								'^[[:space:]]*[+]?0*|[[:space:]]+$', '', 'g')
								= %(hash_completed_type)s::text)
						AND r.source_primary_id > 0 AND r.source_secondary_id = 0
						AND t.source_index = to_jsonb(r.source_primary_id::numeric - 1)
						AND t.owner_address = r.target_address AND UPPER(t.mosaic_id) = UPPER(r.mosaic_id) AND t.amount = r.amount
						AND jsonb_typeof(r.raw_payload -> 'targetAddress') = 'string'
						AND UPPER(r.raw_payload ->> 'targetAddress') = UPPER(ENCODE(r.target_address, 'hex'))
					WHERE 1 = (
						SELECT COUNT(*) FROM symbol_receipts AS same_source
						WHERE same_source.height = r.height AND same_source.receipt_type = r.receipt_type
							AND same_source.source_primary_id = r.source_primary_id AND same_source.source_secondary_id = 0)
				), unproven_reuses AS (
					SELECT later.lock_hash, later.height, later.source_index
					FROM (
						SELECT lock_hash, height, source_index,
							LAG(id) OVER (PARTITION BY lock_hash ORDER BY height, source_index) AS previous_id
						FROM proven_lifetimes
					) AS later
					JOIN proven_lifetimes AS previous ON previous.id = later.previous_id
					WHERE later.height < previous.end_height AND NOT EXISTS (
						SELECT 1 FROM proven_completions AS completion WHERE completion.creation_id = previous.id
							AND (completion.height, completion.source_index) < (later.height, later.source_index))
				), proven_receipts AS (
					SELECT receipt_id AS id FROM proven_creations
					UNION ALL
					SELECT receipt_id AS id FROM proven_completions
				), proven_events AS (
					SELECT id, lock_hash FROM proven_hash_locks WHERE height >= %(height)s
					UNION ALL
					SELECT t.id, t.lock_hash FROM proven_aggregates AS t WHERE t.height >= %(height)s
						AND NOT EXISTS (
							SELECT 1 FROM unproven_reuses AS reuse WHERE reuse.lock_hash = t.lock_hash
								AND (reuse.height, reuse.source_index) < (t.height, t.source_index))
				), affected_keys AS (
					SELECT lock_hash FROM proven_events UNION SELECT lock_hash FROM retained_replay_keys
				), shared_creations AS (
					SELECT * FROM proven_lifetimes WHERE height <= %(common_height)s
				), applicable_creations AS (
					SELECT c.*, EXISTS (
						SELECT 1 FROM proven_completions AS completion WHERE completion.creation_id = c.id
							AND completion.height <= %(common_height)s AND completion.height < c.end_height) AS was_used
					FROM shared_creations AS c
					JOIN affected_keys AS k ON k.lock_hash = c.lock_hash
					WHERE NOT EXISTS (
						SELECT 1 FROM unproven_reuses AS reuse WHERE reuse.lock_hash = c.lock_hash AND reuse.height <= %(common_height)s)
						AND NOT EXISTS (
						SELECT 1 FROM aggregate_candidates AS candidate
						LEFT JOIN unique_lock_sources AS source ON source.id = candidate.id
						WHERE candidate.height BETWEEN c.height AND %(common_height)s
							AND c.lock_hash IN (candidate.lock_hash, UPPER(candidate.raw_payload #>> '{meta,hash}'))
							AND (candidate.height > c.height OR source.source_index IS NULL OR source.source_index > c.source_index)
							AND NOT EXISTS (
								SELECT 1 FROM proven_completions AS completion
								WHERE completion.transaction_id = candidate.id AND completion.creation_id = c.id
									AND completion.height < c.end_height))
						AND NOT EXISTS (
							SELECT 1 FROM creation_candidates AS candidate
							LEFT JOIN unique_lock_sources AS source ON source.id = candidate.id
							WHERE candidate.id <> c.id AND candidate.height BETWEEN c.height AND %(common_height)s
								AND c.lock_hash IN (candidate.lock_hash, UPPER(candidate.raw_payload #>> '{transaction,hash}'))
								AND (candidate.height > c.height OR source.source_index IS NULL OR source.source_index > c.source_index))
				), pruning_heights AS (
					SELECT k.lock_hash, COALESCE((
						SELECT MAX(c.end_height) FROM shared_creations AS c WHERE c.lock_hash = k.lock_hash
					), 0) AS finalized_height
					FROM affected_keys AS k
					WHERE NOT EXISTS (
						SELECT 1 FROM creation_candidates AS candidate
						LEFT JOIN shared_creations AS c ON c.id = candidate.id
						WHERE candidate.height <= %(common_height)s AND c.id IS NULL
							AND k.lock_hash IN (candidate.lock_hash, UPPER(candidate.raw_payload #>> '{transaction,hash}')))
						AND (
							EXISTS (SELECT 1 FROM applicable_creations AS c WHERE c.lock_hash = k.lock_hash)
							OR NOT EXISTS (SELECT 1 FROM shared_creations AS c WHERE c.lock_hash = k.lock_hash))
						AND NOT EXISTS (
							SELECT 1 FROM aggregate_candidates AS candidate WHERE candidate.height <= %(common_height)s
								AND k.lock_hash IN (candidate.lock_hash, UPPER(candidate.raw_payload #>> '{meta,hash}'))
								AND NOT EXISTS (
									SELECT 1 FROM proven_completions AS completion
									JOIN shared_creations AS c ON c.id = completion.creation_id
									WHERE completion.transaction_id = candidate.id AND completion.height < c.end_height))
						AND NOT EXISTS (
							SELECT 1 FROM symbol_hash_locks AS current_lock
							WHERE current_lock.hash = DECODE(k.lock_hash, 'hex') AND NOT EXISTS (
								SELECT 1 FROM proven_lifetimes AS c WHERE c.lock_hash = k.lock_hash
									AND c.signer_address = current_lock.owner_address AND UPPER(c.mosaic_id) = UPPER(current_lock.mosaic_id)
									AND c.amount = current_lock.amount AND c.end_height = current_lock.end_height)
								AND NOT EXISTS (SELECT 1 FROM receiptless_creations AS c WHERE c.lock_hash = k.lock_hash))
				)
				SELECT ARRAY(SELECT lock_hash FROM affected_keys),
					ARRAY(SELECT DISTINCT owner_address FROM proven_aggregates WHERE height >= %(height)s),
					(SELECT JSONB_AGG(JSONB_BUILD_ARRAY(lock_hash, ENCODE(signer_address, 'hex'), UPPER(mosaic_id), amount, end_height, was_used))
						FROM applicable_creations),
					(SELECT JSONB_OBJECT_AGG(lock_hash, finalized_height) FROM pruning_heights),
					EXISTS (SELECT 1 FROM incomplete_replay),
					(SELECT JSONB_AGG(JSONB_BUILD_ARRAY(height, lock_hash, ENCODE(transaction_hash, 'hex'))) FROM receiptless_creations),
					EXISTS (
						SELECT 1 FROM tail_events AS t
						WHERE NOT EXISTS (SELECT 1 FROM proven_events AS proven WHERE proven.id = t.id)
						UNION ALL
						SELECT 1 FROM proven_hash_locks AS lock WHERE %(allow_receiptless_creations)s AND lock.height >= %(height)s
							AND NOT EXISTS (SELECT 1 FROM proven_lifetimes AS c WHERE c.id = lock.id)
							AND NOT EXISTS (SELECT 1 FROM receiptless_creations AS c WHERE c.id = lock.id)
						UNION ALL
						SELECT 1 FROM symbol_receipts AS r WHERE r.height >= %(height)s
							AND (r.receipt_type::text = ANY(%(receipt_labels)s)
								OR (r.raw_payload -> 'type' = (%(receipt_codes)s::jsonb -> r.receipt_type::text)
									OR REGEXP_REPLACE(REGEXP_REPLACE(r.raw_payload ->> 'type', '(?<=[0-9])_(?=[0-9])', '', 'g'),
										'^[[:space:]]*[+]?0*|[[:space:]]+$', '', 'g')
										= (%(receipt_codes)s::jsonb ->> r.receipt_type::text)) IS NOT TRUE)
							AND NOT EXISTS (SELECT 1 FROM proven_receipts AS proven WHERE proven.id = r.id))
				''',
				{
					'height': height,
					'common_height': common_height,
					'replay_end': replay_end,
					'additional_keys': [key.hash.hex().upper() for key in additional_keys],
					'allow_receiptless_creations': allow_receiptless_creations,
					'zero_hash': bytes(32),
					'max_end_height': (1 << 64) - 1,
					'transaction_types': list(lock_transaction_types),
					'raw_transaction_types': [str(transaction_type) for transaction_type in lock_transaction_types],
					'transaction_labels': [TRANSACTION_TYPE_LABELS[transaction_type] for transaction_type in lock_transaction_types],
					'hash_lock_type': TransactionType.HASH_LOCK.value,
					'hash_lock_label': TRANSACTION_TYPE_LABELS[TransactionType.HASH_LOCK.value],
					'aggregate_type': TransactionType.AGGREGATE_BONDED.value,
					'aggregate_label': TRANSACTION_TYPE_LABELS[TransactionType.AGGREGATE_BONDED.value],
					'receipt_codes': Json({label: code for code, label in RECEIPT_TYPE_LABELS.items()}),
					'receipt_labels': [RECEIPT_TYPE_LABELS[receipt_type] for receipt_type in lock_receipt_types],
					'hash_created_type': ReceiptType.LOCK_HASH_CREATED.value,
					'hash_created_label': RECEIPT_TYPE_LABELS[ReceiptType.LOCK_HASH_CREATED.value],
					'hash_completed_type': ReceiptType.LOCK_HASH_COMPLETED.value,
					'hash_completed_label': RECEIPT_TYPE_LABELS[ReceiptType.LOCK_HASH_COMPLETED.value]
				})
			(hash_values, refund_owner_addresses, states, pruning_heights, has_incomplete_replay,
				receiptless_creations, has_unproven_event) = cursor.fetchone()

		if has_unproven_event:
			return None

		pruning_heights = {create_hash_lock_key(value): end_height for value, end_height in (pruning_heights or {}).items()}
		return RollbackHashLockEvidence(
			{create_hash_lock_key(value) for value in hash_values},
			{bytes(owner) for owner in refund_owner_addresses},
			{(create_hash_lock_key(value), bytes.fromhex(owner), mosaic_id, amount, end_height, 'used' if was_used else 'unused')
				for value, owner, mosaic_id, amount, end_height, was_used in states or ()},
			{key for key, end_height in pruning_heights.items() if end_height <= finalized_height},
			has_incomplete_replay,
			MappingProxyType(pruning_heights),
			frozenset(
				(height, create_hash_lock_key(key), bytes.fromhex(transaction_hash))
				for height, key, transaction_hash in receiptless_creations or ()))

	def has_receiptless_lock_history_gap(self, through_height):
		"""Checks retained transaction coverage required for receiptless Hash Lock creation evidence."""

		with self._database_transaction() as cursor:
			self._execute_reconciliation_statement(cursor, '''
				WITH transaction_counts AS (
					SELECT height, COUNT(*) FILTER (WHERE NOT is_embedded) AS top_level, COUNT(*) AS total
					FROM symbol_transactions WHERE height <= %(height)s GROUP BY height
				)
				SELECT COUNT(*) <> %(height)s OR COALESCE(BOOL_OR(
					(b.transactions_count, b.total_transactions_count) <> (COALESCE(t.top_level, 0), COALESCE(t.total, 0))
					OR (b.transactions_count = 0) <> (b.transactions_hash = %(zero_hash)s)), false)
				FROM symbol_blocks AS b LEFT JOIN transaction_counts AS t USING (height)
				WHERE b.height BETWEEN 1 AND %(height)s
			''', {'height': through_height, 'zero_hash': bytes(32)})
			return cursor.fetchone()[0]

	def has_artifact_state_gaps(self, height):
		"""Checks whether orphaned artifact events lack current-state keys needed for refresh."""

		namespace_transaction_types = tuple(
			TRANSACTION_TYPE_LABELS[transaction_type.value]
			for transaction_type in (
				TransactionType.NAMESPACE_REGISTRATION,
				TransactionType.ADDRESS_ALIAS,
				TransactionType.MOSAIC_ALIAS))
		mosaic_transaction_types = tuple(
			TRANSACTION_TYPE_LABELS[transaction_type.value]
			for transaction_type in (
				TransactionType.MOSAIC_DEFINITION,
				TransactionType.MOSAIC_SUPPLY_CHANGE))
		namespace_receipt_types = tuple(
			RECEIPT_TYPE_LABELS[receipt_type.value]
			for receipt_type in (ReceiptType.NAMESPACE_EXPIRED, ReceiptType.NAMESPACE_DELETED))
		mosaic_receipt_types = (RECEIPT_TYPE_LABELS[ReceiptType.MOSAIC_EXPIRED.value],)
		with self._database_transaction() as cursor:
			self._execute_reconciliation_statement(
				cursor,
				'''
				SELECT EXISTS (
					SELECT 1
					FROM symbol_transactions AS tx
					WHERE tx.height >= %s
						AND tx.type_name::text = ANY(%s)
						AND (
							CASE WHEN tx.type = %s THEN tx.body->>'id' ELSE tx.body->>'namespaceId' END IS NULL
							OR NOT EXISTS (
								SELECT 1 FROM symbol_namespaces AS current_namespace
								WHERE current_namespace.namespace_id = CASE WHEN tx.type = %s
									THEN tx.body->>'id' ELSE tx.body->>'namespaceId' END
									AND current_namespace.updated_at_height >= %s))
					UNION ALL
					SELECT 1
					FROM symbol_transactions AS tx
					LEFT JOIN symbol_transaction_mosaics AS tx_mosaic
						ON tx_mosaic.transaction_id = tx.id AND tx_mosaic.role::text = 'definition'
					WHERE tx.height >= %s
						AND tx.type_name::text = ANY(%s)
						AND (
							tx_mosaic.mosaic_id IS NULL
							OR NOT EXISTS (
								SELECT 1 FROM symbol_mosaics AS current_mosaic
								WHERE current_mosaic.mosaic_id = tx_mosaic.mosaic_id
									AND current_mosaic.updated_at_height >= %s))
					UNION ALL
					SELECT 1
					FROM symbol_receipts AS receipt
					WHERE receipt.height >= %s
						AND receipt.receipt_type::text = ANY(%s)
					UNION ALL
					SELECT 1
					FROM symbol_receipts AS receipt
					WHERE receipt.height >= %s
						AND receipt.receipt_type::text = ANY(%s)
						AND (
							receipt.artifact_id IS NULL
							OR NOT EXISTS (
								SELECT 1 FROM symbol_mosaics AS current_mosaic
								WHERE current_mosaic.mosaic_id = receipt.artifact_id
									AND current_mosaic.updated_at_height >= %s))
				)
				''',
				(
					height, list(namespace_transaction_types), TransactionType.NAMESPACE_REGISTRATION.value,
					TransactionType.NAMESPACE_REGISTRATION.value, height,
					height, list(mosaic_transaction_types), height,
					height, list(namespace_receipt_types),
					height, list(mosaic_receipt_types), height))
			result = cursor.fetchone()[0]

		return result

	def delete_blocks_from_height(self, height):
		"""Deletes blocks from the supplied height for rollback repair."""

		with self._database_transaction() as cursor:
			self._execute_invalidate_reusable_tip(cursor, height)
			self._delete_rollback_affected_rows_from_height(cursor, height)
			self._stale_mark_account_refresh_state_if_needed(cursor, height)

	def repair_rollback_from_height(self, height, sync_state, refresh_entries):
		"""Atomically repairs the chain and current state, returning committed recovery state."""

		committed_recovery = None
		with self._database_transaction() as cursor:
			recovery = sync_state.get('fork_recovery')
			if recovery is not None:
				if (sync_state['last_synced_height'] or 0) >= height:
					raise ValueError('Symbol repair checkpoint must precede the deletion range')

				self._execute_check_fork_checkpoint(cursor, sync_state, recovery)

			self._execute_invalidate_reusable_tip(cursor, height)
			self._delete_rollback_affected_rows_from_height(cursor, height)
			self._stale_mark_account_refresh_state_if_needed(cursor, sync_state.get('generation_rollback_height', height))
			self._execute_namespace_entries(cursor, refresh_entries.namespace_entries)
			self._execute_mosaic_entries(cursor, refresh_entries.mosaic_entries)
			self._execute_metadata_entries(cursor, refresh_entries.metadata_entries)
			self._execute_hash_lock_entries(cursor, refresh_entries.hash_lock_entries)
			self._execute_secret_lock_entries(cursor, refresh_entries.secret_lock_entries)
			self._execute_mosaic_restriction_entries(cursor, refresh_entries.mosaic_restriction_entries)
			self._execute_rollback_account_entries(cursor, refresh_entries.account_entries)
			if recovery is not None:
				# A repair only changes the reusable tip through the deletion range above.
				committed_recovery = self._execute_apply_fork_checkpoint(cursor, recovery, should_publish_reusable_tip=False)

			self._execute_upsert_sync_state(cursor, sync_state)

		return committed_recovery

	@staticmethod
	def _delete_rollback_affected_rows_from_height(cursor, height):
		cursor.execute('DELETE FROM symbol_transaction_mosaics WHERE height >= %s', (height,))
		cursor.execute('DELETE FROM symbol_transaction_addresses WHERE height >= %s', (height,))
		cursor.execute('DELETE FROM symbol_transactions WHERE height >= %s', (height,))
		cursor.execute('DELETE FROM symbol_receipts WHERE height >= %s', (height,))
		cursor.execute('DELETE FROM symbol_blocks WHERE height >= %s', (height,))
		cursor.execute('DELETE FROM symbol_hash_locks WHERE updated_at_height >= %s', (height,))
		cursor.execute('DELETE FROM symbol_secret_locks WHERE updated_at_height >= %s', (height,))
		cursor.execute('DELETE FROM symbol_mosaic_restrictions WHERE updated_at_height >= %s', (height,))

	@staticmethod
	def _execute_rollback_account_entries(cursor, entries):
		for entry in entries:
			if entry['account_row'] is None:
				cursor.execute('DELETE FROM symbol_multisig WHERE address = %s', (entry['address'],))
				cursor.execute('DELETE FROM symbol_account_mosaics WHERE address = %s', (entry['address'],))
				cursor.execute('DELETE FROM symbol_accounts WHERE address = %s', (entry['address'],))
				continue

			SymbolDatabase._execute_upsert_account_current_state(
				cursor,
				entry['account_row'],
				entry['mosaic_rows'],
				entry['overwrite_is_harvesting_active'])
			SymbolDatabase._execute_upsert_multisig(cursor, entry['address'], entry['multisig_row'])

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
			SET status = 'stale', valid_run_id = NULL,
				updated_at = CURRENT_TIMESTAMP
			WHERE id = 1 AND last_completed_height >= %s AND (status != 'stale' OR valid_run_id IS NOT NULL)
			''',
			(fork_height,))

	def upsert_blocks(self, blocks, *, expected_checkpoint=None):
		"""Upserts block rows atomically and returns the written revision when guarded."""

		with self._database_transaction() as cursor:
			if expected_checkpoint is not None:
				self._execute_lock_fork_checkpoint(cursor, expected_checkpoint)

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

			if expected_checkpoint is not None:
				cursor.execute('SELECT block_revision FROM symbol_fork_recovery WHERE id = 1')
				return cursor.fetchone()[0]

		return None

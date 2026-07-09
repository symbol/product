# pylint: disable=duplicate-code,too-many-lines
import datetime
from collections import namedtuple
from contextlib import ExitStack
from decimal import Decimal
from unittest import TestCase

from common.tests.PostgresTestUtils import PostgresTestDatabase, drop_symbol_block_tables_if_present
from psycopg2 import Error as PsycopgError
from psycopg2.extras import Json
from symbolchain.sc import ReceiptType
from symbolchain.symbol.Network import Network

from puller.db.SymbolDatabase import SymbolDatabase
from puller.model.symbol.Account import create_account_row
from tests.facade.symbol.puller_test_utils import NATIVE_MOSAIC_ID, create_account_item
from tests.test.SymbolTestConstants import RECIPIENT_ADDRESS

from ..test.SymbolTransactionTestUtils import create_transaction_entry

DatabaseConfig = namedtuple(
	'DatabaseConfig',
	['database', 'user', 'password', 'host', 'port'])
ADDRESS1 = '9889432DE263BB8FE88444A4DA28D3609BD8BB8FAE18AE95'
ADDRESS2 = '9889432DE263BB8FE88444A4DA28D3609BD8BB8FAE18AE96'
ADDRESS3 = '9889432DE263BB8FE88444A4DA28D3609BD8BB8FAE18AE97'
ADDRESS4 = '98' + '11' * 23


def _create_block(height, block_hash=None, **overrides):
	block_hash = block_hash or f'hash {height}'.encode('utf8')
	timestamp = overrides.pop('timestamp', None)
	if timestamp is None:
		timestamp = datetime.datetime(
			2026,
			1,
			1,
			0,
			height,
			tzinfo=datetime.timezone.utc
		)

	block = {
		'height': height,
		'hash': block_hash,
		'previous_hash': f'previous {height}'.encode('utf8'),
		'timestamp': timestamp,
		'network_timestamp': height * 1000,
		'total_fee': height * 100,
		'transactions_count': height,
		'total_transactions_count': height + 10,
		'statements_count': height + 1,
		'difficulty': 100000 + height,
		'fee_multiplier': height,
		'block_type': 'nemesis',
		'signer_public_key': f'signer key {height}'.encode('utf8'),
		'signer_address': f'signer address {height}'.encode('utf8'),
		'beneficiary_address': f'beneficiary {height}'.encode('utf8'),
		'signature': f'signature {height}'.encode('utf8'),
		'size': 100 + height,
		'proof_gamma': f'gamma {height}'.encode('utf8'),
		'proof_verification_hash': f'verification {height}'.encode('utf8'),
		'proof_scalar': f'scalar {height}'.encode('utf8'),
		'state_hash': f'state {height}'.encode('utf8'),
		'transactions_hash': f'transactions {height}'.encode('utf8'),
		'receipts_hash': f'receipts {height}'.encode('utf8'),
		'state_hash_sub_cache_roots': Json([f'root {height}']),
		'voting_eligible_accounts_count': None,
		'harvesting_eligible_accounts_count': None,
		'total_voting_balance': None,
		'previous_importance_block_hash': None,
		'raw_payload': Json({'height': height})
	}
	block.update(overrides)

	return block


def _create_sync_state(**overrides):
	sync_state = {
		'status': 'healthy',
		'chain_height': 10,
		'finalized_height': 8,
		'finalized_hash': b'finalized',
		'finalized_epoch': 2,
		'finalized_point': 3,
		'last_synced_height': 10,
		'last_synced_block_hash': b'last'
	}
	sync_state.update(overrides)

	return sync_state


def _create_receipt(height, receipt_type='inflation', **overrides):
	receipt = {
		'height': height,
		'receipt_type': receipt_type,
		'receipt_group': 'inflation',
		'version': 1,
		'source_primary_id': 0,
		'source_secondary_id': 0,
		'sender_address': None,
		'recipient_address': None,
		'target_address': None,
		'mosaic_id': '72C0212E67A08BCE',
		'amount': 100,
		'artifact_id': None,
		'raw_payload': {'type': ReceiptType.INFLATION.value}
	}
	receipt.update(overrides)

	return receipt


def _create_account_row(address_hex=ADDRESS1, observed_height=10, **item_overrides):
	return create_account_row(
		create_account_item(address_hex, **item_overrides),
		Network.TESTNET,
		observed_height,
		NATIVE_MOSAIC_ID,
		6)


def _create_multisig_row(address_hex, updated_at_height):
	return {
		'address': bytes.fromhex(address_hex),
		'min_approval': 1,
		'min_removal': 1,
		'cosignatory_addresses': [],
		'multisig_addresses': [],
		'updated_at_height': updated_at_height
	}


class SymbolDatabaseTest(TestCase):  # pylint: disable=too-many-public-methods
	def setUp(self):
		self.exit_stack = ExitStack()
		self.db_config = self.exit_stack.enter_context(PostgresTestDatabase())

	def tearDown(self):
		self.doCleanups()
		self.exit_stack.close()

	def _create_database(self):
		database = self.exit_stack.enter_context(
			SymbolDatabase(self.db_config)
		)
		drop_symbol_block_tables_if_present(database)
		self.addCleanup(drop_symbol_block_tables_if_present, database)
		database.create_tables()

		return database

	def _create_uninitialized_database(self):
		database = self.exit_stack.enter_context(
			SymbolDatabase(self.db_config)
		)
		drop_symbol_block_tables_if_present(database)
		self.addCleanup(drop_symbol_block_tables_if_present, database)

		return database

	def test_create_tables_creates_symbol_tables(self):
		# Arrange:
		database = self._create_uninitialized_database()
		cursor = database.connection.cursor()

		# Act:
		database.create_tables()

		# Assert:
		cursor.execute(
			'''
			SELECT table_name
			FROM information_schema.tables
			WHERE table_schema = 'public'
				AND table_name LIKE 'symbol_%'
			ORDER BY table_name
			'''
		)
		tables = [result[0] for result in cursor.fetchall()]

		self.assertEqual([
			'symbol_account_list_ranks',
			'symbol_account_mosaics',
			'symbol_account_refresh_accounts',
			'symbol_account_refresh_mosaics',
			'symbol_account_refresh_state',
			'symbol_accounts',
			'symbol_blocks',
			'symbol_multisig',
			'symbol_receipts',
			'symbol_sync_state',
			'symbol_transaction_addresses',
			'symbol_transaction_mosaics',
			'symbol_transactions'
		], tables)

	def test_create_tables_creates_symbol_account_enum_types(self):
		# Arrange:
		database = self._create_uninitialized_database()
		cursor = database.connection.cursor()

		# Act:
		database.create_tables()

		# Assert:
		cursor.execute(
			'''
			SELECT pg_type.typname, enumlabel
			FROM pg_enum
			JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
			WHERE pg_type.typname IN (
				'symbol_account_type',
				'symbol_account_refresh_state_status'
			)
			ORDER BY pg_type.typname, enumsortorder
			'''
		)

		self.assertEqual([
			('symbol_account_refresh_state_status', 'healthy'),
			('symbol_account_refresh_state_status', 'refreshing'),
			('symbol_account_refresh_state_status', 'stale'),
			('symbol_account_refresh_state_status', 'unhealthy'),
			('symbol_account_type', 'unlinked'),
			('symbol_account_type', 'main'),
			('symbol_account_type', 'remote'),
			('symbol_account_type', 'remoteUnlinked')
		], cursor.fetchall())

	def test_create_tables_creates_symbol_account_current_state_columns(self):
		# Arrange:
		database = self._create_uninitialized_database()
		cursor = database.connection.cursor()

		# Act:
		database.create_tables()

		# Assert:
		cursor.execute(
			'''
			SELECT column_name, udt_name, is_nullable
			FROM information_schema.columns
			WHERE table_name = 'symbol_accounts'
			ORDER BY ordinal_position
			'''
		)

		self.assertEqual([
			('address', 'bytea', 'NO'),
			('address_text', 'varchar', 'NO'),
			('public_key', 'bytea', 'YES'),
			('account_type', 'symbol_account_type', 'YES'),
			('address_height', 'int8', 'YES'),
			('importance', 'int8', 'NO'),
			('importance_percentage', 'numeric', 'NO'),
			('is_harvesting_active', 'bool', 'YES'),
			('is_eligible_for_harvesting', 'bool', 'YES'),
			('linked_public_key', 'bytea', 'YES'),
			('node_public_key', 'bytea', 'YES'),
			('vrf_public_key', 'bytea', 'YES'),
			('voting_public_keys', 'jsonb', 'NO'),
			('activity_buckets', 'jsonb', 'NO'),
			('raw_payload', 'jsonb', 'NO'),
			('first_seen_height', 'int8', 'YES'),
			('last_seen_height', 'int8', 'NO'),
			('updated_at', 'timestamp', 'NO')
		], cursor.fetchall())

	def test_create_tables_creates_symbol_account_indexes(self):
		# Arrange:
		database = self._create_uninitialized_database()
		cursor = database.connection.cursor()

		# Act:
		database.create_tables()

		# Assert:
		cursor.execute(
			'''
			SELECT indexname
			FROM pg_indexes
			WHERE schemaname = 'public'
				AND indexname LIKE 'idx_symbol_account%'
			ORDER BY indexname
			'''
		)

		self.assertEqual([
			'idx_symbol_account_list_ranks_address',
			'idx_symbol_account_list_ranks_page',
			'idx_symbol_account_mosaics_address',
			'idx_symbol_account_mosaics_mosaic',
			'idx_symbol_account_refresh_accounts_address_text',
			'idx_symbol_account_refresh_accounts_importance_desc',
			'idx_symbol_account_refresh_accounts_search_id',
			'idx_symbol_account_refresh_accounts_search_order',
			'idx_symbol_account_refresh_mosaics_address',
			'idx_symbol_account_refresh_mosaics_mosaic_amount_desc',
			'idx_symbol_accounts_address_height',
			'idx_symbol_accounts_eligible',
			'idx_symbol_accounts_harvesting',
			'idx_symbol_accounts_importance_desc'
		], [row[0] for row in cursor.fetchall()])

	def test_create_tables_creates_symbol_sync_state_schema(self):
		# Arrange:
		database = self._create_uninitialized_database()
		cursor = database.connection.cursor()

		# Act:
		database.create_tables()

		# Assert:
		cursor.execute(
			'''
			SELECT column_name, udt_name
			FROM information_schema.columns
			WHERE table_name = 'symbol_sync_state'
			ORDER BY ordinal_position
			'''
		)
		sync_state_columns = cursor.fetchall()

		cursor.execute(
			'''
			SELECT udt_name, column_default
			FROM information_schema.columns
			WHERE table_name = 'symbol_sync_state'
				AND column_name = 'status'
			'''
		)
		status_type, status_default = cursor.fetchone()

		self.assertEqual([
			('id', 'int4'),
			('status', 'symbol_sync_state_status'),
			('chain_height', 'int4'),
			('finalized_height', 'int4'),
			('finalized_hash', 'bytea'),
			('finalized_epoch', 'int4'),
			('finalized_point', 'int4'),
			('last_synced_height', 'int4'),
			('last_synced_block_hash', 'bytea'),
			('updated_at', 'timestamp')
		], sync_state_columns)
		self.assertEqual('symbol_sync_state_status', status_type)
		self.assertIsNone(status_default)

	def test_create_tables_creates_enum_types(self):
		# Arrange:
		database = self._create_uninitialized_database()
		cursor = database.connection.cursor()

		# Act:
		database.create_tables()

		# Assert:
		cursor.execute(
			'''
			SELECT pg_type.typname, enumlabel
			FROM pg_enum
			JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
			WHERE pg_type.typname IN (
				'symbol_block_type',
				'symbol_receipt_group',
				'symbol_receipt_type',
				'symbol_sync_state_status'
			)
			ORDER BY pg_type.typname, enumsortorder
			'''
		)
		enum_values = cursor.fetchall()

		self.assertEqual([
			('symbol_block_type', 'nemesis'),
			('symbol_block_type', 'importance'),
			('symbol_block_type', 'normal'),
			('symbol_receipt_group', 'balanceChange'),
			('symbol_receipt_group', 'balanceTransfer'),
			('symbol_receipt_group', 'artifactExpiry'),
			('symbol_receipt_group', 'inflation'),
			('symbol_receipt_type', 'mosaicRentalFee'),
			('symbol_receipt_type', 'namespaceRentalFee'),
			('symbol_receipt_type', 'harvestFee'),
			('symbol_receipt_type', 'lockHashCompleted'),
			('symbol_receipt_type', 'lockHashExpired'),
			('symbol_receipt_type', 'lockSecretCompleted'),
			('symbol_receipt_type', 'lockSecretExpired'),
			('symbol_receipt_type', 'lockHashCreated'),
			('symbol_receipt_type', 'lockSecretCreated'),
			('symbol_receipt_type', 'mosaicExpired'),
			('symbol_receipt_type', 'namespaceExpired'),
			('symbol_receipt_type', 'namespaceDeleted'),
			('symbol_receipt_type', 'inflation'),
			('symbol_sync_state_status', 'initialized'),
			('symbol_sync_state_status', 'healthy'),
			('symbol_sync_state_status', 'repairing'),
			('symbol_sync_state_status', 'unhealthy')
		], enum_values)

	def test_create_tables_creates_symbol_block_indexes(self):
		# Arrange:
		database = self._create_uninitialized_database()
		cursor = database.connection.cursor()

		# Act:
		database.create_tables()

		# Assert:
		cursor.execute(
			'''
			SELECT indexname
			FROM pg_indexes
			WHERE schemaname = 'public'
			ORDER BY indexname
			'''
		)
		indexes = [result[0] for result in cursor.fetchall()]

		self.assertIn('idx_symbol_blocks_height_desc', indexes)
		self.assertIn('idx_symbol_blocks_signer_address', indexes)
		self.assertIn('idx_symbol_blocks_timestamp', indexes)

	def test_create_tables_creates_symbol_receipt_indexes(self):
		# Arrange:
		database = self._create_uninitialized_database()
		cursor = database.connection.cursor()

		# Act:
		database.create_tables()

		# Assert:
		cursor.execute(
			'''
			SELECT indexname, indexdef
			FROM pg_indexes
			WHERE schemaname = 'public'
				AND tablename = 'symbol_receipts'
			ORDER BY indexname
			'''
		)
		indexes = cursor.fetchall()

		self.assertEqual([
			(
				'idx_symbol_receipts_group_height',
				'CREATE INDEX idx_symbol_receipts_group_height ON public.symbol_receipts USING btree (receipt_group, height DESC)'
			),
			(
				'idx_symbol_receipts_height_type',
				'CREATE INDEX idx_symbol_receipts_height_type ON public.symbol_receipts USING btree (height DESC, receipt_type)'
			),
			(
				'idx_symbol_receipts_mosaic',
				'CREATE INDEX idx_symbol_receipts_mosaic ON public.symbol_receipts USING btree (mosaic_id)'
			),
			(
				'idx_symbol_receipts_recipient_group_height',
				'CREATE INDEX idx_symbol_receipts_recipient_group_height ON public.symbol_receipts '
				'USING btree (recipient_address, receipt_group, height DESC)'
			),
			(
				'idx_symbol_receipts_sender_group_height',
				'CREATE INDEX idx_symbol_receipts_sender_group_height ON public.symbol_receipts '
				'USING btree (sender_address, receipt_group, height DESC)'
			),
			(
				'idx_symbol_receipts_target',
				'CREATE INDEX idx_symbol_receipts_target ON public.symbol_receipts USING btree (target_address)'
			),
			(
				'idx_symbol_receipts_target_group_height',
				'CREATE INDEX idx_symbol_receipts_target_group_height ON public.symbol_receipts '
				'USING btree (target_address, receipt_group, height DESC)'
			),
			(
				'idx_symbol_receipts_target_type_height',
				'CREATE INDEX idx_symbol_receipts_target_type_height ON public.symbol_receipts USING btree (target_address, receipt_type, height DESC)'
			),
			(
				'idx_symbol_receipts_type_height',
				'CREATE INDEX idx_symbol_receipts_type_height ON public.symbol_receipts USING btree (receipt_type, height DESC)'
			),
			(
				'symbol_receipts_pkey',
				'CREATE UNIQUE INDEX symbol_receipts_pkey ON public.symbol_receipts USING btree (id)'
			)
		], indexes)

	def test_create_tables_creates_symbol_block_columns_and_constraints(self):
		# Arrange:
		database = self._create_uninitialized_database()
		cursor = database.connection.cursor()

		# Act:
		database.create_tables()

		# Assert:
		cursor.execute(
			'''
			SELECT column_name, udt_name, is_nullable, column_default
			FROM information_schema.columns
			WHERE table_name = 'symbol_blocks'
			ORDER BY ordinal_position
			'''
		)
		columns = cursor.fetchall()

		cursor.execute(
			'''
			SELECT constraint_type, column_name
			FROM information_schema.table_constraints
			JOIN information_schema.key_column_usage USING (
				constraint_name,
				table_schema,
				table_name
			)
			WHERE table_name = 'symbol_blocks'
			ORDER BY constraint_type, column_name
			'''
		)
		key_constraints = cursor.fetchall()

		self.assertEqual([
			('height', 'int8', 'NO', None),
			('hash', 'bytea', 'NO', None),
			('previous_hash', 'bytea', 'NO', None),
			('timestamp', 'timestamp', 'NO', None),
			('network_timestamp', 'int8', 'NO', None),
			('total_fee', 'int8', 'NO', None),
			('transactions_count', 'int4', 'NO', None),
			('total_transactions_count', 'int4', 'NO', None),
			('statements_count', 'int4', 'NO', None),
			('difficulty', 'int8', 'NO', None),
			('fee_multiplier', 'int4', 'NO', None),
			('block_type', 'symbol_block_type', 'NO', None),
			('signer_public_key', 'bytea', 'NO', None),
			('signer_address', 'bytea', 'NO', None),
			('beneficiary_address', 'bytea', 'NO', None),
			('signature', 'bytea', 'NO', None),
			('size', 'int4', 'NO', None),
			('proof_gamma', 'bytea', 'NO', None),
			('proof_verification_hash', 'bytea', 'NO', None),
			('proof_scalar', 'bytea', 'NO', None),
			('state_hash', 'bytea', 'NO', None),
			('transactions_hash', 'bytea', 'NO', None),
			('receipts_hash', 'bytea', 'NO', None),
			('state_hash_sub_cache_roots', 'jsonb', 'NO', "'[]'::jsonb"),
			('voting_eligible_accounts_count', 'int4', 'YES', None),
			('harvesting_eligible_accounts_count', 'int4', 'YES', None),
			('total_voting_balance', 'int8', 'YES', None),
			('previous_importance_block_hash', 'bytea', 'YES', None),
			('block_reward', 'int4', 'YES', None),
			('raw_payload', 'jsonb', 'NO', None),
			('created_at', 'timestamp', 'NO', 'CURRENT_TIMESTAMP'),
			('updated_at', 'timestamp', 'NO', 'CURRENT_TIMESTAMP')
		], columns)
		self.assertEqual([
			('PRIMARY KEY', 'height'),
			('UNIQUE', 'hash')
		], key_constraints)

	def test_create_tables_creates_symbol_transaction_columns_and_constraints(self):
		# Arrange:
		database = self._create_uninitialized_database()
		cursor = database.connection.cursor()

		# Act:
		database.create_tables()

		# Assert:
		cursor.execute(
			'''
			SELECT column_name, udt_name, is_nullable, column_default
			FROM information_schema.columns
			WHERE table_name = 'symbol_transactions'
			ORDER BY ordinal_position
			'''
		)
		columns = cursor.fetchall()

		cursor.execute(
			'''
			SELECT constraint_type, column_name
			FROM information_schema.table_constraints
			JOIN information_schema.key_column_usage USING (
				constraint_name,
				table_schema,
				table_name
			)
			WHERE table_name = 'symbol_transactions'
			ORDER BY constraint_type, column_name
			'''
		)
		key_constraints = cursor.fetchall()

		self.assertEqual([
			('id', 'int8', 'NO', "nextval('symbol_transactions_id_seq'::regclass)"),
			('hash', 'bytea', 'YES', None),
			('aggregate_hash', 'bytea', 'YES', None),
			('embedded_index', 'int4', 'YES', None),
			('is_embedded', 'bool', 'NO', None),
			('height', 'int8', 'NO', None),
			('list_sequence', 'int8', 'YES', None),
			('timestamp', 'timestamp', 'NO', None),
			('type', 'int4', 'NO', None),
			('type_name', 'symbol_transaction_type', 'NO', None),
			('signer_public_key', 'bytea', 'NO', None),
			('signer_address', 'bytea', 'NO', None),
			('recipient_address', 'bytea', 'YES', None),
			('target_address', 'bytea', 'YES', None),
			('deadline', 'timestamp', 'YES', None),
			('network_deadline', 'int8', 'YES', None),
			('max_fee', 'int8', 'YES', None),
			('effective_fee', 'int8', 'YES', None),
			('size', 'int4', 'YES', None),
			('message_type', 'symbol_transaction_message_type', 'YES', None),
			('message_payload', 'text', 'YES', None),
			('body', 'jsonb', 'YES', None),
			('raw_payload', 'jsonb', 'NO', None),
			('created_at', 'timestamp', 'NO', 'CURRENT_TIMESTAMP'),
			('updated_at', 'timestamp', 'NO', 'CURRENT_TIMESTAMP')
		], columns)
		self.assertEqual([
			('FOREIGN KEY', 'height'),
			('PRIMARY KEY', 'id'),
			('UNIQUE', 'aggregate_hash'),
			('UNIQUE', 'embedded_index'),
			('UNIQUE', 'hash')
		], key_constraints)

	def test_create_tables_creates_symbol_transaction_child_table_columns_and_constraints(self):
		# Arrange:
		database = self._create_uninitialized_database()
		cursor = database.connection.cursor()

		# Act:
		database.create_tables()

		# Assert:
		cursor.execute(
			'''
			SELECT table_name, column_name, udt_name, is_nullable
			FROM information_schema.columns
			WHERE table_name IN ('symbol_transaction_mosaics', 'symbol_transaction_addresses')
			ORDER BY table_name, ordinal_position
			'''
		)
		columns = cursor.fetchall()

		cursor.execute(
			'''
			SELECT table_name, constraint_type, column_name
			FROM information_schema.table_constraints
			JOIN information_schema.key_column_usage USING (
				constraint_name,
				table_schema,
				table_name
			)
			WHERE table_name IN ('symbol_transaction_mosaics', 'symbol_transaction_addresses')
			ORDER BY table_name, constraint_type, column_name
			'''
		)
		key_constraints = cursor.fetchall()

		self.assertEqual([
			('symbol_transaction_addresses', 'transaction_id', 'int8', 'NO'),
			('symbol_transaction_addresses', 'height', 'int8', 'NO'),
			('symbol_transaction_addresses', 'address', 'bytea', 'NO'),
			('symbol_transaction_addresses', 'role', 'symbol_transaction_address_role', 'NO'),
			('symbol_transaction_mosaics', 'transaction_id', 'int8', 'NO'),
			('symbol_transaction_mosaics', 'height', 'int8', 'NO'),
			('symbol_transaction_mosaics', 'mosaic_id', 'varchar', 'NO'),
			('symbol_transaction_mosaics', 'amount', 'int8', 'NO'),
			('symbol_transaction_mosaics', 'role', 'symbol_transaction_mosaic_role', 'NO'),
			('symbol_transaction_mosaics', 'position', 'int4', 'NO')
		], columns)
		self.assertEqual([
			('symbol_transaction_addresses', 'FOREIGN KEY', 'height'),
			('symbol_transaction_addresses', 'FOREIGN KEY', 'transaction_id'),
			('symbol_transaction_addresses', 'PRIMARY KEY', 'address'),
			('symbol_transaction_addresses', 'PRIMARY KEY', 'role'),
			('symbol_transaction_addresses', 'PRIMARY KEY', 'transaction_id'),
			('symbol_transaction_mosaics', 'FOREIGN KEY', 'height'),
			('symbol_transaction_mosaics', 'FOREIGN KEY', 'transaction_id'),
			('symbol_transaction_mosaics', 'PRIMARY KEY', 'mosaic_id'),
			('symbol_transaction_mosaics', 'PRIMARY KEY', 'position'),
			('symbol_transaction_mosaics', 'PRIMARY KEY', 'role'),
			('symbol_transaction_mosaics', 'PRIMARY KEY', 'transaction_id')
		], key_constraints)

	def test_create_tables_creates_symbol_transaction_indexes(self):
		# Arrange:
		database = self._create_uninitialized_database()
		cursor = database.connection.cursor()

		# Act:
		database.create_tables()

		# Assert:
		cursor.execute(
			'''
			SELECT indexname
			FROM pg_indexes
			WHERE schemaname = 'public'
				AND indexname LIKE 'idx_symbol_transaction%'
			ORDER BY indexname
			'''
		)
		indexes = [result[0] for result in cursor.fetchall()]

		self.assertEqual([
			'idx_symbol_transaction_addresses_address_height',
			'idx_symbol_transaction_addresses_height',
			'idx_symbol_transaction_mosaics_mosaic_height',
			'idx_symbol_transaction_mosaics_mosaic_role_height',
			'idx_symbol_transactions_height_desc',
			'idx_symbol_transactions_list_sequence_desc',
			'idx_symbol_transactions_recipient_height',
			'idx_symbol_transactions_signer_address',
			'idx_symbol_transactions_signer_height',
			'idx_symbol_transactions_timestamp',
			'idx_symbol_transactions_type_height'
		], indexes)

	def test_create_tables_creates_symbol_transaction_partial_indexes_with_predicate(self):
		# Arrange:
		database = self._create_uninitialized_database()
		cursor = database.connection.cursor()

		# Act:
		database.create_tables()

		# Assert:
		cursor.execute(
			'''
			SELECT indexname, indexdef
			FROM pg_indexes
			WHERE schemaname = 'public'
				AND indexname IN ('idx_symbol_transactions_height_desc', 'idx_symbol_transactions_list_sequence_desc')
			ORDER BY indexname
			'''
		)
		indexes = cursor.fetchall()

		self.assertEqual([
			(
				'idx_symbol_transactions_height_desc',
				'CREATE INDEX idx_symbol_transactions_height_desc ON public.symbol_transactions USING btree '
				'(height DESC, id DESC) WHERE (is_embedded = false)'
			),
			(
				'idx_symbol_transactions_list_sequence_desc',
				'CREATE INDEX idx_symbol_transactions_list_sequence_desc ON public.symbol_transactions USING btree '
				'(list_sequence DESC) WHERE (is_embedded = false)'
			)
		], indexes)

	def test_create_tables_creates_symbol_transaction_list_sequence(self):
		# Arrange:
		database = self._create_uninitialized_database()
		cursor = database.connection.cursor()

		# Act:
		database.create_tables()

		# Assert:
		cursor.execute(
			'''
			SELECT relname
			FROM pg_class
			WHERE relkind = 'S'
				AND relname = 'symbol_transaction_list_sequence_seq'
			'''
		)
		sequences = cursor.fetchall()

		self.assertEqual([('symbol_transaction_list_sequence_seq',)], sequences)

	def test_create_tables_creates_symbol_receipt_columns_and_constraints(self):
		# Arrange:
		database = self._create_uninitialized_database()
		cursor = database.connection.cursor()

		# Act:
		database.create_tables()

		# Assert:
		cursor.execute(
			'''
			SELECT column_name, udt_name, is_nullable, column_default
			FROM information_schema.columns
			WHERE table_name = 'symbol_receipts'
			ORDER BY ordinal_position
			'''
		)
		columns = cursor.fetchall()

		cursor.execute(
			'''
			SELECT constraint_type, column_name
			FROM information_schema.table_constraints
			JOIN information_schema.key_column_usage USING (
				constraint_name,
				table_schema,
				table_name
			)
			WHERE table_name = 'symbol_receipts'
			ORDER BY constraint_type, column_name
			'''
		)
		key_constraints = cursor.fetchall()

		self.assertEqual([
			('id', 'int8', 'NO', "nextval('symbol_receipts_id_seq'::regclass)"),
			('height', 'int8', 'NO', None),
			('receipt_type', 'symbol_receipt_type', 'NO', None),
			('receipt_group', 'symbol_receipt_group', 'NO', None),
			('version', 'int4', 'NO', None),
			('source_primary_id', 'int8', 'YES', None),
			('source_secondary_id', 'int8', 'YES', None),
			('sender_address', 'bytea', 'YES', None),
			('recipient_address', 'bytea', 'YES', None),
			('target_address', 'bytea', 'YES', None),
			('mosaic_id', 'varchar', 'YES', None),
			('amount', 'int8', 'NO', '0'),
			('artifact_id', 'varchar', 'YES', None),
			('raw_payload', 'jsonb', 'NO', None)
		], columns)
		self.assertEqual([
			('FOREIGN KEY', 'height'),
			('PRIMARY KEY', 'id')
		], key_constraints)

	def test_check_connection_returns_true_when_sync_state_exists(self):
		# Arrange:
		database = self._create_database()
		database.upsert_sync_state(_create_sync_state())

		# Act:
		result = database.check_connection()

		# Assert:
		self.assertTrue(result)

	def test_check_connection_returns_false_when_sync_state_is_absent(self):
		# Arrange:
		database = self._create_database()

		# Act:
		result = database.check_connection()

		# Assert:
		self.assertFalse(result)

	def test_get_sync_state_returns_none_when_empty(self):
		# Arrange:
		database = self._create_database()

		# Act:
		result = database.get_sync_state()

		# Assert:
		self.assertIsNone(result)

	def test_can_upsert_sync_state(self):
		# Arrange:
		database = self._create_database()
		cursor = database.connection.cursor()

		# Act:
		database.upsert_sync_state(_create_sync_state())

		# Assert:
		cursor.execute(
			'''
			SELECT
				status,
				chain_height,
				finalized_height,
				finalized_hash,
				finalized_epoch,
				finalized_point,
				last_synced_height,
				last_synced_block_hash
			FROM symbol_sync_state
			WHERE id = 1
			'''
		)
		result = cursor.fetchone()

		self.assertEqual('healthy', result[0])
		self.assertEqual(10, result[1])
		self.assertEqual(8, result[2])
		self.assertEqual(bytes(b'finalized'), bytes(result[3]))
		self.assertEqual(2, result[4])
		self.assertEqual(3, result[5])
		self.assertEqual(10, result[6])
		self.assertEqual(bytes(b'last'), bytes(result[7]))

	def test_get_sync_state_returns_upserted_value(self):
		# Arrange:
		database = self._create_database()
		database.upsert_sync_state(_create_sync_state())

		# Act:
		result = database.get_sync_state()

		# Assert:
		self.assertEqual('healthy', result['status'])
		self.assertEqual(10, result['chain_height'])
		self.assertEqual(8, result['finalized_height'])
		self.assertEqual(bytes(b'finalized'), bytes(result['finalized_hash']))
		self.assertEqual(2, result['finalized_epoch'])
		self.assertEqual(3, result['finalized_point'])
		self.assertEqual(10, result['last_synced_height'])
		self.assertEqual(
			bytes(b'last'),
			bytes(result['last_synced_block_hash'])
		)

	def test_can_update_existing_sync_state(self):
		# Arrange:
		database = self._create_database()
		database.upsert_sync_state(_create_sync_state())

		# Act:
		database.upsert_sync_state(_create_sync_state(
			status='repairing',
			last_synced_height=4,
			last_synced_block_hash=b'repaired'
		))

		# Assert:
		result = database.get_sync_state()

		self.assertEqual('repairing', result['status'])
		self.assertEqual(4, result['last_synced_height'])
		self.assertEqual(
			bytes(b'repaired'),
			bytes(result['last_synced_block_hash'])
		)

	def test_rejects_invalid_sync_state_status(self):
		# Arrange:
		database = self._create_database()

		# Act + Assert:
		with self.assertRaises(PsycopgError):
			database.upsert_sync_state(_create_sync_state(status='invalid'))

	def test_rejects_non_singleton_sync_state_row(self):
		# Arrange:
		database = self._create_database()
		cursor = database.connection.cursor()

		# Act + Assert:
		with self.assertRaises(PsycopgError):
			cursor.execute(
				'INSERT INTO symbol_sync_state (id, status) '
				'VALUES (2, \'initialized\')'
			)

	def test_can_upsert_account_refresh_state_without_overwriting_successful_run(self):
		# Arrange:
		database = self._create_database()
		database.upsert_account_refresh_state({
			'status': 'healthy',
			'last_successful_run_id': 'successful-run',
			'last_completed_height': 100
		})

		# Act:
		database.upsert_account_refresh_state({
			'status': 'unhealthy',
			'last_error': 'failed'
		})

		# Assert:
		result = database.get_account_refresh_state()

		self.assertEqual('successful-run', result['last_successful_run_id'])
		self.assertEqual('unhealthy', result['status'])
		self.assertEqual('failed', result['last_error'])

	def test_can_upsert_account_current_state_and_replace_mosaics(self):
		# Arrange:
		database = self._create_database()
		account_row, mosaic_rows = _create_account_row()
		updated_account_row, updated_mosaic_rows = _create_account_row(
			observed_height=20,
			mosaics=[{'id': NATIVE_MOSAIC_ID, 'amount': '30000000000'}],
			importance='200')

		# Act:
		database.upsert_account_current_state(account_row, mosaic_rows)
		database.upsert_account_current_state(updated_account_row, updated_mosaic_rows)

		# Assert:
		cursor = database.connection.cursor()
		cursor.execute(
			'''
			SELECT importance, first_seen_height, last_seen_height
			FROM symbol_accounts
			WHERE address = %s
			''',
			(bytes.fromhex(ADDRESS1),))
		account_result = cursor.fetchone()
		cursor.execute(
			'''
			SELECT mosaic_id, amount, updated_at_height
			FROM symbol_account_mosaics
			WHERE address = %s
			''',
			(bytes.fromhex(ADDRESS1),))
		mosaic_results = cursor.fetchall()

		self.assertEqual((200, 10, 20), account_result)
		self.assertEqual([(NATIVE_MOSAIC_ID, 30000000000, 20)], mosaic_results)

	def test_upsert_account_current_state_clears_existing_mosaics_when_replaced_with_empty_list(self):
		# Arrange:
		database = self._create_database()
		account_row, mosaic_rows = _create_account_row()
		updated_account_row, updated_mosaic_rows = _create_account_row(
			observed_height=20,
			mosaics=[])

		# Act:
		database.upsert_account_current_state(account_row, mosaic_rows)
		database.upsert_account_current_state(updated_account_row, updated_mosaic_rows)

		# Assert:
		cursor = database.connection.cursor()
		cursor.execute(
			'SELECT COUNT(*) FROM symbol_account_mosaics WHERE address = %s',
			(bytes.fromhex(ADDRESS1),))

		self.assertEqual((0,), cursor.fetchone())

	def test_upsert_account_current_state_never_overwrites_importance_percentage(self):
		# Arrange:
		database = self._create_database()
		account_row, mosaic_rows = _create_account_row()
		account_row['importance_percentage'] = Decimal('0.75')
		updated_account_row, updated_mosaic_rows = _create_account_row(importance='200')

		# Act:
		database.upsert_account_current_state(account_row, mosaic_rows)
		database.upsert_account_current_state(updated_account_row, updated_mosaic_rows)

		# Assert:
		cursor = database.connection.cursor()
		cursor.execute('SELECT importance, importance_percentage FROM symbol_accounts WHERE address = %s', (bytes.fromhex(ADDRESS1),))

		self.assertEqual((200, Decimal('0.75')), cursor.fetchone())

	def test_upsert_account_current_state_preserves_harvesting_active_when_not_overwriting(self):
		# Arrange:
		database = self._create_database()
		account_row, mosaic_rows = _create_account_row()
		account_row['is_harvesting_active'] = False
		updated_account_row, updated_mosaic_rows = _create_account_row()
		updated_account_row['is_harvesting_active'] = True

		# Act:
		database.upsert_account_current_state(account_row, mosaic_rows)
		database.upsert_account_current_state(
			updated_account_row,
			updated_mosaic_rows,
			overwrite_is_harvesting_active=False)

		# Assert:
		cursor = database.connection.cursor()
		cursor.execute('SELECT is_harvesting_active FROM symbol_accounts WHERE address = %s', (bytes.fromhex(ADDRESS1),))

		self.assertEqual((False,), cursor.fetchone())

	def test_can_upsert_account_current_state_and_overwrite_harvesting_active_by_default(self):
		# Arrange:
		database = self._create_database()
		account_row, mosaic_rows = _create_account_row()
		account_row['is_harvesting_active'] = False
		updated_account_row, updated_mosaic_rows = _create_account_row(importance='200')
		updated_account_row['is_harvesting_active'] = True

		# Act:
		database.upsert_account_current_state(account_row, mosaic_rows)
		database.upsert_account_current_state(updated_account_row, updated_mosaic_rows)

		# Assert:
		cursor = database.connection.cursor()
		cursor.execute(
			'SELECT importance, is_harvesting_active FROM symbol_accounts WHERE address = %s',
			(bytes.fromhex(ADDRESS1),))

		self.assertEqual((200, True), cursor.fetchone())

	def test_get_recently_harvesting_addresses_returns_distinct_addresses_at_or_after_cutoff(self):
		# Arrange:
		database = self._create_database()
		cutoff = datetime.datetime(2026, 1, 1, 0, 2, tzinfo=datetime.timezone.utc)
		database.upsert_blocks([
			_create_block(1, beneficiary_address=b'old', timestamp=cutoff - datetime.timedelta(microseconds=1)),
			_create_block(2, beneficiary_address=b'at cutoff', timestamp=cutoff),
			_create_block(3, beneficiary_address=b'at cutoff', timestamp=cutoff + datetime.timedelta(seconds=1)),
			_create_block(4, beneficiary_address=b'new', timestamp=cutoff + datetime.timedelta(seconds=2))
		])

		# Act:
		result = database.get_recently_harvesting_addresses(cutoff)

		# Assert:
		self.assertEqual({b'at cutoff', b'new'}, result)

	def test_can_upsert_multisig(self):
		# Arrange:
		database = self._create_database()
		account_row, mosaic_rows = _create_account_row()
		database.upsert_account_current_state(account_row, mosaic_rows)
		multisig_row = {
			'address': bytes.fromhex(ADDRESS1),
			'min_approval': 2,
			'min_removal': 1,
			'cosignatory_addresses': [bytes.fromhex('AA' * 24)],
			'multisig_addresses': [bytes.fromhex('BB' * 24)],
			'updated_at_height': 50
		}

		# Act:
		database.upsert_multisig(bytes.fromhex(ADDRESS1), multisig_row)

		# Assert:
		cursor = database.connection.cursor()
		cursor.execute(
			'''
			SELECT min_approval, min_removal, cosignatory_addresses, multisig_addresses, updated_at_height
			FROM symbol_multisig
			WHERE address = %s
			''',
			(bytes.fromhex(ADDRESS1),))
		result = cursor.fetchone()

		self.assertEqual((
			multisig_row['min_approval'],
			multisig_row['min_removal'],
			multisig_row['cosignatory_addresses'],
			multisig_row['multisig_addresses'],
			multisig_row['updated_at_height']
		), (
			result[0],
			result[1],
			[bytes(value) for value in result[2]],
			[bytes(value) for value in result[3]],
			result[4]
		))

	def test_upsert_multisig_deletes_when_none(self):
		# Arrange:
		database = self._create_database()
		account_row, mosaic_rows = _create_account_row()
		database.upsert_account_current_state(account_row, mosaic_rows)
		multisig_row = {
			'address': bytes.fromhex(ADDRESS1),
			'min_approval': 2,
			'min_removal': 1,
			'cosignatory_addresses': [bytes.fromhex('AA' * 24)],
			'multisig_addresses': [bytes.fromhex('BB' * 24)],
			'updated_at_height': 50
		}
		database.upsert_multisig(bytes.fromhex(ADDRESS1), multisig_row)

		# Act:
		database.upsert_multisig(bytes.fromhex(ADDRESS1), None)

		# Assert:
		cursor = database.connection.cursor()
		cursor.execute('SELECT COUNT(*) FROM symbol_multisig WHERE address = %s', (bytes.fromhex(ADDRESS1),))

		self.assertEqual((0,), cursor.fetchone())

	def test_can_update_existing_multisig(self):
		# Arrange:
		database = self._create_database()
		account_row, mosaic_rows = _create_account_row()
		database.upsert_account_current_state(account_row, mosaic_rows)
		first_multisig_row = {
			'address': bytes.fromhex(ADDRESS1),
			'min_approval': 2,
			'min_removal': 1,
			'cosignatory_addresses': [bytes.fromhex('AA' * 24)],
			'multisig_addresses': [bytes.fromhex('BB' * 24)],
			'updated_at_height': 50
		}
		second_multisig_row = {
			'address': bytes.fromhex(ADDRESS1),
			'min_approval': 3,
			'min_removal': 2,
			'cosignatory_addresses': [bytes.fromhex('CC' * 24)],
			'multisig_addresses': [bytes.fromhex('DD' * 24)],
			'updated_at_height': 60
		}

		# Act:
		database.upsert_multisig(bytes.fromhex(ADDRESS1), first_multisig_row)
		database.upsert_multisig(bytes.fromhex(ADDRESS1), second_multisig_row)

		# Assert:
		cursor = database.connection.cursor()
		cursor.execute(
			'''
			SELECT min_approval, min_removal, cosignatory_addresses, multisig_addresses, updated_at_height
			FROM symbol_multisig
			WHERE address = %s
			''',
			(bytes.fromhex(ADDRESS1),))
		result = cursor.fetchone()

		self.assertEqual(3, result[0])
		self.assertEqual(2, result[1])
		self.assertEqual([bytes.fromhex('CC' * 24)], [bytes(value) for value in result[2]])
		self.assertEqual([bytes.fromhex('DD' * 24)], [bytes(value) for value in result[3]])
		self.assertEqual(60, result[4])

	def test_can_insert_snapshot_rows_and_update_importance_percentages(self):
		# Arrange:
		database = self._create_database()
		account_row1, mosaic_rows1 = _create_account_row(ADDRESS1, importance='100')
		account_row2, mosaic_rows2 = _create_account_row(ADDRESS2, importance='300')
		for account_row, mosaic_rows in ((account_row1, mosaic_rows1), (account_row2, mosaic_rows2)):
			database.upsert_account_current_state(account_row, mosaic_rows)
		snapshot_at = datetime.datetime(2026, 1, 1, tzinfo=datetime.timezone.utc)

		# Act:
		database.insert_account_refresh_snapshot_rows('run-1', 'id-1', 0, account_row1, mosaic_rows1, 10, snapshot_at)
		database.insert_account_refresh_snapshot_rows('run-1', 'id-2', 1, account_row2, mosaic_rows2, 10, snapshot_at)
		database.update_account_importance_rates('run-1')

		# Assert:
		cursor = database.connection.cursor()
		cursor.execute(
			'''
			SELECT address, importance_percentage
			FROM symbol_account_refresh_accounts
			WHERE refresh_run_id = 'run-1'
			ORDER BY address
			'''
		)
		snapshot_results = [(bytes(row[0]), row[1]) for row in cursor.fetchall()]
		cursor.execute('SELECT address, importance_percentage FROM symbol_accounts ORDER BY address')
		current_results = [(bytes(row[0]), row[1]) for row in cursor.fetchall()]

		self.assertEqual([
			(bytes.fromhex(ADDRESS1), Decimal('0.25')),
			(bytes.fromhex(ADDRESS2), Decimal('0.75'))
		], snapshot_results)
		self.assertEqual(snapshot_results, current_results)

	def test_update_account_importance_rates_handles_zero_total_importance(self):
		# Arrange:
		database = self._create_database()
		account_row, mosaic_rows = _create_account_row(importance='0')
		database.upsert_account_current_state(account_row, mosaic_rows)
		database.insert_account_refresh_snapshot_rows('run-1', 'id-1', 0, account_row, mosaic_rows, 10, datetime.datetime(2026, 1, 1))

		# Act:
		database.update_account_importance_rates('run-1')

		# Assert:
		cursor = database.connection.cursor()
		cursor.execute('SELECT importance_percentage FROM symbol_account_refresh_accounts WHERE refresh_run_id = %s', ('run-1',))

		self.assertEqual((Decimal('0'),), cursor.fetchone())

	@staticmethod
	def _seed_account_refresh_snapshot_for_ranks(database):
		account_row1, mosaic_rows1 = _create_account_row(
			ADDRESS1, importance='100', mosaics=[{'id': NATIVE_MOSAIC_ID, 'amount': '300'}])
		account_row2, mosaic_rows2 = _create_account_row(
			ADDRESS2, importance='300', mosaics=[{'id': NATIVE_MOSAIC_ID, 'amount': '100'}])
		account_row3, mosaic_rows3 = _create_account_row(
			ADDRESS3, importance='200', mosaics=[{'id': NATIVE_MOSAIC_ID, 'amount': '200'}])
		for account_row, mosaic_rows in ((account_row1, mosaic_rows1), (account_row2, mosaic_rows2), (account_row3, mosaic_rows3)):
			database.upsert_account_current_state(account_row, mosaic_rows)
		snapshot_at = datetime.datetime(2026, 1, 1)
		database.insert_account_refresh_snapshot_rows('run-1', 'id-1', 2, account_row1, mosaic_rows1, 10, snapshot_at)
		database.insert_account_refresh_snapshot_rows('run-1', 'id-2', 0, account_row2, mosaic_rows2, 10, snapshot_at)
		database.insert_account_refresh_snapshot_rows('run-1', 'id-3', 1, account_row3, mosaic_rows3, 10, snapshot_at)
		database.update_account_importance_rates('run-1')

	@staticmethod
	def _fetch_rank_addresses(database, rank_scope):
		cursor = database.connection.cursor()
		cursor.execute(
			'''
			SELECT rank, address
			FROM symbol_account_list_ranks
			WHERE refresh_run_id = 'run-1' AND rank_scope = %s
			ORDER BY rank
			''',
			(rank_scope,))

		return [(rank, bytes(address)) for rank, address in cursor.fetchall()]

	def test_rebuild_account_list_ranks_orders_id_scope_by_account_search_order(self):
		# Arrange:
		database = self._create_database()
		self._seed_account_refresh_snapshot_for_ranks(database)

		# Act:
		database.rebuild_account_list_ranks('run-1', NATIVE_MOSAIC_ID)

		# Assert:
		self.assertEqual([
			(0, bytes.fromhex(ADDRESS2)),
			(1, bytes.fromhex(ADDRESS3)),
			(2, bytes.fromhex(ADDRESS1))
		], self._fetch_rank_addresses(database, 'ID'))

	def test_rebuild_account_list_ranks_orders_importance_scope_by_importance_percentage(self):
		# Arrange:
		database = self._create_database()
		self._seed_account_refresh_snapshot_for_ranks(database)

		# Act:
		database.rebuild_account_list_ranks('run-1', NATIVE_MOSAIC_ID)

		# Assert:
		self.assertEqual([
			(0, bytes.fromhex(ADDRESS2)),
			(1, bytes.fromhex(ADDRESS3)),
			(2, bytes.fromhex(ADDRESS1))
		], self._fetch_rank_addresses(database, 'IMPORTANCE'))

	def test_rebuild_account_list_ranks_orders_native_balance_scope_by_amount(self):
		# Arrange:
		database = self._create_database()
		self._seed_account_refresh_snapshot_for_ranks(database)

		# Act:
		database.rebuild_account_list_ranks('run-1', NATIVE_MOSAIC_ID)

		# Assert:
		self.assertEqual([
			(0, bytes.fromhex(ADDRESS1)),
			(1, bytes.fromhex(ADDRESS3)),
			(2, bytes.fromhex(ADDRESS2))
		], self._fetch_rank_addresses(database, f'BALANCE:{NATIVE_MOSAIC_ID}'))

	def test_repair_rollback_marks_account_refresh_state_stale_when_completed_height_is_rollbacked(self):
		# Arrange:
		database = self._create_database()
		database.upsert_account_refresh_state({
			'status': 'healthy',
			'last_successful_run_id': 'run-1',
			'last_completed_height': 10
		})

		# Act:
		database.repair_rollback_from_height(10, _create_sync_state(status='repairing', last_synced_height=9))

		# Assert:
		self.assertEqual('stale', database.get_account_refresh_state()['status'])

	def test_repair_rollback_leaves_account_refresh_state_when_completed_height_is_before_rollback(self):
		# Arrange:
		database = self._create_database()
		database.upsert_account_refresh_state({
			'status': 'healthy',
			'last_successful_run_id': 'run-1',
			'last_completed_height': 9
		})

		# Act:
		database.repair_rollback_from_height(10, _create_sync_state(status='repairing', last_synced_height=9))

		# Assert:
		self.assertEqual('healthy', database.get_account_refresh_state()['status'])

	def test_repair_rollback_does_not_delete_account_refresh_rows(self):
		# Arrange:
		database = self._create_database()
		account_row, mosaic_rows = _create_account_row()
		database.upsert_account_current_state(account_row, mosaic_rows)
		database.upsert_multisig(bytes.fromhex(ADDRESS1), {
			'address': bytes.fromhex(ADDRESS1),
			'min_approval': 1,
			'min_removal': 1,
			'cosignatory_addresses': [],
			'multisig_addresses': [],
			'updated_at_height': 10
		})
		database.insert_account_refresh_snapshot_rows('run-1', 'id-1', 0, account_row, mosaic_rows, 10, datetime.datetime(2026, 1, 1))
		database.rebuild_account_list_ranks('run-1', NATIVE_MOSAIC_ID)

		# Act:
		database.repair_rollback_from_height(10, _create_sync_state(status='repairing', last_synced_height=9))

		# Assert:
		expected_address = bytes.fromhex(ADDRESS1)
		expected_mosaic_row = mosaic_rows[0]
		cursor = database.connection.cursor()
		cursor.execute('SELECT address FROM symbol_accounts')
		account_results = cursor.fetchall()
		cursor.execute('SELECT address, mosaic_id, amount FROM symbol_account_mosaics')
		mosaic_results = cursor.fetchall()
		cursor.execute('SELECT address, min_approval, min_removal FROM symbol_multisig')
		multisig_results = cursor.fetchall()
		cursor.execute('SELECT refresh_run_id, account_search_id, address FROM symbol_account_refresh_accounts')
		refresh_account_results = cursor.fetchall()
		cursor.execute('SELECT refresh_run_id, address, mosaic_id, amount FROM symbol_account_refresh_mosaics')
		refresh_mosaic_results = cursor.fetchall()

		self.assertEqual([(expected_address,)], [(bytes(address),) for address, in account_results])
		self.assertEqual(
			[(expected_address, expected_mosaic_row['mosaic_id'], expected_mosaic_row['amount'])],
			[(bytes(address), mosaic_id, amount) for address, mosaic_id, amount in mosaic_results])
		self.assertEqual(
			[(expected_address, 1, 1)],
			[(bytes(address), min_approval, min_removal) for address, min_approval, min_removal in multisig_results])
		self.assertEqual(
			[('run-1', 'id-1', expected_address)],
			[(run_id, account_search_id, bytes(address)) for run_id, account_search_id, address in refresh_account_results])
		self.assertEqual(
			[('run-1', expected_address, expected_mosaic_row['mosaic_id'], expected_mosaic_row['amount'])],
			[(run_id, bytes(address), mosaic_id, amount) for run_id, address, mosaic_id, amount in refresh_mosaic_results])
		self.assertEqual([(0, expected_address)], self._fetch_rank_addresses(database, 'ID'))
		self.assertEqual([(0, expected_address)], self._fetch_rank_addresses(database, 'IMPORTANCE'))
		self.assertEqual([(0, expected_address)], self._fetch_rank_addresses(database, f'BALANCE:{NATIVE_MOSAIC_ID}'))

	def test_rejects_invalid_block_type(self):
		# Arrange:
		database = self._create_database()

		# Act + Assert:
		with self.assertRaises(PsycopgError):
			database.upsert_blocks([_create_block(1, block_type='invalid')])

	def test_can_get_block_hash(self):
		# Arrange:
		database = self._create_database()
		database.upsert_blocks([_create_block(1), _create_block(2)])

		# Act:
		block_hash = database.get_block_hash(2)

		# Assert:
		self.assertEqual(b'hash 2', bytes(block_hash))

	def test_can_get_block_hashes(self):
		# Arrange:
		database = self._create_database()
		database.upsert_blocks([
			_create_block(1),
			_create_block(2),
			_create_block(3)
		])

		# Act:
		block_hashes = database.get_block_hashes(1, 2)

		# Assert:
		self.assertEqual([
			(1, b'hash 1'),
			(2, b'hash 2')
		], [
			(height, bytes(hash_value))
			for height, hash_value in block_hashes
		])

	def test_can_upsert_importance_block_fields(self):
		# Arrange:
		database = self._create_database()

		# Act:
		database.upsert_blocks([_create_block(
			7,
			voting_eligible_accounts_count=4,
			harvesting_eligible_accounts_count=17,
			total_voting_balance=19000235663367,
			previous_importance_block_hash=bytes.fromhex('86' * 32)
		)])

		# Assert:
		cursor = database.connection.cursor()
		cursor.execute(
			'''
			SELECT
				voting_eligible_accounts_count,
				harvesting_eligible_accounts_count,
				total_voting_balance,
				previous_importance_block_hash,
				block_type
			FROM symbol_blocks
			WHERE height = 7
			'''
		)
		result = cursor.fetchone()

		self.assertEqual(4, result[0])
		self.assertEqual(17, result[1])
		self.assertEqual(19000235663367, result[2])
		self.assertEqual(bytes.fromhex('86' * 32), bytes(result[3]))
		self.assertEqual('nemesis', result[4])

	def test_can_upsert_block_when_total_fee_exceeds_int4(self):
		# Arrange:
		database = self._create_database()
		large_total_fee = 13199992608

		# Act:
		database.upsert_blocks([_create_block(
			6224,
			timestamp=datetime.datetime(2026, 1, 1, tzinfo=datetime.timezone.utc),
			total_fee=large_total_fee
		)])

		# Assert:
		cursor = database.connection.cursor()
		cursor.execute(
			'''
			SELECT total_fee
			FROM symbol_blocks
			WHERE height = 6224
			'''
		)
		result = cursor.fetchone()

		self.assertEqual((large_total_fee,), result)

	def test_can_update_existing_block(self):
		# Arrange:
		database = self._create_database()
		database.upsert_blocks([_create_block(1)])

		# Act:
		database.upsert_blocks([_create_block(1, block_hash=b'updated hash')])

		# Assert:
		cursor = database.connection.cursor()
		cursor.execute(
			'''
			SELECT COUNT(*), encode(hash, 'escape'), total_fee, raw_payload
			FROM symbol_blocks
			WHERE height = 1
			GROUP BY hash, total_fee, raw_payload
			'''
		)
		result = cursor.fetchone()

		self.assertEqual(1, result[0])
		self.assertEqual('updated hash', result[1])
		self.assertEqual(100, result[2])
		self.assertEqual({'height': 1}, result[3])

	def test_rejects_duplicate_block_hash_for_different_heights(self):
		# Arrange:
		database = self._create_database()
		database.upsert_blocks([_create_block(1, block_hash=b'same hash')])

		# Act + Assert:
		with self.assertRaises(PsycopgError):
			database.upsert_blocks([_create_block(2, block_hash=b'same hash')])

	def test_rejects_receipt_without_existing_block(self):
		# Arrange:
		database = self._create_database()

		# Act + Assert:
		with self.assertRaises(PsycopgError):
			database.upsert_receipts_for_height(7, [_create_receipt(7)], 100)

	def test_rejects_invalid_receipt_type(self):
		# Arrange:
		database = self._create_database()
		database.upsert_blocks([_create_block(1)])

		# Act + Assert:
		with self.assertRaises(PsycopgError):
			database.upsert_receipts_for_height(1, [_create_receipt(1, receipt_type='invalid')], 100)

	def test_rejects_invalid_receipt_group(self):
		# Arrange:
		database = self._create_database()
		database.upsert_blocks([_create_block(1)])

		# Act + Assert:
		with self.assertRaises(PsycopgError):
			database.upsert_receipts_for_height(1, [_create_receipt(1, receipt_group='invalid')], 100)

	def test_upsert_receipts_for_height_replaces_rows_and_updates_block_reward(self):
		# Arrange:
		database = self._create_database()
		database.upsert_blocks([_create_block(1), _create_block(2)])
		database.upsert_receipts_for_height(1, [
			_create_receipt(1, amount=50),
			_create_receipt(1, receipt_type='mosaicExpired', receipt_group='artifactExpiry', mosaic_id=None, amount=0)
		], 50)

		# Act:
		database.upsert_receipts_for_height(1, [
			_create_receipt(1, amount=75, raw_payload={'type': ReceiptType.INFLATION.value, 'amount': '75'})
		], 75)

		# Assert:
		cursor = database.connection.cursor()
		cursor.execute(
			'''
			SELECT height, receipt_type, receipt_group, source_primary_id, source_secondary_id, mosaic_id, amount, raw_payload
			FROM symbol_receipts
			ORDER BY id
			'''
		)
		receipts = cursor.fetchall()
		cursor.execute('SELECT block_reward FROM symbol_blocks WHERE height = 1')
		block_reward = cursor.fetchone()[0]

		self.assertEqual([
			(1, 'inflation', 'inflation', 0, 0, '72C0212E67A08BCE', 75, {'type': ReceiptType.INFLATION.value, 'amount': '75'})
		], receipts)
		self.assertEqual(75, block_reward)

	def test_upsert_receipts_for_height_stores_empty_height_with_zero_reward(self):
		# Arrange:
		database = self._create_database()
		database.upsert_blocks([_create_block(1)])

		# Act:
		database.upsert_receipts_for_height(1, [], 0)

		# Assert:
		cursor = database.connection.cursor()
		cursor.execute('SELECT COUNT(*) FROM symbol_receipts')
		receipt_count = cursor.fetchone()[0]
		cursor.execute('SELECT block_reward FROM symbol_blocks WHERE height = 1')
		block_reward = cursor.fetchone()[0]

		self.assertEqual(0, receipt_count)
		self.assertEqual(0, block_reward)

	def test_can_delete_blocks_from_height(self):
		# Arrange:
		database = self._create_database()
		database.upsert_blocks([
			_create_block(1),
			_create_block(2),
			_create_block(3)
		])
		database.upsert_receipts_for_height(2, [_create_receipt(2)], 100)
		database.upsert_receipts_for_height(3, [_create_receipt(3)], 100)

		# Act:
		database.delete_blocks_from_height(2)

		# Assert:
		cursor = database.connection.cursor()
		cursor.execute('SELECT height FROM symbol_blocks ORDER BY height')
		block_results = cursor.fetchall()
		cursor.execute('SELECT height FROM symbol_receipts ORDER BY height')
		receipt_results = cursor.fetchall()

		self.assertEqual([(1,)], block_results)
		self.assertEqual([], receipt_results)

	def test_upsert_transactions_for_height_computes_effective_fee(self):
		# Arrange:
		database = self._create_database()
		cursor = database.connection.cursor()
		database.upsert_blocks([_create_block(2, fee_multiplier=2)])

		# Act:
		database.upsert_transactions_for_height(2, [
			create_transaction_entry(2, 'top-level', max_fee=100, size=3),
			create_transaction_entry(2, 'embedded', is_embedded=True)
		])

		# Assert:
		cursor.execute(
			'''
			SELECT encode(hash, 'escape'), effective_fee
			FROM symbol_transactions
			ORDER BY id
			'''
		)
		results = cursor.fetchall()

		self.assertEqual([
			('hash-top-level', 6),
			(None, None)
		], results)

	def test_upsert_transactions_for_height_replaces_parent_and_child_rows(self):
		# Arrange:
		database = self._create_database()
		cursor = database.connection.cursor()
		database.upsert_blocks([_create_block(1), _create_block(2)])
		database.upsert_transactions_for_height(1, [create_transaction_entry(
			1,
			'old',
			mosaic_rows=[{
				'mosaic_id': '1111111111111111',
				'amount': 10,
				'role': 'transfer',
				'position': 0
			}],
			address_rows=[{
				'address': b'old address',
				'role': 'signer'
			}]
		)])

		# Act:
		database.upsert_transactions_for_height(1, [create_transaction_entry(
			1,
			'new',
			mosaic_rows=[{
				'mosaic_id': '2222222222222222',
				'amount': 20,
				'role': 'definition',
				'position': 0
			}],
			address_rows=[{
				'address': b'new address',
				'role': 'recipient'
			}]
		)])

		# Assert:
		cursor.execute('SELECT encode(hash, \'escape\') FROM symbol_transactions')
		transaction_results = cursor.fetchall()
		cursor.execute('SELECT mosaic_id, amount, role FROM symbol_transaction_mosaics ORDER BY mosaic_id')
		mosaic_results = cursor.fetchall()
		cursor.execute('SELECT encode(address, \'escape\'), role FROM symbol_transaction_addresses ORDER BY role')
		address_results = cursor.fetchall()

		self.assertEqual([('hash-new',)], transaction_results)
		self.assertEqual([('2222222222222222', 20, 'definition')], mosaic_results)
		self.assertEqual([('new address', 'recipient')], address_results)

	def test_upsert_transactions_for_height_clears_existing_rows_when_replaced_with_empty_list(self):
		# Arrange:
		database = self._create_database()
		cursor = database.connection.cursor()
		database.upsert_blocks([_create_block(1)])
		database.upsert_transactions_for_height(1, [create_transaction_entry(
			1,
			'stale',
			mosaic_rows=[{'mosaic_id': '1111111111111111', 'amount': 10, 'role': 'transfer', 'position': 0}],
			address_rows=[{'address': b'stale address', 'role': 'signer'}]
		)])

		# Act:
		database.upsert_transactions_for_height(1, [])

		# Assert:
		cursor.execute('SELECT COUNT(*) FROM symbol_transactions')
		transaction_count = cursor.fetchone()[0]
		cursor.execute('SELECT COUNT(*) FROM symbol_transaction_mosaics')
		mosaic_count = cursor.fetchone()[0]
		cursor.execute('SELECT COUNT(*) FROM symbol_transaction_addresses')
		address_count = cursor.fetchone()[0]

		self.assertEqual(0, transaction_count)
		self.assertEqual(0, mosaic_count)
		self.assertEqual(0, address_count)

	def test_upsert_transactions_for_height_assigns_list_sequence_to_top_level_rows(self):
		# Arrange:
		database = self._create_database()
		cursor = database.connection.cursor()
		database.upsert_blocks([_create_block(1), _create_block(2)])

		# Act:
		database.upsert_transactions_for_height(1, [
			create_transaction_entry(1, 'first'),
			create_transaction_entry(1, 'embedded', is_embedded=True),
			create_transaction_entry(1, 'second')
		])
		database.upsert_transactions_for_height(2, [
			create_transaction_entry(2, 'third')
		])

		# Assert:
		cursor.execute(
			'''
			SELECT encode(COALESCE(hash, aggregate_hash), 'escape'), list_sequence
			FROM symbol_transactions
			ORDER BY id
			'''
		)
		results = cursor.fetchall()

		self.assertEqual('hash-first', results[0][0])
		self.assertEqual('aggregate-hash-embedded', results[1][0])
		self.assertEqual('hash-second', results[2][0])
		self.assertEqual('hash-third', results[3][0])
		self.assertIsNone(results[1][1])
		self.assertLess(results[0][1], results[2][1])
		self.assertLess(results[2][1], results[3][1])

	def test_upsert_transactions_for_height_rejects_missing_block_height(self):
		# Arrange:
		database = self._create_database()

		# Act + Assert:
		with self.assertRaises(PsycopgError):
			database.upsert_transactions_for_height(7, [create_transaction_entry(7)])

	def test_upsert_transactions_for_height_rejects_duplicate_hash(self):
		# Arrange:
		database = self._create_database()
		database.upsert_blocks([_create_block(1)])

		# Act + Assert:
		with self.assertRaises(PsycopgError):
			database.upsert_transactions_for_height(1, [
				create_transaction_entry(1, 'duplicate'),
				create_transaction_entry(1, 'duplicate')
			])

	def test_upsert_transactions_for_height_rejects_duplicate_embedded_position(self):
		# Arrange:
		database = self._create_database()
		database.upsert_blocks([_create_block(1)])

		# Act + Assert:
		with self.assertRaises(PsycopgError):
			database.upsert_transactions_for_height(1, [
				create_transaction_entry(1, 'duplicate', is_embedded=True),
				create_transaction_entry(1, 'duplicate', is_embedded=True)
			])

	def test_upsert_transactions_for_height_persists_body_and_raw_payload(self):
		# Arrange:
		database = self._create_database()
		cursor = database.connection.cursor()
		database.upsert_blocks([_create_block(1)])

		# Act:
		database.upsert_transactions_for_height(1, [create_transaction_entry(
			1,
			body={'field': 'value'},
			raw_payload={'meta': {'height': '1'}}
		)])

		# Assert:
		cursor.execute('SELECT body, raw_payload FROM symbol_transactions')
		result = cursor.fetchone()

		self.assertEqual({'field': 'value'}, result[0])
		self.assertEqual({'meta': {'height': '1'}}, result[1])

	def test_delete_blocks_from_height_deletes_transaction_family_rows(self):
		# Arrange:
		database = self._create_database()
		cursor = database.connection.cursor()
		database.upsert_blocks([_create_block(1), _create_block(2), _create_block(3)])
		database.upsert_transactions_for_height(1, [create_transaction_entry(1, 'kept')])
		database.upsert_transactions_for_height(2, [create_transaction_entry(
			2,
			'deleted',
			mosaic_rows=[{'mosaic_id': '1111111111111111', 'amount': 10, 'role': 'transfer', 'position': 0}],
			address_rows=[{'address': b'deleted address', 'role': 'signer'}]
		)])

		# Act:
		database.delete_blocks_from_height(2)

		# Assert:
		cursor.execute('SELECT encode(hash, \'escape\') FROM symbol_transactions')
		transaction_results = cursor.fetchall()
		cursor.execute('SELECT COUNT(*) FROM symbol_transaction_mosaics')
		mosaic_count = cursor.fetchone()[0]
		cursor.execute('SELECT COUNT(*) FROM symbol_transaction_addresses')
		address_count = cursor.fetchone()[0]
		cursor.execute('SELECT height FROM symbol_blocks ORDER BY height')
		block_results = cursor.fetchall()

		self.assertEqual([('hash-kept',)], transaction_results)
		self.assertEqual(0, mosaic_count)
		self.assertEqual(0, address_count)
		self.assertEqual([(1,)], block_results)

	def test_delete_blocks_from_height_deletes_account_family_rows(self):
		# Arrange:
		database = self._create_database()
		cursor = database.connection.cursor()
		database.upsert_blocks([_create_block(1), _create_block(2), _create_block(3)])
		kept_account_row, kept_mosaic_rows = _create_account_row(ADDRESS1, observed_height=1)
		rollbacked_account_row, rollbacked_mosaic_rows = _create_account_row(RECIPIENT_ADDRESS, observed_height=2)
		after_fork_account_row, after_fork_mosaic_rows = _create_account_row(ADDRESS4, observed_height=3)
		database.upsert_account_current_state(kept_account_row, kept_mosaic_rows)
		database.upsert_account_current_state(rollbacked_account_row, rollbacked_mosaic_rows)
		database.upsert_account_current_state(after_fork_account_row, after_fork_mosaic_rows)
		kept_multisig_row = _create_multisig_row(ADDRESS1, 1)
		rollbacked_multisig_row = _create_multisig_row(RECIPIENT_ADDRESS, 2)
		after_fork_multisig_row = _create_multisig_row(ADDRESS4, 3)
		database.upsert_multisig(kept_multisig_row['address'], kept_multisig_row)
		database.upsert_multisig(rollbacked_multisig_row['address'], rollbacked_multisig_row)
		database.upsert_multisig(after_fork_multisig_row['address'], after_fork_multisig_row)

		# Act:
		database.delete_blocks_from_height(2)

		# Assert:
		cursor.execute('SELECT encode(address, \'hex\'), last_seen_height FROM symbol_accounts ORDER BY address')
		account_results = cursor.fetchall()
		cursor.execute(
			'SELECT encode(address, \'hex\'), mosaic_id, updated_at_height FROM symbol_account_mosaics ORDER BY address, mosaic_id')
		mosaic_results = cursor.fetchall()
		cursor.execute('SELECT encode(address, \'hex\'), updated_at_height FROM symbol_multisig ORDER BY address')
		multisig_results = cursor.fetchall()

		self.assertEqual([(ADDRESS1.lower(), 1)], account_results)
		self.assertEqual([(ADDRESS1.lower(), NATIVE_MOSAIC_ID, 1)], mosaic_results)
		self.assertEqual([(ADDRESS1.lower(), 1)], multisig_results)

	def test_can_repair_rollback_from_height_in_one_transaction(self):
		# Arrange:
		database = self._create_database()
		database.upsert_blocks([
			_create_block(1),
			_create_block(2),
			_create_block(3)
		])
		database.upsert_transactions_for_height(1, [create_transaction_entry(
			1,
			'kept',
			mosaic_rows=[{'mosaic_id': '2222222222222222', 'amount': 20, 'role': 'transfer', 'position': 0}],
			address_rows=[{'address': b'kept address', 'role': 'signer'}]
		)])
		database.upsert_transactions_for_height(2, [create_transaction_entry(
			2,
			'rollbacked',
			mosaic_rows=[{'mosaic_id': '1111111111111111', 'amount': 10, 'role': 'transfer', 'position': 0}],
			address_rows=[{'address': b'rollbacked address', 'role': 'signer'}]
		)])
		database.upsert_receipts_for_height(1, [_create_receipt(1)], 100)
		database.upsert_receipts_for_height(2, [_create_receipt(2)], 100)
		database.upsert_receipts_for_height(3, [_create_receipt(3)], 100)
		database.upsert_account_current_state(*_create_account_row(ADDRESS1, observed_height=1))
		database.upsert_account_current_state(*_create_account_row(RECIPIENT_ADDRESS, observed_height=2))
		database.upsert_multisig(bytes.fromhex(ADDRESS1), _create_multisig_row(ADDRESS1, 1))
		database.upsert_multisig(bytes.fromhex(RECIPIENT_ADDRESS), _create_multisig_row(RECIPIENT_ADDRESS, 2))

		# Act:
		database.repair_rollback_from_height(2, _create_sync_state(
			status='repairing',
			last_synced_height=1,
			last_synced_block_hash=b'hash 1'
		))

		# Assert:
		cursor = database.connection.cursor()
		cursor.execute('SELECT height FROM symbol_blocks ORDER BY height')
		block_results = cursor.fetchall()
		cursor.execute('SELECT height, encode(hash, \'escape\') FROM symbol_transactions ORDER BY height')
		transaction_results = cursor.fetchall()
		cursor.execute('SELECT height, mosaic_id, amount, role FROM symbol_transaction_mosaics ORDER BY height')
		mosaic_results = cursor.fetchall()
		cursor.execute('SELECT height, encode(address, \'escape\'), role FROM symbol_transaction_addresses ORDER BY height')
		address_results = cursor.fetchall()
		cursor.execute('SELECT height FROM symbol_receipts ORDER BY height')
		receipt_results = cursor.fetchall()
		cursor.execute('SELECT height, block_reward FROM symbol_blocks ORDER BY height')
		block_reward_results = cursor.fetchall()
		cursor.execute('SELECT encode(address, \'hex\'), last_seen_height FROM symbol_accounts ORDER BY address')
		account_results = cursor.fetchall()
		cursor.execute(
			'SELECT encode(address, \'hex\'), mosaic_id, updated_at_height FROM symbol_account_mosaics ORDER BY address, mosaic_id')
		account_mosaic_results = cursor.fetchall()
		cursor.execute('SELECT encode(address, \'hex\'), updated_at_height FROM symbol_multisig ORDER BY address')
		multisig_results = cursor.fetchall()
		sync_state = database.get_sync_state()

		self.assertEqual([(1,)], block_results)
		self.assertEqual([(1, 'hash-kept')], transaction_results)
		self.assertEqual([(1, '2222222222222222', 20, 'transfer')], mosaic_results)
		self.assertEqual([(1, 'kept address', 'signer')], address_results)
		self.assertEqual([(1,)], receipt_results)
		self.assertEqual([(1, 100)], block_reward_results)
		self.assertEqual([(ADDRESS1.lower(), 1)], account_results)
		self.assertEqual([(ADDRESS1.lower(), NATIVE_MOSAIC_ID, 1)], account_mosaic_results)
		self.assertEqual([(ADDRESS1.lower(), 1)], multisig_results)
		self.assertEqual('repairing', sync_state['status'])
		self.assertEqual(1, sync_state['last_synced_height'])
		self.assertEqual(
			bytes(b'hash 1'),
			bytes(sync_state['last_synced_block_hash'])
		)

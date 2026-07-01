# pylint: disable=duplicate-code
import datetime
from collections import namedtuple
from contextlib import ExitStack
from unittest import TestCase

from common.tests.PostgresTestUtils import PostgresTestDatabase, drop_symbol_block_tables_if_present
from psycopg2 import Error as PsycopgError
from psycopg2.extras import Json

from puller.db.SymbolDatabase import SymbolDatabase

DatabaseConfig = namedtuple(
	'DatabaseConfig',
	['database', 'user', 'password', 'host', 'port'])


def _create_block(height, block_hash=None, **overrides):
	block_hash = block_hash or f'hash {height}'.encode('utf8')

	block = {
		'height': height,
		'hash': block_hash,
		'previous_hash': f'previous {height}'.encode('utf8'),
		'timestamp': datetime.datetime(
			2026,
			1,
			1,
			0,
			height,
			tzinfo=datetime.timezone.utc
		),
		'network_timestamp': height * 1000,
		'total_fee': height * 100,
		'transactions_count': height,
		'total_transactions_count': height + 10,
		'statements_count': height + 1,
		'difficulty': 100000 + height,
		'fee_multiplier': height,
		'block_type': 32835,
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


class SymbolDatabaseTest(TestCase):
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
				AND table_name IN ('symbol_blocks', 'symbol_sync_state')
			ORDER BY table_name
			'''
		)
		tables = [result[0] for result in cursor.fetchall()]

		self.assertEqual(['symbol_blocks', 'symbol_sync_state'], tables)

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

		cursor.execute(
			'''
			SELECT pg_type.typname, enumlabel
			FROM pg_enum
			JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
			WHERE pg_type.typname IN (
				'symbol_block_type',
				'symbol_sync_state_status'
			)
			ORDER BY pg_type.typname, enumsortorder
			'''
		)
		enum_values = cursor.fetchall()

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
		self.assertEqual([
			('symbol_block_type', 'nemesis'),
			('symbol_block_type', 'importance'),
			('symbol_block_type', 'normal'),
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
			('total_fee', 'int4', 'NO', None),
			('transactions_count', 'int4', 'NO', None),
			('total_transactions_count', 'int4', 'NO', None),
			('statements_count', 'int4', 'NO', None),
			('difficulty', 'int8', 'NO', None),
			('fee_multiplier', 'int8', 'NO', None),
			('block_type', 'symbol_block_type', 'NO', None),
			('signer_public_key', 'bytea', 'NO', None),
			('signer_address', 'bytea', 'NO', None),
			('beneficiary_address', 'bytea', 'NO', None),
			('signature', 'bytea', 'NO', None),
			('size', 'int8', 'NO', None),
			('proof_gamma', 'bytea', 'NO', None),
			('proof_verification_hash', 'bytea', 'NO', None),
			('proof_scalar', 'bytea', 'NO', None),
			('state_hash', 'bytea', 'NO', None),
			('transactions_hash', 'bytea', 'NO', None),
			('receipts_hash', 'bytea', 'NO', None),
			('state_hash_sub_cache_roots', 'jsonb', 'NO', "'[]'::jsonb"),
			('voting_eligible_accounts_count', 'int8', 'YES', None),
			('harvesting_eligible_accounts_count', 'int4', 'YES', None),
			('total_voting_balance', 'int8', 'YES', None),
			('previous_importance_block_hash', 'bytea', 'YES', None),
			('raw_payload', 'jsonb', 'NO', None),
			('created_at', 'timestamp', 'NO', 'CURRENT_TIMESTAMP'),
			('updated_at', 'timestamp', 'NO', 'CURRENT_TIMESTAMP')
		], columns)
		self.assertEqual([
			('PRIMARY KEY', 'height'),
			('UNIQUE', 'hash')
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

	def test_rejects_unknown_block_type(self):
		# Arrange:
		database = self._create_database()

		# Act + Assert:
		with self.assertRaisesRegex(
			ValueError,
			'Unsupported Symbol block type 1'
		):
			database.upsert_blocks([_create_block(1, block_type=1)])

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

	def test_can_delete_blocks_from_height(self):
		# Arrange:
		database = self._create_database()
		database.upsert_blocks([
			_create_block(1),
			_create_block(2),
			_create_block(3)
		])

		# Act:
		database.delete_blocks_from_height(2)

		# Assert:
		cursor = database.connection.cursor()
		cursor.execute('SELECT height FROM symbol_blocks ORDER BY height')
		results = cursor.fetchall()

		self.assertEqual([(1,)], results)

	def test_can_repair_rollback_from_height_in_one_transaction(self):
		# Arrange:
		database = self._create_database()
		database.upsert_blocks([
			_create_block(1),
			_create_block(2),
			_create_block(3)
		])

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
		sync_state = database.get_sync_state()

		self.assertEqual([(1,)], block_results)
		self.assertEqual('repairing', sync_state['status'])
		self.assertEqual(1, sync_state['last_synced_height'])
		self.assertEqual(
			bytes(b'hash 1'),
			bytes(sync_state['last_synced_block_hash'])
		)

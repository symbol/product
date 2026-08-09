# pylint: disable=duplicate-code,protected-access,too-many-lines
import asyncio
from unittest import TestCase

from symbolchain.sc import TransactionType
from symbolchain.symbol.Network import Address
from symbollightapi.model.Exceptions import NodeException

from puller.facade.SymbolPuller import SymbolPuller
from puller.model.symbol.Account import create_account_row
from puller.model.symbol.Lock import create_hash_lock_row, create_secret_lock_row, create_secret_lock_search_key
from puller.model.symbol.MosaicRestriction import MosaicRestrictionEntryType, MosaicRestrictionKey, create_mosaic_restriction_row
from puller.model.symbol.Receipt import create_receipt_rows
from tests.test.SymbolLockTestUtils import create_secret_lock_item
from tests.test.SymbolMetadataTestUtils import create_expected_metadata_row, create_metadata_item
from tests.test.SymbolMosaicTestUtils import create_expected_mosaic_row, create_mosaic_item
from tests.test.SymbolNamespaceTestUtils import NAMESPACE_ROOT_ID, create_namespace_item, seed_namespace
from tests.test.SymbolTestConstants import RECIPIENT_ADDRESS, SIGNER_ADDRESS

from ...test.SymbolTransactionTestUtils import create_transaction_entry
from .puller_test_utils import (
	FakeConnector,
	SymbolPullerTestBase,
	create_account_item,
	create_amount_statement_item,
	create_node_block,
	create_node_transaction,
	create_resolution_statement,
	create_sync_state,
	set_symbol_connector,
	transaction_path
)

MOSAIC_ID = '72C0212E67A08BCE'
ALIAS_ADDRESS = '99065A28385EB5AE88000000000000000000000000000000'
ALIAS_MOSAIC_ID = 'E74B99BA41F4AFEE'
ALIAS_MOSAIC_ID_2 = 'A95F1F8A96159516'
RESOLVED_MOSAIC_ID_2 = '1111111111111111'
GLOBAL_RESTRICTION_PATH = (
	f'restrictions/mosaic?mosaicId={MOSAIC_ID}&entryType=1&pageSize=100&pageNumber=1')
ADDRESS_RESTRICTION_PATH = (
	f'restrictions/mosaic?mosaicId={MOSAIC_ID}&entryType=0&pageSize=100&pageNumber=1'
	'&targetAddress=TCXBENCWPCIKXTPPCI2FM6EQVPG66ERUKZ4JBKY')


def _resolution_entry(primary_id, secondary_id, resolved):
	return {'source': {'primaryId': primary_id, 'secondaryId': secondary_id}, 'resolved': resolved}


def _address_transaction(mosaic_id=MOSAIC_ID, target_address=None):
	return {
		'type': TransactionType.MOSAIC_ADDRESS_RESTRICTION.value,
		'height': 10,
		'target_address': target_address or bytes.fromhex(RECIPIENT_ADDRESS),
		'mosaic_rows': [
			{'mosaic_id': mosaic_id, 'role': 'restriction', 'position': 0},
			{'mosaic_id': '1111111111111111', 'role': 'restriction', 'position': 1}
		]
	}


def _global_transaction(mosaic_id=MOSAIC_ID, reference_mosaic_id=None):
	transaction = {
		'type': TransactionType.MOSAIC_GLOBAL_RESTRICTION.value,
		'height': 11,
		'target_address': None,
		'mosaic_rows': [
			{'mosaic_id': mosaic_id, 'role': 'restriction', 'position': 0}
		]
	}
	if reference_mosaic_id is not None:
		transaction['mosaic_rows'].append({
			'mosaic_id': reference_mosaic_id, 'role': 'restriction', 'position': 1})
	return transaction


def _global_response_item(mosaic_id=MOSAIC_ID):
	return {
		'id': 'BB' * 12,
		'mosaicRestrictionEntry': {
			'version': 1,
			'compositeHash': 'AA' * 32,
			'entryType': 1,
			'mosaicId': mosaic_id,
			'restrictions': []
		}
	}


def _address_response_item(mosaic_id=MOSAIC_ID, target_address=RECIPIENT_ADDRESS):
	return {
		'id': 'BB' * 12,
		'mosaicRestrictionEntry': {
			'version': 1,
			'compositeHash': 'AA' * 32,
			'entryType': 0,
			'mosaicId': mosaic_id,
			'targetAddress': target_address,
			'restrictions': []
		}
	}


def _restriction_path(entry_type, target_address=None, mosaic_id=MOSAIC_ID):
	path = f'restrictions/mosaic?mosaicId={mosaic_id}&entryType={entry_type}&pageSize=100&pageNumber=1'
	return path if target_address is None else f'{path}&targetAddress={Address(bytes.fromhex(target_address))}'


def _restriction_paths(connector):
	return [path for path in connector.paths if path.startswith('restrictions/mosaic?')]


class PullerMosaicRestrictionsTest(TestCase):
	def test_collector_returns_empty_set_for_empty_input(self):
		# Arrange:
		transaction_rows_by_height = {}

		# Act:
		keys = SymbolPuller._collect_dirty_mosaic_restriction_keys_for_batch(transaction_rows_by_height)

		# Assert:
		self.assertEqual(set(), keys)

	def test_collector_deduplicates_duplicate_logical_keys(self):
		# Arrange:
		transactions = [_global_transaction(), _global_transaction()]

		# Act:
		keys = SymbolPuller._collect_dirty_mosaic_restriction_keys_for_batch({
			10: transactions})

		# Assert:
		self.assertEqual({MosaicRestrictionKey(MosaicRestrictionEntryType.GLOBAL, MOSAIC_ID, None)}, keys)

	def test_collector_ignores_non_mosaic_restriction_transactions(self):
		for transaction_type in (
			TransactionType.ACCOUNT_ADDRESS_RESTRICTION.value,
			TransactionType.TRANSFER.value
		):
			with self.subTest(transaction_type=transaction_type):
				# Arrange:
				transaction = _global_transaction()
				transaction['type'] = transaction_type

				# Act:
				keys = SymbolPuller._collect_dirty_mosaic_restriction_keys_for_batch({10: [transaction]})

				# Assert:
				self.assertEqual(set(), keys)

	def test_collector_ignores_global_reference_position_one(self):
		# Arrange:
		transaction = _global_transaction(reference_mosaic_id='1111111111111111')

		# Act:
		keys = SymbolPuller._collect_dirty_mosaic_restriction_keys_for_batch({
			11: [transaction]})

		# Assert:
		self.assertEqual({MosaicRestrictionKey(MosaicRestrictionEntryType.GLOBAL, MOSAIC_ID, None)}, keys)

	def test_collector_uses_resolved_primary_restriction_mosaic_relation_and_target_address(self):
		# Arrange:
		# Position 0 is the transaction's primary restriction mosaic relation. Position 1, when
		# present on a Global restriction, is its reference mosaic relation.
		transaction = _address_transaction()

		# Act:
		keys = SymbolPuller._collect_dirty_mosaic_restriction_keys_for_batch({
			10: [transaction]
		})

		# Assert:
		self.assertEqual({
			MosaicRestrictionKey(
				MosaicRestrictionEntryType.ADDRESS,
				MOSAIC_ID,
				bytes.fromhex(RECIPIENT_ADDRESS))
		}, keys)

	def test_collector_rejects_an_unresolved_mosaic_with_field_and_context(self):
		# Arrange:
		transaction = _global_transaction('E74B99BA41F4AFEE')

		# Act + Assert:
		with self.assertRaisesRegex(ValueError, 'mosaic_id.*Mosaic Restriction'):
			SymbolPuller._collect_dirty_mosaic_restriction_keys_for_batch({11: [transaction]})

	def test_collector_rejects_invalid_mosaic_text_with_field_and_context(self):
		# Act + Assert:
		with self.assertRaisesRegex(ValueError, 'mosaic_id.*Mosaic Restriction'):
			SymbolPuller._collect_dirty_mosaic_restriction_keys_for_batch({11: [_global_transaction('not-hex')]})

	def test_collector_rejects_multiple_primary_restriction_mosaic_relations(self):
		# Arrange:
		# Position 0 is the transaction's primary restriction mosaic relation. Position 1, when
		# present on a Global restriction, is its reference mosaic relation.
		transaction = _global_transaction()
		transaction['mosaic_rows'].append({'mosaic_id': MOSAIC_ID, 'role': 'restriction', 'position': 0})

		# Act + Assert:
		with self.assertRaisesRegex(ValueError, 'restriction mosaic relation'):
			SymbolPuller._collect_dirty_mosaic_restriction_keys_for_batch({11: [transaction]})


class PullerMosaicRestrictionsIntegrationTest(SymbolPullerTestBase):
	def _fetch_response(self, response, path, key=None):
		# Arrange:
		key = key or MosaicRestrictionKey(MosaicRestrictionEntryType.GLOBAL, MOSAIC_ID, None)
		connector = RestrictionResponseConnector(0, {}, restriction_responses={path: response})
		set_symbol_connector(self.puller, connector)

		# Act:
		entries = asyncio.run(self.puller._fetch_dirty_mosaic_restrictions([key], 20))
		return entries, connector

	def _assert_exact_fetch_rejects(self, response, path, expected_error):
		# Arrange:
		key = MosaicRestrictionKey(MosaicRestrictionEntryType.GLOBAL, MOSAIC_ID, None)

		# Act + Assert:
		with self.assertRaisesRegex(ValueError, expected_error):
			self._fetch_response(response, path, key)

	def test_exact_fetch_builds_global_path_and_returns_empty_replacement(self):
		# Arrange:
		key = MosaicRestrictionKey(MosaicRestrictionEntryType.GLOBAL, MOSAIC_ID, None)

		# Act:
		entries, connector = self._fetch_response(
			{'pagination': {'pageNumber': 1, 'pageSize': 100}, 'data': []}, GLOBAL_RESTRICTION_PATH, key)

		# Assert:
		self.assertEqual([GLOBAL_RESTRICTION_PATH], connector.paths)
		self.assertEqual([{'key': key, 'rows': []}], entries)

	def test_exact_fetch_builds_address_path_with_base32_target(self):
		# Arrange:
		target_address = bytes.fromhex(RECIPIENT_ADDRESS)
		key = MosaicRestrictionKey(MosaicRestrictionEntryType.ADDRESS, MOSAIC_ID, target_address)

		# Act:
		entries, connector = self._fetch_response(
			{'pagination': {'pageNumber': 1, 'pageSize': 100}, 'data': []}, ADDRESS_RESTRICTION_PATH, key)

		# Assert:
		self.assertEqual([ADDRESS_RESTRICTION_PATH], connector.paths)
		self.assertEqual([{'key': key, 'rows': []}], entries)

	def test_exact_fetch_rejects_boolean_page_number(self):
		# Arrange:
		key = MosaicRestrictionKey(MosaicRestrictionEntryType.GLOBAL, MOSAIC_ID, None)

		# Act + Assert:
		with self.assertRaisesRegex(ValueError, 'pagination'):
			self._fetch_response(
				{'pagination': {'pageNumber': True, 'pageSize': 100}, 'data': []}, GLOBAL_RESTRICTION_PATH, key)

	def test_exact_fetch_rejects_non_dict_response(self):
		self._assert_exact_fetch_rejects([], GLOBAL_RESTRICTION_PATH, 'Malformed')

	def test_exact_fetch_rejects_missing_pagination(self):
		self._assert_exact_fetch_rejects({'data': []}, GLOBAL_RESTRICTION_PATH, 'Malformed')

	def test_exact_fetch_rejects_non_dict_pagination(self):
		self._assert_exact_fetch_rejects({'pagination': [], 'data': []}, GLOBAL_RESTRICTION_PATH, 'Malformed')

	def test_exact_fetch_rejects_missing_page_number(self):
		self._assert_exact_fetch_rejects(
			{'pagination': {'pageSize': 100}, 'data': []}, GLOBAL_RESTRICTION_PATH, 'pagination')

	def test_exact_fetch_rejects_missing_page_size(self):
		self._assert_exact_fetch_rejects(
			{'pagination': {'pageNumber': 1}, 'data': []}, GLOBAL_RESTRICTION_PATH, 'pagination')

	def test_exact_fetch_rejects_boolean_page_size(self):
		self._assert_exact_fetch_rejects(
			{'pagination': {'pageNumber': 1, 'pageSize': True}, 'data': []}, GLOBAL_RESTRICTION_PATH, 'pagination')

	def test_exact_fetch_rejects_string_page_number(self):
		self._assert_exact_fetch_rejects(
			{'pagination': {'pageNumber': '1', 'pageSize': 100}, 'data': []}, GLOBAL_RESTRICTION_PATH, 'pagination')

	def test_exact_fetch_rejects_string_page_size(self):
		self._assert_exact_fetch_rejects(
			{'pagination': {'pageNumber': 1, 'pageSize': '100'}, 'data': []}, GLOBAL_RESTRICTION_PATH, 'pagination')

	def test_exact_fetch_rejects_wrong_page_number(self):
		self._assert_exact_fetch_rejects(
			{'pagination': {'pageNumber': 2, 'pageSize': 100}, 'data': []}, GLOBAL_RESTRICTION_PATH, 'pagination')

	def test_exact_fetch_rejects_wrong_page_size(self):
		self._assert_exact_fetch_rejects(
			{'pagination': {'pageNumber': 1, 'pageSize': 99}, 'data': []}, GLOBAL_RESTRICTION_PATH, 'pagination')

	def test_exact_fetch_rejects_non_list_data(self):
		self._assert_exact_fetch_rejects(
			{'pagination': {'pageNumber': 1, 'pageSize': 100}, 'data': {}}, GLOBAL_RESTRICTION_PATH, 'data')

	def test_exact_fetch_rejects_multiple_entries_before_model_conversion(self):
		# Arrange:
		key = MosaicRestrictionKey(MosaicRestrictionEntryType.GLOBAL, MOSAIC_ID, None)

		# Act + Assert:
		with self.assertRaisesRegex(ValueError, 'multiple entries'):
			self._fetch_response(
				{'pagination': {'pageNumber': 1, 'pageSize': 100}, 'data': [{}, {}]}, GLOBAL_RESTRICTION_PATH, key)

	def test_exact_fetch_returns_one_valid_replacement_row(self):
		# Arrange:
		response = {
			'pagination': {'pageNumber': 1, 'pageSize': 100, 'totalEntries': 1},
			'data': [_global_response_item()]
		}
		key = MosaicRestrictionKey(MosaicRestrictionEntryType.GLOBAL, MOSAIC_ID, None)

		# Act:
		entries, _ = self._fetch_response(response, GLOBAL_RESTRICTION_PATH, key)

		# Assert:
		self.assertEqual(key, entries[0]['key'])
		self.assertEqual(1, len(entries[0]['rows']))
		self.assertEqual(20, entries[0]['rows'][0]['updated_at_height'])
		self.assertEqual([], entries[0]['rows'][0]['restrictions'])

	def test_exact_fetch_returns_one_address_replacement_row(self):
		# Arrange:
		key = MosaicRestrictionKey(MosaicRestrictionEntryType.ADDRESS, MOSAIC_ID, bytes.fromhex(RECIPIENT_ADDRESS))

		# Act:
		entries, _ = self._fetch_response(
			{'pagination': {'pageNumber': 1, 'pageSize': 100}, 'data': [_address_response_item()]},
			ADDRESS_RESTRICTION_PATH,
			key)

		# Assert:
		self.assertEqual(key, entries[0]['key'])
		self.assertEqual(bytes.fromhex(RECIPIENT_ADDRESS), entries[0]['rows'][0]['target_address'])

	def test_exact_fetch_rejects_mismatched_logical_key(self):
		self._assert_exact_fetch_rejects({
			'pagination': {'pageNumber': 1, 'pageSize': 100},
			'data': [_global_response_item('6B66D046670F91BE')]}, GLOBAL_RESTRICTION_PATH, 'does not match')


class RestrictionResponseConnector(FakeConnector):
	def __init__(self, *args, restriction_responses=None, **kwargs):
		super().__init__(*args, **kwargs)
		self.restriction_responses = restriction_responses or {}

	async def get(self, url_path, *args):
		if url_path.startswith('restrictions/mosaic?'):
			self.paths.append(url_path)
			response = self.restriction_responses[url_path]
			if isinstance(response, Exception):
				raise response
			return response

		return await super().get(url_path, *args)


class PullerMosaicRestrictionsSyncIntegrationTest(SymbolPullerTestBase):
	@staticmethod
	def _restriction_response(
		entry_type=0,
		target_address=RECIPIENT_ADDRESS,
		composite_hash='AA' * 32,
		mosaic_id=MOSAIC_ID
	):
		entry = {
			'version': 1,
			'compositeHash': composite_hash,
			'entryType': entry_type,
			'mosaicId': mosaic_id
		}
		if entry_type == 0:
			entry.update({'targetAddress': target_address, 'restrictions': [{'key': '1', 'value': '2'}]})
		else:
			entry['restrictions'] = [{
				'key': '1',
				'restriction': {
					'referenceMosaicId': '0000000000000000',
					'restrictionValue': '2',
					'restrictionType': 1
				}
			}]
		return {'pagination': {'pageNumber': 1, 'pageSize': 100}, 'data': [{
			'id': 'BB' * 12,
			'mosaicRestrictionEntry': entry
		}]}

	@staticmethod
	def _restriction_transaction(
		height=1,
		entry_type=TransactionType.MOSAIC_ADDRESS_RESTRICTION.value,
		mosaic_id=MOSAIC_ID,
		target_address=RECIPIENT_ADDRESS,
		reference_mosaic_id='0000000000000000'
	):
		overrides = {'type': entry_type, 'mosaicId': mosaic_id}
		if entry_type == TransactionType.MOSAIC_ADDRESS_RESTRICTION.value:
			overrides['targetAddress'] = target_address
		else:
			overrides['referenceMosaicId'] = reference_mosaic_id
		return create_node_transaction(height, transaction_hash='A' * 64, transaction_id='restriction-transaction', **overrides)

	def _create_normal_connector(self, response):
		path = _restriction_path(0, RECIPIENT_ADDRESS)
		return RestrictionResponseConnector(
			1,
			{0: [create_node_block(1)]},
			transactions_by_path={transaction_path(1, 1): {'data': [self._restriction_transaction()]}},
			restriction_responses={path: response})

	@staticmethod
	def _create_alias_connector(transaction, response_path, response, address_resolutions=None, mosaic_resolutions=None):
		return RestrictionResponseConnector(
			1,
			{0: [create_node_block(1)]},
			transactions_by_path={transaction_path(1, 1): {'data': [transaction]}},
			address_resolutions_by_height=address_resolutions or {},
			mosaic_resolutions_by_height=mosaic_resolutions or {},
			restriction_responses={response_path: response})

	def _create_address_restriction_alias_connector(self, restriction_response):
		transaction = self._restriction_transaction(
			height=2, mosaic_id=ALIAS_MOSAIC_ID, target_address=ALIAS_ADDRESS)
		expected_path = _restriction_path(0, RECIPIENT_ADDRESS, MOSAIC_ID)
		connector = RestrictionResponseConnector(
			2,
			{0: [create_node_block(1), create_node_block(2)]},
			transactions_by_path={transaction_path(1, 2): {'data': [transaction]}},
			address_resolutions_by_height={2: [create_resolution_statement(
				2, ALIAS_ADDRESS, [_resolution_entry(1, 0, RECIPIENT_ADDRESS)])]},
			mosaic_resolutions_by_height={2: [create_resolution_statement(
				2, ALIAS_MOSAIC_ID, [_resolution_entry(1, 0, MOSAIC_ID)])]},
			restriction_responses={expected_path: restriction_response})
		return connector, expected_path

	def _seed_complete_batch_state(self):
		database = self.puller.symbol_db
		self._seed_blocks(database, [1], {1: 'FF' * 32})
		database.upsert_transactions_for_height(1, [create_transaction_entry(
			1,
			key='existing-transaction',
			mosaic_rows=[{'mosaic_id': MOSAIC_ID, 'amount': 999, 'role': 'transfer', 'position': 0}],
			address_rows=[{'address': bytes.fromhex(SIGNER_ADDRESS), 'role': 'recipient'}]
		)])
		database.upsert_receipts_for_height(1, create_receipt_rows(create_amount_statement_item(1, 999)), 999)
		account_row, account_mosaic_rows = create_account_row(
			create_account_item(SIGNER_ADDRESS, importance='999'),
			self.puller.symbol_facade.network,
			1,
			MOSAIC_ID,
			6)
		account_row['is_harvesting_active'] = True
		database.upsert_account_current_state(account_row, account_mosaic_rows)
		database.upsert_multisig(bytes.fromhex(SIGNER_ADDRESS), {
			'address': bytes.fromhex(SIGNER_ADDRESS),
			'min_approval': 2,
			'min_removal': 1,
			'cosignatory_addresses': [bytes.fromhex('98' + '11' * 23)],
			'multisig_addresses': [bytes.fromhex('98' + '22' * 23)],
			'updated_at_height': 1
		})
		seed_namespace(
			database,
			create_namespace_item(owner_address=SIGNER_ADDRESS),
			{NAMESPACE_ROOT_ID: 'existing-root'},
			1)
		database.upsert_mosaic(create_expected_mosaic_row(create_mosaic_item(supply='999'), 1))
		metadata_item = create_metadata_item(
			metadata_type=1, target_id=MOSAIC_ID, value='6578697374696E67')
		database.upsert_metadata(create_expected_metadata_row(
			metadata_item,
			1,
			bytes.fromhex('11' * 32),
			'mosaic',
			MOSAIC_ID,
			'existing',
			value_hex='6578697374696E67'))
		database.upsert_hash_lock(create_hash_lock_row({
			'lock': {
				'hash': 'DD' * 32,
				'ownerAddress': SIGNER_ADDRESS,
				'mosaicId': MOSAIC_ID,
				'amount': '1',
				'endHeight': '100',
				'status': 0
			},
			'id': 'existing-hash-lock'
		}, 1))
		secret_item = create_secret_lock_item(
			owner_address=SIGNER_ADDRESS,
			recipient_address=RECIPIENT_ADDRESS,
			composite_hash='EE' * 32)
		secret_key = create_secret_lock_search_key(
			bytes.fromhex(SIGNER_ADDRESS), bytes.fromhex(RECIPIENT_ADDRESS), bytes.fromhex('CC' * 32), 'hash160')
		database.replace_secret_locks(secret_key, [create_secret_lock_row(secret_item, 1)])
		restriction_key = MosaicRestrictionKey(
			MosaicRestrictionEntryType.ADDRESS, MOSAIC_ID, bytes.fromhex(RECIPIENT_ADDRESS))
		database.replace_mosaic_restrictions(
			restriction_key,
			[create_mosaic_restriction_row(self._restriction_response()['data'][0], 1)])
		database.upsert_sync_state(create_sync_state(
			chain_height=0,
			finalized_height=0,
			finalized_hash=b'',
			finalized_epoch=0,
			finalized_point=0,
			last_synced_height=0,
			last_synced_block_hash=b''))

	def _assert_sync_failure_has_no_write_state(self, connector, exception_type, expected_error):
		# Arrange:
		tables = (
			'symbol_blocks',
			'symbol_transactions',
			'symbol_transaction_mosaics',
			'symbol_transaction_addresses',
			'symbol_mosaic_restrictions'
		)

		# Act / Assert:
		with self.assertRaisesRegex(exception_type, expected_error):
			self._sync_with_connector(connector)

		# Assert:
		self.assertEqual([], _restriction_paths(connector))
		cursor = self.puller.symbol_db.connection.cursor()
		for table in tables:
			cursor.execute(f'SELECT COUNT(*) FROM {table}')
			self.assertEqual(0, cursor.fetchone()[0], table)
		self.assertIsNone(self.puller.symbol_db.get_sync_state())

	def test_sync_block_headers_persists_restriction_state(self):
		# Arrange:
		connector = self._create_normal_connector(self._restriction_response())

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		cursor = self.puller.symbol_db.connection.cursor()
		cursor.execute(
			'SELECT entry_type, mosaic_id, target_address, restrictions, updated_at_height '
			'FROM symbol_mosaic_restrictions')
		self.assertEqual([('address', MOSAIC_ID, bytes.fromhex(RECIPIENT_ADDRESS), [{'key': '1', 'value': '2'}], 1)], [
			(entry_type, mosaic_id, bytes(target_address), restrictions, updated_at_height)
			for entry_type, mosaic_id, target_address, restrictions, updated_at_height in cursor.fetchall()
		])
		self.assertEqual([_restriction_path(0, RECIPIENT_ADDRESS)], _restriction_paths(connector))

	def test_sync_block_headers_restriction_fetch_failure_preserves_complete_batch_state(self):
		# Arrange:
		database = self.puller.symbol_db
		self._seed_complete_batch_state()
		before_state = self._fetch_complete_batch_state()
		before_sync_state = database.get_sync_state()
		connector = self._create_normal_connector(RuntimeError('restriction fetch failed'))

		# Act + Assert:
		with self.assertRaisesRegex(RuntimeError, 'restriction fetch failed'):
			self._sync_with_connector(connector)

		# Assert:
		self.assertEqual(before_state, self._fetch_complete_batch_state())
		self.assertEqual(before_sync_state, database.get_sync_state())

	def test_sync_block_headers_restriction_resource_not_found_does_not_delete_existing_row(self):
		# Arrange:
		key = MosaicRestrictionKey(MosaicRestrictionEntryType.ADDRESS, MOSAIC_ID, bytes.fromhex(RECIPIENT_ADDRESS))
		row = create_mosaic_restriction_row(self._restriction_response()['data'][0], 1)
		self.puller.symbol_db.replace_mosaic_restrictions(key, [row])
		connector = self._create_normal_connector({
			'code': 'ResourceNotFound', 'message': 'missing'})
		before_state = self._fetch_table_state(('symbol_mosaic_restrictions',))

		# Act / Assert:
		with self.assertRaisesRegex(NodeException, 'ResourceNotFound: missing'):
			self._sync_with_connector(connector)

		# Assert:
		self.assertEqual(before_state, self._fetch_table_state(('symbol_mosaic_restrictions',)))
		self.assertEqual([], self._fetch_block_heights(self.puller.symbol_db))

	def test_sync_block_headers_restriction_state_converges_when_restarted(self):
		# Arrange:
		connector = self._create_normal_connector(self._restriction_response())
		self._sync_with_connector(connector)
		cursor = self.puller.symbol_db.connection.cursor()
		cursor.execute('SELECT composite_hash, updated_at_height FROM symbol_mosaic_restrictions')
		first_state = cursor.fetchall()
		cursor.execute('DELETE FROM symbol_sync_state')
		self.puller.symbol_db.connection.commit()

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		cursor.execute('SELECT composite_hash, updated_at_height FROM symbol_mosaic_restrictions')
		self.assertEqual(first_state, cursor.fetchall())

	def test_sync_block_headers_persists_resolved_child_relations_for_address_restriction_aliases(self):
		# Arrange:
		normal_connector, expected_path = self._create_address_restriction_alias_connector(
			self._restriction_response(0, RECIPIENT_ADDRESS, mosaic_id=MOSAIC_ID))

		# Act:
		self._sync_with_connector(normal_connector)

		# Assert:
		cursor = self.puller.symbol_db.connection.cursor()
		cursor.execute(
			"SELECT body->>'mosaicId', body->>'targetAddress', encode(target_address, 'hex') "
			'FROM symbol_transactions WHERE height = 2')
		self.assertEqual([(
			ALIAS_MOSAIC_ID, ALIAS_ADDRESS, RECIPIENT_ADDRESS.lower())], cursor.fetchall())
		cursor.execute(
			'SELECT mosaic_id, position FROM symbol_transaction_mosaics '
			'WHERE height = 2 AND role = %s',
			('restriction',))
		self.assertEqual([(MOSAIC_ID, 0)], cursor.fetchall())
		self.assertEqual([expected_path], _restriction_paths(normal_connector))

	def test_rollback_uses_persisted_resolved_child_relations_for_address_restriction_aliases(self):
		# Arrange: persist the transaction and resolved child relations on the branch that will become orphaned.
		normal_connector, expected_path = self._create_address_restriction_alias_connector({
			'pagination': {
				'pageNumber': 1,
				'pageSize': 100
			},
			'data': []
		})
		self._sync_with_connector(normal_connector)

		# _repair_from_height reads the orphaned branch's resolved child relations before
		# repair_rollback_from_height performs destructive database updates.
		canonical_block_hash = '22' * 32
		rollback_connector = RestrictionResponseConnector(
			3,
			{1: [
				create_node_block(2, block_hash=canonical_block_hash),
				create_node_block(3, previous_hash=canonical_block_hash)
			]},
			block_by_height={2: create_node_block(2, block_hash=canonical_block_hash)},
			transactions_by_path={transaction_path(2, 3): {
				'data': [create_node_transaction(2, type=TransactionType.TRANSFER.value)]}},
			restriction_responses={expected_path: self._restriction_response(
				0, RECIPIENT_ADDRESS, composite_hash='CC' * 32, mosaic_id=MOSAIC_ID)})

		# Act:
		self._sync_with_connector(rollback_connector)

		# Assert:
		self.assertEqual([expected_path], _restriction_paths(rollback_connector))
		cursor = self.puller.symbol_db.connection.cursor()
		cursor.execute(
			' SELECT composite_hash, updated_at_height FROM symbol_mosaic_restrictions')
		self.assertEqual([(bytes.fromhex('CC' * 32), 1)], [
			(bytes(composite_hash), updated_at_height)
			for composite_hash, updated_at_height in cursor.fetchall()
		])
		cursor.execute(
			"SELECT type, body->>'mosaicId' FROM symbol_transactions WHERE height = 2")
		self.assertEqual([(TransactionType.TRANSFER.value, None)], cursor.fetchall())
		cursor.execute(
			'SELECT COUNT(*) FROM symbol_transaction_mosaics '
			'WHERE height = 2 AND role = %s',
			('restriction',))
		self.assertEqual(0, cursor.fetchone()[0])
		sync_state = self.puller.symbol_db.get_sync_state()
		self.assertEqual('healthy', sync_state['status'])
		self.assertEqual(3, sync_state['last_synced_height'])
		self.assertEqual(bytes.fromhex(f'{3:064X}'), bytes(sync_state['last_synced_block_hash']))

	def test_sync_block_headers_uses_only_global_primary_restriction_mosaic_when_both_aliases_resolve(self):
		# Arrange:
		# Position 0 is the transaction's primary restriction mosaic relation; position 1 is
		# the Global restriction's reference mosaic relation and must not trigger a state fetch.
		transaction = self._restriction_transaction(
			entry_type=TransactionType.MOSAIC_GLOBAL_RESTRICTION.value,
			mosaic_id=ALIAS_MOSAIC_ID,
			reference_mosaic_id=ALIAS_MOSAIC_ID_2)
		path = _restriction_path(1, mosaic_id=MOSAIC_ID)
		connector = self._create_alias_connector(
			transaction,
			path,
			self._restriction_response(1, None, mosaic_id=MOSAIC_ID),
			mosaic_resolutions={1: [
				create_resolution_statement(1, ALIAS_MOSAIC_ID, [_resolution_entry(1, 0, MOSAIC_ID)]),
				create_resolution_statement(1, ALIAS_MOSAIC_ID_2, [_resolution_entry(1, 0, RESOLVED_MOSAIC_ID_2)])
			]})

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		cursor = self.puller.symbol_db.connection.cursor()
		cursor.execute(
			"SELECT mosaic_id, position FROM symbol_transaction_mosaics WHERE role = 'restriction' ORDER BY position")
		self.assertEqual([(MOSAIC_ID, 0), (RESOLVED_MOSAIC_ID_2, 1)], cursor.fetchall())
		self.assertEqual([path], _restriction_paths(connector))

	def test_sync_block_headers_omits_global_zero_reference_and_fetches_primary_restriction_mosaic(self):
		# Arrange:
		# Position 0 is the transaction's primary restriction mosaic relation; position 1 is
		# the optional Global reference mosaic relation, omitted here because it is zero.
		transaction = self._restriction_transaction(
			entry_type=TransactionType.MOSAIC_GLOBAL_RESTRICTION.value,
			mosaic_id=ALIAS_MOSAIC_ID)
		path = _restriction_path(1, mosaic_id=MOSAIC_ID)
		connector = self._create_alias_connector(
			transaction,
			path,
			self._restriction_response(1, None, mosaic_id=MOSAIC_ID),
			mosaic_resolutions={1: [create_resolution_statement(
				1, ALIAS_MOSAIC_ID, [_resolution_entry(1, 0, MOSAIC_ID)])]})

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		cursor = self.puller.symbol_db.connection.cursor()
		cursor.execute("SELECT mosaic_id, position FROM symbol_transaction_mosaics WHERE role = 'restriction'")
		self.assertEqual([(MOSAIC_ID, 0)], cursor.fetchall())
		self.assertEqual([path], _restriction_paths(connector))

	def test_sync_block_headers_rejects_missing_mosaic_resolution_before_restriction_fetch(self):
		# Arrange:
		transaction = self._restriction_transaction(
			entry_type=TransactionType.MOSAIC_GLOBAL_RESTRICTION.value, mosaic_id=ALIAS_MOSAIC_ID)
		connector = self._create_alias_connector(transaction, '', None)

		# Act + Assert:
		self._assert_sync_failure_has_no_write_state(
			connector, ValueError, f'Missing Symbol mosaic resolution.*{ALIAS_MOSAIC_ID}')

	def test_sync_block_headers_rejects_mosaic_resolution_entry_after_transaction_source_before_restriction_fetch(self):
		# Arrange: transaction source primaryId is 1, but the resolution entry primaryId is 2,
		# so the entry cannot apply to this transaction.
		transaction = self._restriction_transaction(
			entry_type=TransactionType.MOSAIC_GLOBAL_RESTRICTION.value, mosaic_id=ALIAS_MOSAIC_ID)
		connector = self._create_alias_connector(
			transaction,
			'',
			None,
			mosaic_resolutions={1: [create_resolution_statement(
				1, ALIAS_MOSAIC_ID, [_resolution_entry(2, 0, MOSAIC_ID)])]})

		# Act + Assert:
		self._assert_sync_failure_has_no_write_state(
			connector, ValueError, f'Missing Symbol mosaic resolution entry.*{ALIAS_MOSAIC_ID}')

	def test_sync_block_headers_rejects_missing_address_resolution_before_restriction_fetch(self):
		# Arrange:
		transaction = self._restriction_transaction(mosaic_id=MOSAIC_ID, target_address=ALIAS_ADDRESS)
		connector = self._create_alias_connector(transaction, '', None)

		# Act + Assert:
		self._assert_sync_failure_has_no_write_state(
			connector, ValueError, f'Missing Symbol address resolution.*{ALIAS_ADDRESS}')

	def test_sync_block_headers_rejects_address_resolution_entry_after_transaction_source_before_restriction_fetch(self):
		# Arrange: transaction source primaryId is 1, but the resolution entry primaryId is 2,
		# so the entry cannot apply to this transaction.
		transaction = self._restriction_transaction(mosaic_id=MOSAIC_ID, target_address=ALIAS_ADDRESS)
		connector = self._create_alias_connector(
			transaction,
			'',
			None,
			address_resolutions={1: [create_resolution_statement(
				1, ALIAS_ADDRESS, [_resolution_entry(2, 0, RECIPIENT_ADDRESS)])]})

		# Act + Assert:
		self._assert_sync_failure_has_no_write_state(
			connector, ValueError, f'Missing Symbol address resolution entry.*{ALIAS_ADDRESS}')

	def test_sync_block_headers_rejects_alias_surviving_mosaic_resolution_before_restriction_fetch(self):
		# Arrange:
		transaction = self._restriction_transaction(
			entry_type=TransactionType.MOSAIC_GLOBAL_RESTRICTION.value, mosaic_id=ALIAS_MOSAIC_ID)
		connector = self._create_alias_connector(
			transaction,
			'',
			None,
			mosaic_resolutions={1: [create_resolution_statement(
				1, ALIAS_MOSAIC_ID, [_resolution_entry(1, 0, ALIAS_MOSAIC_ID_2)])]})

		self._assert_sync_failure_has_no_write_state(connector, ValueError, 'mosaic_id.*Mosaic Restriction')

	def _seed_rollback_restriction_state(self, current_row=False, transaction_row=True, sibling=False):
		self._seed_blocks(self.puller.symbol_db, [1, 2, 3], {2: b'local mismatch'.hex()})
		self.puller.symbol_db.upsert_sync_state(create_sync_state())
		key = MosaicRestrictionKey(MosaicRestrictionEntryType.GLOBAL, MOSAIC_ID, None)
		if current_row:
			response_row = self._restriction_response(1, None, 'AA' * 32)['data'][0]
			self.puller.symbol_db.replace_mosaic_restrictions(key, [create_mosaic_restriction_row(response_row, 2)])
		if sibling:
			sibling_key = MosaicRestrictionKey(
				MosaicRestrictionEntryType.ADDRESS, MOSAIC_ID, bytes.fromhex('98' + '11' * 23))
			sibling_row = self._restriction_response(0, '98' + '11' * 23, 'DD' * 32)['data'][0]
			self.puller.symbol_db.replace_mosaic_restrictions(
				sibling_key, [create_mosaic_restriction_row(sibling_row, 1)])
		if transaction_row:
			self.puller.symbol_db.upsert_transactions_for_height(2, [create_transaction_entry(
				2,
				'orphan-restriction',
				type=TransactionType.MOSAIC_GLOBAL_RESTRICTION.value,
				target_address=None,
				mosaic_rows=[{'mosaic_id': MOSAIC_ID, 'amount': 0, 'role': 'restriction', 'position': 0}]
			)])
		response_path = _restriction_path(1)
		connector = RestrictionResponseConnector(
			3,
			{1: [create_node_block(2), create_node_block(3)]},
			block_by_height={2: create_node_block(2)},
			transactions_by_path={transaction_path(2, 3): {'data': [create_node_transaction(2, type=TransactionType.TRANSFER.value)]}},
			restriction_responses={response_path: self._restriction_response(1, None, 'CC' * 32)})
		return connector, response_path

	def test_rollback_restores_restriction_from_transaction_derived_key_without_current_row(self):
		# Arrange:
		connector, response_path = self._seed_rollback_restriction_state(current_row=False, transaction_row=True)

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		cursor = self.puller.symbol_db.connection.cursor()
		cursor.execute('SELECT composite_hash, updated_at_height FROM symbol_mosaic_restrictions')
		self.assertEqual([(bytes.fromhex('CC' * 32), 1)], [
			(bytes(composite_hash), updated_at_height)
			for composite_hash, updated_at_height in cursor.fetchall()
		])
		self.assertEqual([response_path], _restriction_paths(connector))

	def test_rollback_refreshes_restriction_from_current_row_without_transaction_source(self):
		# Arrange:
		connector, response_path = self._seed_rollback_restriction_state(current_row=True, transaction_row=False)

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		cursor = self.puller.symbol_db.connection.cursor()
		cursor.execute('SELECT composite_hash, updated_at_height FROM symbol_mosaic_restrictions')
		self.assertEqual([(bytes.fromhex('CC' * 32), 1)], [
			(bytes(composite_hash), updated_at_height) for composite_hash, updated_at_height in cursor.fetchall()
		])
		self.assertEqual([response_path], _restriction_paths(connector))

	def test_rollback_deduplicates_current_and_transaction_restriction_sources(self):
		# Arrange:
		connector, response_path = self._seed_rollback_restriction_state(current_row=True, transaction_row=True)

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		self.assertEqual([response_path], _restriction_paths(connector))

	def test_rollback_replaces_only_affected_restriction_and_preserves_sibling(self):
		# Arrange:
		connector, response_path = self._seed_rollback_restriction_state(
			current_row=True, transaction_row=False, sibling=True)
		connector.restriction_responses[response_path] = {
			'pagination': {'pageNumber': 1, 'pageSize': 100}, 'data': []}

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		cursor = self.puller.symbol_db.connection.cursor()
		cursor.execute('SELECT entry_type, target_address FROM symbol_mosaic_restrictions')
		self.assertEqual([('address', bytes.fromhex('98' + '11' * 23))], [
			(entry_type, bytes(target_address)) for entry_type, target_address in cursor.fetchall()
		])

	def _seed_existing_current_state(self):
		database = self.puller.symbol_db
		account_row, account_mosaic_rows = create_account_row(
			create_account_item(SIGNER_ADDRESS), self.puller.symbol_facade.network, 1, MOSAIC_ID, 6)
		database.upsert_account_current_state(account_row, account_mosaic_rows)
		seed_namespace(
			database,
			create_namespace_item(owner_address=SIGNER_ADDRESS),
			{NAMESPACE_ROOT_ID: 'root'},
			1)
		database.upsert_mosaic(create_expected_mosaic_row(create_mosaic_item(mosaic_id=MOSAIC_ID), 1))
		metadata_item = create_metadata_item(metadata_type=1, target_id=MOSAIC_ID)
		database.upsert_metadata(create_expected_metadata_row(
			metadata_item, 1, bytes.fromhex('11' * 32), 'mosaic', MOSAIC_ID, 'hello'))
		database.upsert_hash_lock(create_hash_lock_row({
			'lock': {
				'hash': 'DD' * 32,
				'ownerAddress': SIGNER_ADDRESS,
				'mosaicId': MOSAIC_ID,
				'amount': '1',
				'endHeight': '100',
				'status': 0
			},
			'id': 'hash-lock'
		}, 1))
		secret_item = create_secret_lock_item(
			owner_address=SIGNER_ADDRESS,
			recipient_address=RECIPIENT_ADDRESS,
			composite_hash='EE' * 32)
		secret_key = create_secret_lock_search_key(
			bytes.fromhex(SIGNER_ADDRESS), bytes.fromhex(RECIPIENT_ADDRESS), bytes.fromhex('CC' * 32), 'hash160')
		database.replace_secret_locks(secret_key, [create_secret_lock_row(secret_item, 1)])

	def test_rollback_restriction_fetch_failure_preserves_state_and_watermark(self):
		# Arrange:
		connector, response_path = self._seed_rollback_restriction_state(current_row=True, transaction_row=True)
		self._seed_existing_current_state()
		connector.restriction_responses[response_path] = RuntimeError('rollback restriction fetch failed')
		before_state = self._fetch_complete_batch_state()

		# Act + Assert:
		with self.assertRaisesRegex(RuntimeError, 'rollback restriction fetch failed'):
			self._sync_with_connector(connector)

		# Assert:
		self.assertEqual([1, 2, 3], self._fetch_block_heights(self.puller.symbol_db))
		self.assertEqual(before_state, self._fetch_complete_batch_state())

"""Lock-specific sync and rollback integration cases normally split across PullerSync and PullerRollback tests."""

# pylint: disable=too-many-lines,too-many-public-methods
import asyncio
import copy

from symbolchain.sc import TransactionType
from symbolchain.symbol.Network import Address

from puller.model.symbol.Account import create_account_row
from puller.model.symbol.Lock import create_hash_lock_key, create_hash_lock_row, create_secret_lock_row, create_secret_lock_search_key
from puller.model.symbol.Receipt import create_receipt_rows
from tests.test.SymbolDatabaseTestUtils import fetch_normalized_sync_state
from tests.test.SymbolLockTestUtils import create_expected_secret_lock_row
from tests.test.SymbolLockTestUtils import create_secret_lock_item as create_secret_lock_item_fixture
from tests.test.SymbolMetadataTestUtils import create_expected_metadata_row, create_metadata_item
from tests.test.SymbolMosaicTestUtils import create_expected_mosaic_row, create_mosaic_item
from tests.test.SymbolNamespaceTestUtils import NAMESPACE_ROOT_ID, create_namespace_item, seed_namespace
from tests.test.SymbolTestConstants import BENEFICIARY_ADDRESS, RECIPIENT_ADDRESS, SIGNER_ADDRESS

from ...test.SymbolTransactionTestUtils import create_transaction_entry
from .puller_test_utils import (
	FakeConnector,
	SymbolPullerTestBase,
	create_account_item,
	create_amount_statement_item,
	create_complete_aggregate_pair,
	create_node_block,
	create_node_transaction,
	create_resolution_statement,
	create_sync_state,
	create_transaction_page,
	resolution_path,
	set_symbol_connector,
	statement_path,
	transaction_path
)

LOCK_HASH = 'AA' * 32
LOCK_HASH_2 = 'BB' * 32
SECRET = 'CC' * 32
COMPOSITE_HASH = 'DD' * 32
COMPOSITE_HASH_2 = 'EE' * 32
MOSAIC_ID = '72C0212E67A08BCE'
ALIAS_ADDRESS = '99065A28385EB5AE88000000000000000000000000000000'
ALIAS_MOSAIC_ID = 'E74B99BA41F4AFEE'


def create_hash_lock_item(lock_hash=LOCK_HASH, **overrides):
	lock = {
		'hash': lock_hash,
		'ownerAddress': SIGNER_ADDRESS,
		'mosaicId': MOSAIC_ID,
		'amount': '1234',
		'endHeight': '100',
		'status': 0
	}
	lock.update(overrides)
	return {'lock': lock, 'id': 'hash-lock'}


def create_secret_lock_item(
	composite_hash=COMPOSITE_HASH,
	owner_address=SIGNER_ADDRESS,
	secret=SECRET,
	**overrides
):
	return create_secret_lock_item_fixture(
		composite_hash=composite_hash,
		owner_address=owner_address,
		recipient_address=overrides.pop('recipientAddress', RECIPIENT_ADDRESS),
		secret=secret,
		hash_algorithm=overrides.pop('hashAlgorithm', 1),
		mosaic_id=overrides.pop('mosaicId', MOSAIC_ID),
		amount=overrides.pop('amount', '1234'),
		end_height=overrides.pop('endHeight', '100'),
		status=overrides.pop('status', 0),
		item_id='secret-lock',
		**overrides)


class LockConnector(FakeConnector):
	def __init__(self, *args, hash_responses=None, secret_responses=None, **kwargs):
		if not args:
			args = (1, {})
		super().__init__(*args, **kwargs)
		self.hash_responses = hash_responses or {}
		self.secret_responses = secret_responses or {}

	async def get(self, url_path, *args):
		if url_path.startswith('lock/hash/'):
			self.paths.append(url_path)
			response = self.hash_responses[url_path]
			if isinstance(response, Exception):
				raise response
			return response
		if url_path.startswith('lock/secret?'):
			self.paths.append(url_path)
			response = self.secret_responses.get(url_path, {'data': []})
			if isinstance(response, Exception):
				raise response
			return response

		return await super().get(url_path, *args)


class BoundedLockConnector(LockConnector):
	def __init__(self, lock_path_prefix, *args, **kwargs):
		super().__init__(*args, **kwargs)
		self.lock_path_prefix = lock_path_prefix
		self.in_flight_lock_requests = 0
		self.max_in_flight_lock_requests = 0
		self._requests_released = asyncio.Event()
		self._release_scheduled = False

	async def get(self, url_path, *args):
		if not url_path.startswith(self.lock_path_prefix):
			return await super().get(url_path, *args)

		self.in_flight_lock_requests += 1
		self.max_in_flight_lock_requests = max(
			self.max_in_flight_lock_requests,
			self.in_flight_lock_requests)
		try:
			if not self._release_scheduled:
				self._release_scheduled = True
				asyncio.get_running_loop().call_soon(self._requests_released.set)
			await self._requests_released.wait()
			return await super().get(url_path, *args)
		finally:
			self.in_flight_lock_requests -= 1


def _secret_search_path(owner_address, secret, page_number=1):
	return (
		f'lock/secret?address={Address(bytes.fromhex(owner_address))}&secret={secret}'
		f'&pageSize=100&pageNumber={page_number}'
	)


def _secret_only_search_path(secret, page_number=1):
	return f'lock/secret?secret={secret}&pageSize=100&pageNumber={page_number}'


def _resolution_entry(primary_id, secondary_id, resolved):
	return {'source': {'primaryId': primary_id, 'secondaryId': secondary_id}, 'resolved': resolved}


class SymbolPullerLocksTest(SymbolPullerTestBase):
	@staticmethod
	def _create_lock_transaction_row(transaction_type, body, **overrides):
		row = {
			'type': transaction_type,
			'is_embedded': False,
			'hash': bytes.fromhex(LOCK_HASH),
			'signer_address': bytes.fromhex(SIGNER_ADDRESS),
			'recipient_address': bytes.fromhex(RECIPIENT_ADDRESS),
			'body': body
		}
		row.update(overrides)
		return row

	def _collect_lock_keys(self, transaction_rows):
		return self.puller._collect_dirty_lock_keys_for_batch(  # pylint: disable=protected-access
			{10: transaction_rows})

	def _seed_complete_batch_state(self):
		database = self.puller.symbol_db
		self._seed_blocks(database, [1], {1: 'FF' * 32})
		database.upsert_transactions_for_height(1, [create_transaction_entry(
			1,
			'decoy',
			mosaic_rows=[{'mosaic_id': MOSAIC_ID, 'amount': 999, 'role': 'transfer', 'position': 0}],
			address_rows=[{'address': bytes.fromhex(BENEFICIARY_ADDRESS), 'role': 'recipient'}]
		)])
		database.upsert_receipts_for_height(
			1,
			create_receipt_rows(create_amount_statement_item(1, 999)),
			999)
		account_row, account_mosaic_rows = create_account_row(
			create_account_item(BENEFICIARY_ADDRESS, importance='999'),
			self.puller.symbol_facade.network,
			1,
			MOSAIC_ID,
			6)
		account_row['is_harvesting_active'] = True
		database.upsert_account_current_state(account_row, account_mosaic_rows)
		database.upsert_multisig(bytes.fromhex(BENEFICIARY_ADDRESS), {
			'address': bytes.fromhex(BENEFICIARY_ADDRESS),
			'min_approval': 2,
			'min_removal': 1,
			'cosignatory_addresses': [bytes.fromhex('98' + '11' * 23)],
			'multisig_addresses': [bytes.fromhex('98' + '22' * 23)],
			'updated_at_height': 1
		})
		namespace_item = create_namespace_item(owner_address=SIGNER_ADDRESS)
		seed_namespace(database, namespace_item, {NAMESPACE_ROOT_ID: 'decoy'}, 1)
		database.upsert_mosaic(create_expected_mosaic_row(create_mosaic_item(supply='999'), 1))
		metadata_item = create_metadata_item(metadata_type=1, target_id=MOSAIC_ID)
		database.upsert_metadata(create_expected_metadata_row(
			metadata_item, 1, bytes.fromhex('11' * 32), 'mosaic', MOSAIC_ID, 'hello'))
		database.upsert_hash_lock(create_hash_lock_row(create_hash_lock_item(status=1), 1))
		secret_key = create_secret_lock_search_key(
			bytes.fromhex(SIGNER_ADDRESS), bytes.fromhex(RECIPIENT_ADDRESS), bytes.fromhex(SECRET), 'hash160')
		database.replace_secret_locks(
			secret_key,
			[create_secret_lock_row(create_secret_lock_item(status=1), 1)])
		database.upsert_sync_state(create_sync_state(
			chain_height=0,
			finalized_height=0,
			finalized_hash=b'',
			finalized_epoch=0,
			finalized_point=0,
			last_synced_height=0,
			last_synced_block_hash=b''))

	def _seed_rollback_batch_state(self):
		self._seed_blocks(self.puller.symbol_db, [1, 2], {2: b'local mismatch'.hex()})
		self.puller.symbol_db.upsert_sync_state(create_sync_state(
			chain_height=2,
			last_synced_height=2,
			last_synced_block_hash=bytes.fromhex('02' * 32)))
		namespace_item = create_namespace_item(owner_address=SIGNER_ADDRESS)
		seed_namespace(self.puller.symbol_db, namespace_item, {NAMESPACE_ROOT_ID: 'original'}, 1)
		self.puller.symbol_db.upsert_mosaic(create_expected_mosaic_row(create_mosaic_item(supply='1234'), 1))
		metadata_item = create_metadata_item(metadata_type=1, target_id=MOSAIC_ID)
		self.puller.symbol_db.upsert_metadata(create_expected_metadata_row(
			metadata_item, 1, bytes.fromhex('11' * 32), 'mosaic', MOSAIC_ID, 'hello'))
		self.puller.symbol_db.upsert_hash_lock(create_hash_lock_row(create_hash_lock_item(status=1), 2))
		secret_key = create_secret_lock_search_key(
			bytes.fromhex(SIGNER_ADDRESS), bytes.fromhex(RECIPIENT_ADDRESS), bytes.fromhex(SECRET), 'hash160')
		self.puller.symbol_db.replace_secret_locks(
			secret_key, [create_secret_lock_row(create_secret_lock_item(status=1), 2)])

	def _assert_sync_failure_preserves_complete_batch_state(self, connector, exception_type, error):
		# Arrange:
		self._seed_complete_batch_state()
		expected_state = self._fetch_complete_batch_state()

		# Act / Assert:
		with self.assertRaisesRegex(exception_type, error):
			self._sync_with_connector(connector)

		# Assert:
		self.assertEqual(expected_state, self._fetch_complete_batch_state())

	def _fetch_lock_alias_failure_state(self):
		cursor = self.puller.symbol_db.connection.cursor()
		state = {}
		for table_name in (
			'symbol_blocks',
			'symbol_transactions',
			'symbol_receipts',
			'symbol_hash_locks',
			'symbol_secret_locks',
			'symbol_sync_state'
		):
			cursor.execute(f'SELECT COUNT(*) FROM {table_name}')
			state[table_name] = cursor.fetchone()[0]

		return state

	def _assert_sync_persists_secret_lock_transaction(
		self,
		transactions,
		transactions_count,
		total_transactions_count,
		expected
	):
		# Arrange:
		lock_item = create_secret_lock_item(owner_address=expected['owner_address'])
		block = create_node_block(
			1,
			transactions_count=transactions_count,
			total_transactions_count=total_transactions_count)
		connector = LockConnector(
			1,
			{0: [block]},
			secret_responses={expected['lock_path']: {'data': [lock_item]}},
			transactions_by_path={transaction_path(1, 1): create_transaction_page(transactions)},
			statement_pages={statement_path(1, 1): {'data': []}},
			address_resolutions_by_height=expected.get('address_resolutions_by_height', {}),
			mosaic_resolutions_by_height=expected.get('mosaic_resolutions_by_height', {}))
		expected_row = create_expected_secret_lock_row(
			lock_item,
			1,
			bytes.fromhex(COMPOSITE_HASH),
			bytes.fromhex(expected['owner_address']),
			bytes.fromhex(RECIPIENT_ADDRESS),
			bytes.fromhex(SECRET),
			'hash160',
			MOSAIC_ID,
			1234,
			100,
			'unused')

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		self.assertEqual(([], [expected_row]), self._fetch_persisted_lock_state())
		cursor = self.puller.symbol_db.connection.cursor()
		cursor.execute(
			'SELECT body FROM symbol_transactions WHERE type = %s AND is_embedded = %s',
			(expected['transaction_type'], expected['is_embedded']))
		self.assertEqual(1, len(cursor.fetchall()))
		self.assertEqual([expected['lock_path']], [path for path in connector.paths if path.startswith('lock/')])
		return connector

	def test_fetch_hash_lock_success_returns_a_complete_upsert_entry(self):
		# Arrange:
		item = create_hash_lock_item()
		expected_raw_payload = copy.deepcopy(item)
		connector = LockConnector(
			hash_responses={'lock/hash/' + LOCK_HASH: item})
		set_symbol_connector(self.puller, connector)
		key = create_hash_lock_key(LOCK_HASH)

		# Act:
		entries = asyncio.run(self.puller._fetch_dirty_hash_locks([key], 12))  # pylint: disable=protected-access

		# Assert:
		self.assertEqual([{
			'row': {
				'hash': bytes.fromhex(LOCK_HASH),
				'owner_address': bytes.fromhex(SIGNER_ADDRESS),
				'mosaic_id': MOSAIC_ID,
				'amount': 1234,
				'end_height': 100,
				'status': 'unused',
				'raw_payload': expected_raw_payload,
				'updated_at_height': 12
			}
		}], entries)
		self.assertEqual(['lock/hash/' + LOCK_HASH], connector.paths)

	def test_fetch_hash_lock_not_found_returns_a_delete_entry(self):
		# Arrange:
		connector = LockConnector(hash_responses={
			'lock/hash/' + LOCK_HASH: {
				'code': 'ResourceNotFound',
				'message': 'not found'
			}})
		set_symbol_connector(self.puller, connector)
		key = create_hash_lock_key(LOCK_HASH)

		# Act:
		entries = asyncio.run(self.puller._fetch_dirty_hash_locks([key], 12))  # pylint: disable=protected-access

		# Assert:
		self.assertEqual([{'hash': key}], entries)
		self.assertEqual(['lock/hash/' + LOCK_HASH], connector.paths)

	def test_fetch_hash_lock_rejects_a_mismatched_response(self):
		# Arrange:
		connector = LockConnector(hash_responses={
			'lock/hash/' + LOCK_HASH: create_hash_lock_item(lock_hash=LOCK_HASH_2)
		})
		set_symbol_connector(self.puller, connector)

		# Act / Assert:
		with self.assertRaisesRegex(ValueError, '^Symbol Hash Lock response hash does not match dirty key$'):
			asyncio.run(self.puller._fetch_dirty_hash_locks(  # pylint: disable=protected-access
				[create_hash_lock_key(LOCK_HASH)], 12))

	def _assert_sync_rejects_malformed_hash_lock_response(self, response, expected_error):
		# Arrange:
		transaction = create_node_transaction(
			1,
			transaction_hash='01' * 32,
			type=TransactionType.HASH_LOCK.value,
			hash=LOCK_HASH,
			mosaicId=MOSAIC_ID,
			amount='1234')
		connector = LockConnector(
			1,
			{0: [create_node_block(1, transactions_count=1, total_transactions_count=1)]},
			hash_responses={'lock/hash/' + LOCK_HASH: response},
			transactions_by_path={transaction_path(1, 1): create_transaction_page([transaction])},
			statement_pages={statement_path(1, 1): {'data': []}})

		# Act / Assert:
		self._assert_sync_failure_preserves_complete_batch_state(connector, ValueError, expected_error)

	def test_sync_block_headers_rejects_non_dict_hash_lock_response(self):
		self._assert_sync_rejects_malformed_hash_lock_response([], '^Malformed Symbol Hash Lock response$')

	def test_sync_block_headers_rejects_hash_lock_response_with_invalid_required_field(self):
		self._assert_sync_rejects_malformed_hash_lock_response(
			create_hash_lock_item(hash='GG' * 32),
			'^Invalid Symbol Hash Lock hash$')

	def _assert_sync_rejects_malformed_secret_lock_response(self, response, expected_error):
		# Arrange:
		transaction = create_node_transaction(
			1,
			transaction_hash='01' * 32,
			type=TransactionType.SECRET_LOCK.value,
			secret=SECRET,
			hashAlgorithm=1,
			mosaicId=MOSAIC_ID,
			amount='1234')
		path = _secret_search_path(SIGNER_ADDRESS, SECRET)
		connector = LockConnector(
			1,
			{0: [create_node_block(1, transactions_count=1, total_transactions_count=1)]},
			secret_responses={path: response},
			transactions_by_path={transaction_path(1, 1): create_transaction_page([transaction])},
			statement_pages={statement_path(1, 1): {'data': []}})

		# Act / Assert:
		self._assert_sync_failure_preserves_complete_batch_state(connector, ValueError, expected_error)

		# Assert:
		self.assertEqual([path], [request_path for request_path in connector.paths if request_path.startswith('lock/')])

	def test_sync_block_headers_rejects_non_dict_secret_lock_search_response(self):
		self._assert_sync_rejects_malformed_secret_lock_response([], '^Malformed Symbol Secret Lock search response$')

	def test_sync_block_headers_rejects_secret_lock_search_response_without_data(self):
		self._assert_sync_rejects_malformed_secret_lock_response({}, '^Malformed Symbol Secret Lock search response$')

	def test_sync_block_headers_rejects_secret_lock_search_response_with_non_list_data(self):
		self._assert_sync_rejects_malformed_secret_lock_response({'data': {}}, '^Malformed Symbol Secret Lock search response$')

	def test_sync_block_headers_rejects_secret_lock_search_response_with_malformed_item(self):
		self._assert_sync_rejects_malformed_secret_lock_response({'data': [{}]}, '^Malformed Symbol Secret Lock response$')

	def _assert_sync_rejects_second_secret_lock_page(self, second_page_response, exception_type, error):
		# Arrange:
		transaction = create_node_transaction(
			1, transaction_hash='01' * 32, type=TransactionType.SECRET_LOCK.value,
			secret=SECRET, hashAlgorithm=1, mosaicId=MOSAIC_ID, amount='1234')
		page_one = [create_secret_lock_item(composite_hash=f'{index + 1:064X}') for index in range(100)]
		page_one_path = _secret_search_path(SIGNER_ADDRESS, SECRET)
		page_two_path = _secret_search_path(SIGNER_ADDRESS, SECRET, 2)
		connector = LockConnector(
			1,
			{0: [create_node_block(1, transactions_count=1, total_transactions_count=1)]},
			secret_responses={page_one_path: {'data': page_one}, page_two_path: second_page_response},
			transactions_by_path={transaction_path(1, 1): create_transaction_page([transaction])},
			statement_pages={statement_path(1, 1): {'data': []}})

		# Act / Assert:
		self._assert_sync_failure_preserves_complete_batch_state(connector, exception_type, error)

		# Assert:
		self.assertEqual([page_one_path, page_two_path], [path for path in connector.paths if path.startswith('lock/')])

	def test_sync_block_headers_rejects_a_duplicate_secret_lock_composite_hash_across_pages(self):
		# Arrange:
		duplicate_item = create_secret_lock_item(composite_hash=f'{1:064X}')

		# Act / Assert:
		self._assert_sync_rejects_second_secret_lock_page(
			{'data': [duplicate_item]}, ValueError, '^Duplicate Symbol Secret Lock composite hash$')

	def test_sync_block_headers_rejects_a_malformed_second_secret_lock_page(self):
		self._assert_sync_rejects_second_secret_lock_page(
			{}, ValueError, '^Malformed Symbol Secret Lock search response$')

	def test_sync_block_headers_propagates_a_second_secret_lock_page_request_failure(self):
		self._assert_sync_rejects_second_secret_lock_page(
			RuntimeError('second page failed'), RuntimeError, '^second page failed$')

	def test_fetch_secret_lock_paginates_full_and_short_pages_in_node_order(self):
		# Arrange:
		key = create_secret_lock_search_key(
			bytes.fromhex(SIGNER_ADDRESS), bytes.fromhex(RECIPIENT_ADDRESS), bytes.fromhex(SECRET), 'hash160')
		page_one = [
			create_secret_lock_item(
				composite_hash=f'{index + 1:064X}', amount=str(index + 100), endHeight=str(index + 200))
			for index in range(100)
		]
		page_two = [
			create_secret_lock_item(
				composite_hash=f'{index + 1:064X}', amount=str(index + 100), endHeight=str(index + 200))
			for index in range(100, 102)
		]
		expected_rows = [
			{
				'composite_hash': bytes.fromhex(f'{index + 1:064X}'),
				'owner_address': bytes.fromhex(SIGNER_ADDRESS),
				'recipient_address': bytes.fromhex(RECIPIENT_ADDRESS),
				'secret': bytes.fromhex(SECRET),
				'hash_algorithm': 'hash160',
				'mosaic_id': MOSAIC_ID,
				'amount': index + 100,
				'end_height': index + 200,
				'status': 'unused',
				'raw_payload': copy.deepcopy(page_one[index] if index < 100 else page_two[index - 100]),
				'updated_at_height': 12
			}
			for index in range(102)
		]
		expected_entries = [{
			'key': (bytes.fromhex(SIGNER_ADDRESS), bytes.fromhex(RECIPIENT_ADDRESS), bytes.fromhex(SECRET), 'hash160'),
			'rows': expected_rows
		}]
		connector = LockConnector(secret_responses={
			_secret_search_path(SIGNER_ADDRESS, SECRET, 1): {'data': page_one},
			_secret_search_path(SIGNER_ADDRESS, SECRET, 2): {'data': page_two}
		})
		set_symbol_connector(self.puller, connector)

		# Act:
		entries = asyncio.run(self.puller._fetch_dirty_secret_locks([key], 12))  # pylint: disable=protected-access

		# Assert:
		self.assertEqual(expected_entries, entries)
		self.assertEqual([
			_secret_search_path(SIGNER_ADDRESS, SECRET, 1),
			_secret_search_path(SIGNER_ADDRESS, SECRET, 2)
		], connector.paths)

	def test_fetch_secret_lock_filters_owner_recipient_secret_and_hash_algorithm_node_superset(self):
		# Arrange:
		key = create_secret_lock_search_key(
			bytes.fromhex(SIGNER_ADDRESS), bytes.fromhex(RECIPIENT_ADDRESS), bytes.fromhex(SECRET), 'hash160')
		exact_item = create_secret_lock_item(composite_hash=COMPOSITE_HASH_2, amount='222', endHeight='202', status=1)
		expected_entries = [{
			'key': (bytes.fromhex(SIGNER_ADDRESS), bytes.fromhex(RECIPIENT_ADDRESS), bytes.fromhex(SECRET), 'hash160'),
			'rows': [{
				'composite_hash': bytes.fromhex(COMPOSITE_HASH_2),
				'owner_address': bytes.fromhex(SIGNER_ADDRESS),
				'recipient_address': bytes.fromhex(RECIPIENT_ADDRESS),
				'secret': bytes.fromhex(SECRET),
				'hash_algorithm': 'hash160',
				'mosaic_id': MOSAIC_ID,
				'amount': 222,
				'end_height': 202,
				'status': 'used',
				'raw_payload': copy.deepcopy(exact_item),
				'updated_at_height': 12
			}]
		}]
		path = _secret_search_path(SIGNER_ADDRESS, SECRET)
		connector = LockConnector(secret_responses={path: {'data': [
			create_secret_lock_item(composite_hash='01' * 32, owner_address='98' + '33' * 23),
			create_secret_lock_item(composite_hash='02' * 32, recipientAddress='98' + '44' * 23),
			create_secret_lock_item(composite_hash='03' * 32, secret='DD' * 32),
			create_secret_lock_item(composite_hash='04' * 32, hashAlgorithm=0),
			exact_item
		]}})
		set_symbol_connector(self.puller, connector)

		# Act:
		entries = asyncio.run(self.puller._fetch_dirty_secret_locks([key], 12))  # pylint: disable=protected-access

		# Assert:
		self.assertEqual(expected_entries, entries)
		self.assertEqual([path], connector.paths)

	def test_fetch_secret_lock_empty_result_returns_an_empty_replacement(self):
		# Arrange:
		key = create_secret_lock_search_key(
			bytes.fromhex(SIGNER_ADDRESS), bytes.fromhex(RECIPIENT_ADDRESS), bytes.fromhex(SECRET), 'hash160')
		connector = LockConnector(secret_responses={
			_secret_search_path(SIGNER_ADDRESS, SECRET): {'data': []}
		})
		set_symbol_connector(self.puller, connector)

		# Act:
		entries = asyncio.run(self.puller._fetch_dirty_secret_locks([key], 12))  # pylint: disable=protected-access

		# Assert:
		self.assertEqual([{'key': key, 'rows': []}], entries)

	def test_fetch_secret_lock_not_found_returns_an_empty_replacement(self):
		# Arrange:
		key = create_secret_lock_search_key(
			None, bytes.fromhex(RECIPIENT_ADDRESS), bytes.fromhex(SECRET), 'hash160')
		path = _secret_only_search_path(SECRET)
		connector = LockConnector(secret_responses={path: {
			'code': 'ResourceNotFound',
			'message': 'not found'
		}})
		set_symbol_connector(self.puller, connector)

		# Act:
		entries = asyncio.run(self.puller._fetch_dirty_secret_locks([key], 12))  # pylint: disable=protected-access

		# Assert:
		self.assertEqual([{'key': key, 'rows': []}], entries)
		self.assertEqual([path], connector.paths)

	def test_fetch_secret_lock_supports_secret_only_search_without_address(self):
		# Arrange:
		key = create_secret_lock_search_key(
			None, bytes.fromhex(RECIPIENT_ADDRESS), bytes.fromhex(SECRET), 'hash160')
		path = _secret_only_search_path(SECRET)
		connector = LockConnector(secret_responses={path: {'data': [create_secret_lock_item()]}})
		set_symbol_connector(self.puller, connector)

		# Act:
		entries = asyncio.run(self.puller._fetch_dirty_secret_locks([key], 12))  # pylint: disable=protected-access

		# Assert:
		self.assertEqual([{
			'key': key,
			'rows': [create_secret_lock_row(create_secret_lock_item(), 12)]
		}], entries)
		self.assertEqual([path], connector.paths)

	def test_fetch_secret_lock_rejects_duplicate_composite_hash(self):
		# Arrange:
		key = create_secret_lock_search_key(
			bytes.fromhex(SIGNER_ADDRESS), bytes.fromhex(RECIPIENT_ADDRESS), bytes.fromhex(SECRET), 'hash160')
		path = _secret_search_path(SIGNER_ADDRESS, SECRET)
		connector = LockConnector(secret_responses={
			path: {'data': [create_secret_lock_item(), create_secret_lock_item()]}
		})
		set_symbol_connector(self.puller, connector)

		# Act / Assert:
		with self.assertRaisesRegex(ValueError, '^Duplicate Symbol Secret Lock composite hash$'):
			asyncio.run(self.puller._fetch_dirty_secret_locks([key], 12))  # pylint: disable=protected-access

	def test_fetch_secret_locks_uses_ten_request_chunks_and_preserves_non_sorted_input_sequence(self):
		# Arrange:
		secrets = [f'{index:064X}' for index in (3, 1, 11, 2, 10, 4, 9, 5, 8, 6, 7)]
		keys = [
			create_secret_lock_search_key(
				bytes.fromhex(SIGNER_ADDRESS), bytes.fromhex(RECIPIENT_ADDRESS), bytes.fromhex(secret), 'hash160')
			for secret in secrets
		]
		connector = BoundedLockConnector('lock/secret?', secret_responses={
			_secret_search_path(SIGNER_ADDRESS, secret): {
				'data': [create_secret_lock_item(composite_hash=secret, secret=secret)]
			}
			for secret in secrets
		})
		set_symbol_connector(self.puller, connector)

		# Act:
		entries = asyncio.run(self.puller._fetch_dirty_secret_locks(keys, 12))  # pylint: disable=protected-access

		# Assert:
		self.assertEqual(10, connector.max_in_flight_lock_requests)
		self.assertEqual([
			_secret_search_path(SIGNER_ADDRESS, secret)
			for secret in secrets
		], connector.paths)
		self.assertEqual([
			(bytes.fromhex(SIGNER_ADDRESS), bytes.fromhex(RECIPIENT_ADDRESS), bytes.fromhex(secret), 'hash160')
			for secret in secrets
		], [entry['key'] for entry in entries])

	def test_fetch_hash_locks_uses_ten_request_chunks_and_preserves_non_sorted_input_sequence(self):
		# Arrange:
		hashes = [f'{index:064X}' for index in (3, 1, 11, 2, 10, 4, 9, 5, 8, 6, 7)]
		keys = [create_hash_lock_key(lock_hash) for lock_hash in hashes]
		connector = BoundedLockConnector('lock/hash/', hash_responses={
			'lock/hash/' + lock_hash: create_hash_lock_item(lock_hash=lock_hash)
			for lock_hash in hashes
		})
		set_symbol_connector(self.puller, connector)

		# Act:
		entries = asyncio.run(self.puller._fetch_dirty_hash_locks(keys, 12))  # pylint: disable=protected-access

		# Assert:
		self.assertEqual(10, connector.max_in_flight_lock_requests)
		self.assertEqual([
			'lock/hash/' + lock_hash
			for lock_hash in hashes
		], connector.paths)
		self.assertEqual([
			bytes.fromhex(lock_hash)
			for lock_hash in hashes
		], [entry['row']['hash'] for entry in entries])

	def test_collect_dirty_lock_keys_uses_hash_lock_body_hash(self):
		# Arrange:
		transaction_row = self._create_lock_transaction_row(
			TransactionType.HASH_LOCK.value, {'hash': LOCK_HASH_2})

		# Act:
		keys = self._collect_lock_keys([transaction_row])

		# Assert:
		self.assertEqual({create_hash_lock_key(LOCK_HASH_2)}, keys.hash_keys)
		self.assertEqual(set(), keys.secret_keys)

	def test_collect_dirty_lock_keys_uses_top_level_aggregate_bonded_hash(self):
		# Arrange:
		top_level = self._create_lock_transaction_row(
			TransactionType.AGGREGATE_BONDED.value, {}, hash=bytes.fromhex(LOCK_HASH_2))

		# Act:
		keys = self._collect_lock_keys([top_level])

		# Assert:
		self.assertEqual({create_hash_lock_key(LOCK_HASH_2)}, keys.hash_keys)
		self.assertEqual(set(), keys.secret_keys)

	def test_collect_dirty_lock_keys_uses_resolved_secret_lock_recipient(self):
		# Arrange:
		transaction_row = self._create_lock_transaction_row(
			TransactionType.SECRET_LOCK.value,
			{'secret': SECRET, 'hashAlgorithm': 1, 'recipientAddress': ALIAS_ADDRESS})

		# Act:
		keys = self._collect_lock_keys([transaction_row])

		# Assert:
		self.assertEqual(set(), keys.hash_keys)
		self.assertEqual({(
			bytes.fromhex(SIGNER_ADDRESS), bytes.fromhex(RECIPIENT_ADDRESS), bytes.fromhex(SECRET), 'hash160'
		)}, keys.secret_keys)

	def test_collect_dirty_lock_keys_uses_secret_proof_with_unknown_owner(self):
		# Arrange:
		transaction_row = self._create_lock_transaction_row(
			TransactionType.SECRET_PROOF.value, {'secret': SECRET, 'hashAlgorithm': 0})

		# Act:
		keys = self._collect_lock_keys([transaction_row])

		# Assert:
		self.assertEqual(set(), keys.hash_keys)
		self.assertEqual({(None, bytes.fromhex(RECIPIENT_ADDRESS), bytes.fromhex(SECRET), 'sha3_256')}, keys.secret_keys)

	def test_collect_dirty_lock_keys_ignores_unrelated_transaction_type(self):
		# Arrange:
		unrelated = self._create_lock_transaction_row(TransactionType.TRANSFER.value, {})

		# Act:
		keys = self._collect_lock_keys([unrelated])

		# Assert:
		self.assertEqual(set(), keys.hash_keys)
		self.assertEqual(set(), keys.secret_keys)

	def test_collect_dirty_lock_keys_accepts_empty_transaction_input(self):
		# Arrange:
		transaction_rows = []

		# Act:
		keys = self._collect_lock_keys(transaction_rows)

		# Assert:
		self.assertEqual(set(), keys.hash_keys)
		self.assertEqual(set(), keys.secret_keys)

	def test_collect_dirty_lock_keys_deduplicates_hash_keys(self):
		# Arrange:
		first = self._create_lock_transaction_row(TransactionType.HASH_LOCK.value, {'hash': LOCK_HASH_2})
		second = self._create_lock_transaction_row(TransactionType.HASH_LOCK.value, {'hash': LOCK_HASH})
		duplicate = self._create_lock_transaction_row(TransactionType.HASH_LOCK.value, {'hash': LOCK_HASH_2})

		# Act:
		keys = self._collect_lock_keys([first, second, duplicate])

		# Assert:
		self.assertEqual(2, len(keys.hash_keys))
		self.assertEqual({create_hash_lock_key(LOCK_HASH_2), create_hash_lock_key(LOCK_HASH)}, keys.hash_keys)

	def test_collect_dirty_lock_keys_deduplicates_secret_keys(self):
		# Arrange:
		first = self._create_lock_transaction_row(TransactionType.SECRET_PROOF.value, {'secret': SECRET, 'hashAlgorithm': 0})
		second = self._create_lock_transaction_row(TransactionType.SECRET_LOCK.value, {'secret': SECRET, 'hashAlgorithm': 1})
		duplicate = self._create_lock_transaction_row(TransactionType.SECRET_PROOF.value, {'secret': SECRET, 'hashAlgorithm': 0})

		# Act:
		keys = self._collect_lock_keys([first, second, duplicate])

		# Assert:
		self.assertEqual(2, len(keys.secret_keys))
		self.assertEqual({
			(None, bytes.fromhex(RECIPIENT_ADDRESS), bytes.fromhex(SECRET), 'sha3_256'),
			(bytes.fromhex(SIGNER_ADDRESS), bytes.fromhex(RECIPIENT_ADDRESS), bytes.fromhex(SECRET), 'hash160')
		}, keys.secret_keys)

	def test_collect_dirty_lock_keys_rejects_surviving_alias_recipient(self):
		# Arrange:
		alias_address = bytes.fromhex(ALIAS_ADDRESS)
		transaction_row = {
			'type': TransactionType.SECRET_PROOF.value,
			'is_embedded': False,
			'hash': bytes.fromhex('01' * 32),
			'signer_address': bytes.fromhex(SIGNER_ADDRESS),
			'recipient_address': alias_address,
			'body': {'secret': SECRET, 'hashAlgorithm': 0}
		}

		# Act / Assert:
		with self.assertRaisesRegex(ValueError, 'recipient_address'):
			self.puller._collect_dirty_lock_keys_for_batch(  # pylint: disable=protected-access
				{1: [transaction_row]})

	@staticmethod
	def _create_hash_lock_sync_connector():
		hash_transaction = create_node_transaction(
			1,
			transaction_hash='01' * 32,
			type=TransactionType.HASH_LOCK.value,
			hash=LOCK_HASH,
			mosaicId=MOSAIC_ID,
			amount='1234')
		return LockConnector(
			1,
			{0: [create_node_block(1, transactions_count=1, total_transactions_count=1)]},
			hash_responses={'lock/hash/' + LOCK_HASH: create_hash_lock_item()},
			transactions_by_path={transaction_path(1, 1): create_transaction_page([hash_transaction])},
			statement_pages={statement_path(1, 1): {'data': []}})

	@staticmethod
	def _create_secret_lock_sync_connector():
		secret_transaction = create_node_transaction(
			1,
			transaction_hash='02' * 32,
			type=TransactionType.SECRET_LOCK.value,
			secret=SECRET,
			hashAlgorithm=1,
			mosaicId=MOSAIC_ID,
			amount='1234')
		return LockConnector(
			1,
			{0: [create_node_block(1, transactions_count=1, total_transactions_count=1)]},
			secret_responses={_secret_search_path(SIGNER_ADDRESS, SECRET): {
				'data': [create_secret_lock_item()]}},
			transactions_by_path={transaction_path(1, 1): create_transaction_page([secret_transaction])},
			statement_pages={statement_path(1, 1): {'data': []}})

	@staticmethod
	def _expected_persisted_hash_lock_state():
		return ([{
			'hash': bytes.fromhex(LOCK_HASH),
			'owner_address': bytes.fromhex(SIGNER_ADDRESS),
			'mosaic_id': MOSAIC_ID,
			'amount': 1234,
			'end_height': 100,
			'status': 'unused',
			'raw_payload': {
				'lock': {
					'hash': LOCK_HASH,
					'ownerAddress': SIGNER_ADDRESS,
					'mosaicId': MOSAIC_ID,
					'amount': '1234',
					'endHeight': '100',
					'status': 0
				},
				'id': 'hash-lock'
			},
			'updated_at_height': 1
		}], [])

	@staticmethod
	def _expected_persisted_secret_lock_state():
		return ([], [create_expected_secret_lock_row(
			create_secret_lock_item(),
			1,
			composite_hash=bytes.fromhex(COMPOSITE_HASH),
			owner_address=bytes.fromhex(SIGNER_ADDRESS),
			recipient_address=bytes.fromhex(RECIPIENT_ADDRESS),
			secret=bytes.fromhex(SECRET),
			hash_algorithm='hash160',
			mosaic_id=MOSAIC_ID,
			amount=1234,
			end_height=100,
			status='unused')])

	def _fetch_persisted_lock_state(self):
		cursor = self.puller.symbol_db.connection.cursor()
		cursor.execute(
			'SELECT hash, owner_address, mosaic_id, amount, end_height, status, raw_payload, updated_at_height '
			'FROM symbol_hash_locks ORDER BY hash')
		hash_locks = [{
			'hash': bytes(lock_hash),
			'owner_address': bytes(owner_address),
			'mosaic_id': mosaic_id,
			'amount': amount,
			'end_height': end_height,
			'status': status,
			'raw_payload': raw_payload,
			'updated_at_height': updated_at_height
		} for lock_hash, owner_address, mosaic_id, amount, end_height, status, raw_payload, updated_at_height
			in cursor.fetchall()]
		cursor.execute(
			'SELECT composite_hash, owner_address, recipient_address, secret, hash_algorithm, mosaic_id, amount, end_height, '
			'status, raw_payload, updated_at_height FROM symbol_secret_locks ORDER BY composite_hash')
		secret_locks = [{
			'composite_hash': bytes(composite_hash),
			'owner_address': bytes(owner_address),
			'recipient_address': bytes(recipient_address),
			'secret': bytes(secret),
			'hash_algorithm': hash_algorithm,
			'mosaic_id': mosaic_id,
			'amount': amount,
			'end_height': end_height,
			'status': status,
			'raw_payload': raw_payload,
			'updated_at_height': updated_at_height
		} for composite_hash, owner_address, recipient_address, secret, hash_algorithm, mosaic_id, amount, end_height,
			status, raw_payload, updated_at_height in cursor.fetchall()]
		return hash_locks, secret_locks

	def _seed_finalized_lock_state(self, end_height=2):
		self._seed_blocks(self.puller.symbol_db, [1, 2, 3])
		self.puller.symbol_db.upsert_sync_state(create_sync_state(
			chain_height=2,
			finalized_height=1,
			last_synced_height=2,
			last_synced_block_hash=bytes.fromhex(f'{2:064X}')))
		self.puller.symbol_db.upsert_hash_lock(create_hash_lock_row(create_hash_lock_item(
			endHeight=str(end_height)), 1))
		secret_key = create_secret_lock_search_key(
			bytes.fromhex(SIGNER_ADDRESS), bytes.fromhex(RECIPIENT_ADDRESS), bytes.fromhex(SECRET), 'hash160')
		self.puller.symbol_db.replace_secret_locks(
			secret_key, [create_secret_lock_row(create_secret_lock_item(endHeight=str(end_height)), 1)])

	@staticmethod
	def _expected_finalized_hash_lock_row():
		item = create_hash_lock_item(endHeight='2')
		return {
			'hash': bytes.fromhex(LOCK_HASH),
			'owner_address': bytes.fromhex(SIGNER_ADDRESS),
			'mosaic_id': MOSAIC_ID,
			'amount': 1234,
			'end_height': 2,
			'status': 'unused',
			'raw_payload': item,
			'updated_at_height': 2
		}

	@staticmethod
	def _expected_finalized_secret_lock_row():
		item = create_secret_lock_item(endHeight='2')
		return create_expected_secret_lock_row(
			item,
			2,
			composite_hash=bytes.fromhex(COMPOSITE_HASH),
			owner_address=bytes.fromhex(SIGNER_ADDRESS),
			recipient_address=bytes.fromhex(RECIPIENT_ADDRESS),
			secret=bytes.fromhex(SECRET),
			hash_algorithm='hash160',
			mosaic_id=MOSAIC_ID,
			amount=1234,
			end_height=2,
			status='unused')

	@staticmethod
	def _finalization_connector(finalized_height=2, hash_responses=None, secret_responses=None, chain_height=2):
		return LockConnector(
			chain_height,
			{},
			finalized_height=finalized_height,
			hash_responses=hash_responses,
			secret_responses=secret_responses)

	def test_sync_block_headers_removes_unused_hash_and_secret_locks_after_finalization_without_new_blocks(self):
		# Arrange:
		self._seed_finalized_lock_state()
		connector = self._finalization_connector(
			hash_responses={'lock/hash/' + LOCK_HASH: {'code': 'ResourceNotFound', 'message': 'not found'}},
			secret_responses={_secret_search_path(SIGNER_ADDRESS, SECRET): {'data': []}})

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		self.assertEqual(([], []), self._fetch_persisted_lock_state())
		self.assertEqual(['lock/hash/' + LOCK_HASH, _secret_search_path(SIGNER_ADDRESS, SECRET)], [
			path for path in connector.paths if path.startswith('lock/')])
		self.assertEqual([], [path for path in connector.paths if path.startswith('blocks?')])

	def test_sync_block_headers_removes_a_used_hash_lock_after_finalization_when_node_drops_it(self):
		# Arrange:
		self._seed_finalized_lock_state()
		cursor = self.puller.symbol_db.connection.cursor()
		cursor.execute("UPDATE symbol_hash_locks SET status = 'used' WHERE hash = %s", (bytes.fromhex(LOCK_HASH),))
		self.puller.symbol_db.connection.commit()
		connector = self._finalization_connector(
			hash_responses={'lock/hash/' + LOCK_HASH: {'code': 'ResourceNotFound', 'message': 'not found'}},
			secret_responses={_secret_search_path(SIGNER_ADDRESS, SECRET): {
				'data': [create_secret_lock_item(endHeight='2')]
			}})

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		self.assertEqual(([], [self._expected_finalized_secret_lock_row()]), self._fetch_persisted_lock_state())
		self.assertEqual(['lock/hash/' + LOCK_HASH, _secret_search_path(SIGNER_ADDRESS, SECRET)], [
			path for path in connector.paths if path.startswith('lock/')])

	def test_sync_block_headers_removes_an_unused_secret_lock_after_finalization_when_node_drops_it(self):
		# Arrange:
		self._seed_finalized_lock_state()
		connector = self._finalization_connector(
			hash_responses={'lock/hash/' + LOCK_HASH: create_hash_lock_item(endHeight='2')},
			secret_responses={_secret_search_path(SIGNER_ADDRESS, SECRET): {'data': []}})

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		self.assertEqual(([self._expected_finalized_hash_lock_row()], []), self._fetch_persisted_lock_state())
		self.assertEqual(['lock/hash/' + LOCK_HASH, _secret_search_path(SIGNER_ADDRESS, SECRET)], [
			path for path in connector.paths if path.startswith('lock/')])

	def test_sync_block_headers_removes_a_used_secret_lock_after_finalization_when_node_drops_it(self):
		# Arrange:
		self._seed_finalized_lock_state()
		cursor = self.puller.symbol_db.connection.cursor()
		cursor.execute("UPDATE symbol_secret_locks SET status = 'used' WHERE composite_hash = %s", (bytes.fromhex(COMPOSITE_HASH),))
		self.puller.symbol_db.connection.commit()
		connector = self._finalization_connector(
			hash_responses={'lock/hash/' + LOCK_HASH: create_hash_lock_item(endHeight='2')},
			secret_responses={_secret_search_path(SIGNER_ADDRESS, SECRET): {'data': []}})

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		self.assertEqual(([self._expected_finalized_hash_lock_row()], []), self._fetch_persisted_lock_state())
		self.assertEqual(['lock/hash/' + LOCK_HASH, _secret_search_path(SIGNER_ADDRESS, SECRET)], [
			path for path in connector.paths if path.startswith('lock/')])

	def test_sync_block_headers_refreshes_finalized_lock_state_when_node_still_returns_it(self):
		# Arrange:
		self._seed_finalized_lock_state()
		connector = self._finalization_connector(
			hash_responses={'lock/hash/' + LOCK_HASH: create_hash_lock_item(endHeight='2')},
			secret_responses={_secret_search_path(SIGNER_ADDRESS, SECRET): {
				'data': [create_secret_lock_item(endHeight='2')]
			}})

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		self.assertEqual((
			[self._expected_finalized_hash_lock_row()],
			[self._expected_finalized_secret_lock_row()]
		), self._fetch_persisted_lock_state())
		self.assertEqual(['lock/hash/' + LOCK_HASH, _secret_search_path(SIGNER_ADDRESS, SECRET)], [
			path for path in connector.paths if path.startswith('lock/')])

	def test_sync_block_headers_rechecks_finalized_lock_state_until_node_drops_it(self):
		# Arrange:
		self._seed_finalized_lock_state()
		first_connector = self._finalization_connector(
			hash_responses={'lock/hash/' + LOCK_HASH: create_hash_lock_item(endHeight='2')},
			secret_responses={_secret_search_path(SIGNER_ADDRESS, SECRET): {'data': [create_secret_lock_item(endHeight='2')]}})

		# Act:
		self._sync_with_connector(first_connector)

		# Assert:
		self.assertEqual((
			[self._expected_finalized_hash_lock_row()],
			[self._expected_finalized_secret_lock_row()]
		), self._fetch_persisted_lock_state())
		self.assertEqual(['lock/hash/' + LOCK_HASH, _secret_search_path(SIGNER_ADDRESS, SECRET)], [
			path for path in first_connector.paths if path.startswith('lock/')])

		# Arrange:
		second_connector = self._finalization_connector(
			hash_responses={'lock/hash/' + LOCK_HASH: {'code': 'ResourceNotFound', 'message': 'not found'}},
			secret_responses={_secret_search_path(SIGNER_ADDRESS, SECRET): {'data': []}})

		# Act:
		self._sync_with_connector(second_connector)

		# Assert:
		self.assertEqual(([], []), self._fetch_persisted_lock_state())
		self.assertEqual(['lock/hash/' + LOCK_HASH, _secret_search_path(SIGNER_ADDRESS, SECRET)], [
			path for path in second_connector.paths if path.startswith('lock/')])

	def test_sync_block_headers_keeps_finalized_lock_and_sync_state_when_hash_fetch_fails(self):
		# Arrange:
		self._seed_finalized_lock_state()
		original_state = self._fetch_complete_batch_state()
		connector = self._finalization_connector(
			hash_responses={'lock/hash/' + LOCK_HASH: RuntimeError('finalized hash fetch failed')},
			secret_responses={_secret_search_path(SIGNER_ADDRESS, SECRET): {'data': []}})

		# Act / Assert:
		with self.assertRaisesRegex(RuntimeError, '^finalized hash fetch failed$'):
			self._sync_with_connector(connector)

		self.assertEqual(original_state, self._fetch_complete_batch_state())

	def test_sync_block_headers_keeps_finalized_lock_and_sync_state_when_secret_fetch_fails(self):
		# Arrange:
		self._seed_finalized_lock_state()
		original_state = self._fetch_complete_batch_state()
		connector = self._finalization_connector(
			hash_responses={'lock/hash/' + LOCK_HASH: create_hash_lock_item()},
			secret_responses={_secret_search_path(SIGNER_ADDRESS, SECRET): RuntimeError('finalized secret fetch failed')})

		# Act / Assert:
		with self.assertRaisesRegex(RuntimeError, '^finalized secret fetch failed$'):
			self._sync_with_connector(connector)

		self.assertEqual(original_state, self._fetch_complete_batch_state())

	def test_sync_block_headers_defers_finalization_cleanup_above_max_height_until_a_later_run(self):
		# Arrange:
		self._seed_finalized_lock_state(end_height=2)
		deferred_hash_item = create_hash_lock_item(lock_hash=LOCK_HASH_2, endHeight='3')
		self.puller.symbol_db.upsert_hash_lock(create_hash_lock_row(deferred_hash_item, 1))
		capped_connector = LockConnector(
			3,
			{},
			finalized_height=3,
			hash_responses={'lock/hash/' + LOCK_HASH: {'code': 'ResourceNotFound', 'message': 'not found'}},
			secret_responses={_secret_search_path(SIGNER_ADDRESS, SECRET): {'data': []}})

		# Act:
		self._sync_with_connector(capped_connector, max_height=2)

		# Assert:
		self.assertEqual(([create_hash_lock_row(deferred_hash_item, 1)], []), self._fetch_persisted_lock_state())
		self.assertEqual(['lock/hash/' + LOCK_HASH, _secret_search_path(SIGNER_ADDRESS, SECRET)], [
			path for path in capped_connector.paths if path.startswith('lock/')])

		# Act:
		uncapped_connector = LockConnector(
			3,
			{2: [create_node_block(3)]},
			{3: create_node_block(3)},
			finalized_height=3,
			hash_responses={'lock/hash/' + LOCK_HASH_2: {'code': 'ResourceNotFound', 'message': 'not found'}},
			transactions_by_path={transaction_path(3, 3): create_transaction_page([])},
			statement_pages={statement_path(3, 3): {'data': []}})
		self._sync_with_connector(uncapped_connector)

		# Assert:
		self.assertEqual(([], []), self._fetch_persisted_lock_state())
		self.assertEqual(['lock/hash/' + LOCK_HASH_2], [
			path for path in uncapped_connector.paths if path.startswith('lock/')])

	def test_sync_block_headers_persists_a_hash_lock_without_an_aggregate_bonded_transaction(self):
		# Arrange:
		connector = self._create_hash_lock_sync_connector()
		expected_lock_state = self._expected_persisted_hash_lock_state()

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		self.assertEqual(expected_lock_state, self._fetch_persisted_lock_state())

	def test_sync_block_headers_removes_a_dirty_hash_lock_when_node_returns_not_found(self):
		# Arrange:
		self.puller.symbol_db.upsert_hash_lock(create_hash_lock_row(create_hash_lock_item(), 1))
		connector = self._create_hash_lock_sync_connector()
		connector.hash_responses['lock/hash/' + LOCK_HASH] = {
			'code': 'ResourceNotFound',
			'message': 'not found'
		}

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		self.assertEqual(([], []), self._fetch_persisted_lock_state())
		self.assertEqual([1], self._fetch_block_heights(self.puller.symbol_db))
		cursor = self.puller.symbol_db.connection.cursor()
		cursor.execute('SELECT COUNT(*) FROM symbol_transactions')
		self.assertEqual(1, cursor.fetchone()[0])
		sync_state = self.puller.symbol_db.get_sync_state()
		self.assertEqual(1, sync_state['chain_height'])
		self.assertEqual(1, sync_state['last_synced_height'])
		hash_paths = [path for path in connector.paths if path == 'lock/hash/' + LOCK_HASH]
		self.assertEqual(1, len(hash_paths))

	def test_sync_block_headers_persists_a_secret_lock(self):
		# Arrange:
		connector = self._create_secret_lock_sync_connector()
		expected_lock_state = self._expected_persisted_secret_lock_state()

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		self.assertEqual(expected_lock_state, self._fetch_persisted_lock_state())

	def test_sync_block_headers_converges_a_hash_lock_when_restarted_from_existing_blocks(self):
		# Arrange:
		connector = self._create_hash_lock_sync_connector()
		expected_lock_state = self._expected_persisted_hash_lock_state()
		self._sync_with_connector(connector)
		cursor = self.puller.symbol_db.connection.cursor()
		cursor.execute('DELETE FROM symbol_sync_state')
		self.puller.symbol_db.connection.commit()

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		self.assertEqual(expected_lock_state, self._fetch_persisted_lock_state())

	def test_sync_block_headers_converges_a_secret_lock_when_restarted_from_existing_blocks(self):
		# Arrange:
		connector = self._create_secret_lock_sync_connector()
		expected_lock_state = self._expected_persisted_secret_lock_state()
		self._sync_with_connector(connector)
		cursor = self.puller.symbol_db.connection.cursor()
		cursor.execute('DELETE FROM symbol_sync_state')
		self.puller.symbol_db.connection.commit()

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		self.assertEqual(expected_lock_state, self._fetch_persisted_lock_state())

	def test_sync_block_headers_converges_a_new_hash_lock_completed_in_the_same_batch_to_used(self):
		# Arrange:
		hash_lock_transaction = create_node_transaction(
			1,
			transaction_hash='01' * 32,
			block_index=0,
			type=TransactionType.HASH_LOCK.value,
			hash=LOCK_HASH,
			mosaicId=MOSAIC_ID,
			amount='1234')
		aggregate_bonded_transaction = create_node_transaction(
			1,
			transaction_hash=LOCK_HASH,
			block_index=1,
			type=TransactionType.AGGREGATE_BONDED.value)
		block_one = create_node_block(1)
		block_one['meta']['transactionsCount'] = 2
		block_one['meta']['totalTransactionsCount'] = 2
		block_one['meta']['statementsCount'] = 0
		used_item = create_hash_lock_item(status=1)
		connector = LockConnector(
			1,
			{0: [block_one]},
			hash_responses={'lock/hash/' + LOCK_HASH: used_item},
			transactions_by_path={
				transaction_path(1, 1): create_transaction_page([hash_lock_transaction, aggregate_bonded_transaction])
			},
			statement_pages={statement_path(1, 1): {'data': []}})
		expected_row = {
			'hash': bytes.fromhex(LOCK_HASH),
			'owner_address': bytes.fromhex(SIGNER_ADDRESS),
			'mosaic_id': MOSAIC_ID,
			'amount': 1234,
			'end_height': 100,
			'status': 'used',
			'raw_payload': copy.deepcopy(used_item),
			'updated_at_height': 1
		}

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		self.assertEqual(([expected_row], []), self._fetch_persisted_lock_state())
		self.assertEqual(['lock/hash/' + LOCK_HASH], [
			path for path in connector.paths if path.startswith('lock/')
		])

	def test_sync_block_headers_converges_a_new_secret_lock_completed_in_the_same_batch_to_used(self):
		# Arrange:
		secret_lock_transaction = create_node_transaction(
			1,
			transaction_hash='01' * 32,
			block_index=0,
			type=TransactionType.SECRET_LOCK.value,
			secret=SECRET,
			hashAlgorithm=1,
			mosaicId=MOSAIC_ID,
			amount='1234')
		secret_proof_transaction = create_node_transaction(
			1,
			transaction_hash='02' * 32,
			block_index=1,
			type=TransactionType.SECRET_PROOF.value,
			secret=SECRET,
			hashAlgorithm=1)
		address_response_item = create_secret_lock_item(status=1)
		secret_only_response_item = create_secret_lock_item(status=1)
		expected_item = create_secret_lock_item(status=1)
		block_one = create_node_block(1)
		block_one['meta']['transactionsCount'] = 2
		block_one['meta']['totalTransactionsCount'] = 2
		block_one['meta']['statementsCount'] = 0
		address_path = _secret_search_path(SIGNER_ADDRESS, SECRET)
		secret_only_path = _secret_only_search_path(SECRET)
		connector = LockConnector(
			1,
			{0: [block_one]},
			secret_responses={
				address_path: {'data': [address_response_item]},
				secret_only_path: {'data': [secret_only_response_item]}
			},
			transactions_by_path={
				transaction_path(1, 1): create_transaction_page([secret_lock_transaction, secret_proof_transaction])
			},
			statement_pages={statement_path(1, 1): {'data': []}})
		expected_row = create_expected_secret_lock_row(
			expected_item,
			1,
			composite_hash=bytes.fromhex(COMPOSITE_HASH),
			owner_address=bytes.fromhex(SIGNER_ADDRESS),
			recipient_address=bytes.fromhex(RECIPIENT_ADDRESS),
			secret=bytes.fromhex(SECRET),
			hash_algorithm='hash160',
			mosaic_id=MOSAIC_ID,
			amount=1234,
			end_height=100,
			status='used')

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		self.assertEqual(([], [expected_row]), self._fetch_persisted_lock_state())
		lock_paths = [path for path in connector.paths if path.startswith('lock/')]
		self.assertCountEqual((address_path, secret_only_path), lock_paths)
		self.assertEqual(1, lock_paths.count(address_path))
		self.assertEqual(1, lock_paths.count(secret_only_path))

	def test_sync_block_headers_updates_an_existing_hash_lock_to_used_when_completion_arrives_in_a_later_batch(self):
		# Arrange:
		self._seed_blocks(self.puller.symbol_db, [1])
		self.puller.symbol_db.upsert_sync_state(create_sync_state(
			chain_height=1, last_synced_height=1, last_synced_block_hash=bytes.fromhex(f'{1:064X}')))
		self.puller.symbol_db.upsert_hash_lock(create_hash_lock_row(create_hash_lock_item(), 1))
		aggregate_transaction = create_node_transaction(
			2, transaction_hash=LOCK_HASH, type=TransactionType.AGGREGATE_BONDED.value)
		connector = LockConnector(
			2,
			{1: [create_node_block(2, transactions_count=1, total_transactions_count=1)]},
			{2: create_node_block(2, transactions_count=1, total_transactions_count=1)},
			hash_responses={'lock/hash/' + LOCK_HASH: create_hash_lock_item(status=1)},
			transactions_by_path={transaction_path(2, 2): create_transaction_page([aggregate_transaction])},
			statement_pages={statement_path(2, 2): {'data': []}})
		expected_row = {
			'hash': bytes.fromhex(LOCK_HASH), 'owner_address': bytes.fromhex(SIGNER_ADDRESS), 'mosaic_id': MOSAIC_ID,
			'amount': 1234, 'end_height': 100, 'status': 'used', 'raw_payload': create_hash_lock_item(status=1),
			'updated_at_height': 2
		}

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		self.assertEqual(([expected_row], []), self._fetch_persisted_lock_state())
		self.assertEqual([1, 2], self._fetch_block_heights(self.puller.symbol_db))
		self.assertEqual(2, self.puller.symbol_db.get_sync_state()['last_synced_height'])
		self.assertEqual(['lock/hash/' + LOCK_HASH], [path for path in connector.paths if path.startswith('lock/')])

	def test_sync_block_headers_updates_an_existing_secret_lock_to_used_when_completion_arrives_in_a_later_batch(self):
		# Arrange:
		self._seed_blocks(self.puller.symbol_db, [1])
		self.puller.symbol_db.upsert_sync_state(create_sync_state(
			chain_height=1, last_synced_height=1, last_synced_block_hash=bytes.fromhex(f'{1:064X}')))
		key = create_secret_lock_search_key(
			bytes.fromhex(SIGNER_ADDRESS), bytes.fromhex(RECIPIENT_ADDRESS), bytes.fromhex(SECRET), 'hash160')
		self.puller.symbol_db.replace_secret_locks(key, [create_secret_lock_row(create_secret_lock_item(), 1)])
		proof_transaction = create_node_transaction(
			2, type=TransactionType.SECRET_PROOF.value, secret=SECRET, hashAlgorithm=1)
		path = _secret_only_search_path(SECRET)
		connector = LockConnector(
			2,
			{1: [create_node_block(2, transactions_count=1, total_transactions_count=1)]},
			{2: create_node_block(2, transactions_count=1, total_transactions_count=1)},
			secret_responses={path: {'data': [create_secret_lock_item(status=1)]}},
			transactions_by_path={transaction_path(2, 2): create_transaction_page([proof_transaction])},
			statement_pages={statement_path(2, 2): {'data': []}})
		expected_row = create_expected_secret_lock_row(
			create_secret_lock_item(status=1), 2,
			composite_hash=bytes.fromhex(COMPOSITE_HASH), owner_address=bytes.fromhex(SIGNER_ADDRESS),
			recipient_address=bytes.fromhex(RECIPIENT_ADDRESS), secret=bytes.fromhex(SECRET), hash_algorithm='hash160',
			mosaic_id=MOSAIC_ID, amount=1234, end_height=100, status='used')

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		self.assertEqual(([], [expected_row]), self._fetch_persisted_lock_state())
		self.assertEqual([1, 2], self._fetch_block_heights(self.puller.symbol_db))
		self.assertEqual(2, self.puller.symbol_db.get_sync_state()['last_synced_height'])
		self.assertEqual([path], [request_path for request_path in connector.paths if request_path.startswith('lock/')])

	def test_sync_block_headers_persists_a_top_level_secret_lock(self):
		# Arrange:
		transaction = create_node_transaction(
			1,
			type=TransactionType.SECRET_LOCK.value,
			secret=SECRET,
			hashAlgorithm=1,
			mosaicId=MOSAIC_ID,
			amount='1234')

		# Act / Assert:
		self._assert_sync_persists_secret_lock_transaction(
			[transaction],
			1,
			1,
			{
				'transaction_type': TransactionType.SECRET_LOCK.value,
				'is_embedded': False,
				'lock_path': _secret_search_path(SIGNER_ADDRESS, SECRET),
				'owner_address': SIGNER_ADDRESS
			})

	def test_sync_block_headers_persists_a_top_level_secret_proof(self):
		# Arrange:
		transaction = create_node_transaction(
			1,
			type=TransactionType.SECRET_PROOF.value,
			secret=SECRET,
			hashAlgorithm=1)

		# Act / Assert:
		self._assert_sync_persists_secret_lock_transaction(
			[transaction],
			1,
			1,
			{
				'transaction_type': TransactionType.SECRET_PROOF.value,
				'is_embedded': False,
				'lock_path': _secret_only_search_path(SECRET),
				'owner_address': SIGNER_ADDRESS
			})

	def test_sync_block_headers_persists_an_embedded_secret_lock(self):
		# Arrange:
		aggregate_hash = 'AB' * 32
		transactions = create_complete_aggregate_pair(
			1,
			aggregate_hash,
			0,
			type=TransactionType.SECRET_LOCK.value,
			secret=SECRET,
			hashAlgorithm=1,
			mosaicId=MOSAIC_ID,
			amount='1234')

		# Act / Assert:
		self._assert_sync_persists_secret_lock_transaction(
			transactions,
			1,
			2,
			{
				'transaction_type': TransactionType.SECRET_LOCK.value,
				'is_embedded': True,
				'lock_path': _secret_search_path(SIGNER_ADDRESS, SECRET),
				'owner_address': SIGNER_ADDRESS
			})

	def test_sync_block_headers_persists_an_embedded_secret_proof(self):
		# Arrange:
		aggregate_hash = 'AB' * 32
		transactions = create_complete_aggregate_pair(
			1,
			aggregate_hash,
			0,
			type=TransactionType.SECRET_PROOF.value,
			secret=SECRET,
			hashAlgorithm=1)

		# Act / Assert:
		self._assert_sync_persists_secret_lock_transaction(
			transactions,
			1,
			2,
			{
				'transaction_type': TransactionType.SECRET_PROOF.value,
				'is_embedded': True,
				'lock_path': _secret_only_search_path(SECRET),
				'owner_address': SIGNER_ADDRESS
			})

	def test_sync_block_headers_resolves_a_hash_lock_mosaic_alias_without_changing_the_raw_payload(self):
		# Arrange:
		transaction = create_node_transaction(
			1,
			type=TransactionType.HASH_LOCK.value,
			hash=LOCK_HASH,
			mosaicId=ALIAS_MOSAIC_ID,
			amount='1234')
		connector = LockConnector(
			1,
			{0: [create_node_block(1, transactions_count=1, total_transactions_count=1)]},
			hash_responses={'lock/hash/' + LOCK_HASH: create_hash_lock_item()},
			transactions_by_path={transaction_path(1, 1): create_transaction_page([transaction])},
			statement_pages={statement_path(1, 1): {'data': []}},
			mosaic_resolutions_by_height={1: [create_resolution_statement(
				1,
				ALIAS_MOSAIC_ID,
				[_resolution_entry(1, 0, MOSAIC_ID)])]})

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		expected_row = {
			'hash': bytes.fromhex(LOCK_HASH),
			'owner_address': bytes.fromhex(SIGNER_ADDRESS),
			'mosaic_id': MOSAIC_ID,
			'amount': 1234,
			'end_height': 100,
			'status': 'unused',
			'raw_payload': create_hash_lock_item(),
			'updated_at_height': 1
		}
		cursor = self.puller.symbol_db.connection.cursor()
		cursor.execute('SELECT body->>\'mosaicId\' FROM symbol_transactions')
		self.assertEqual((ALIAS_MOSAIC_ID,), cursor.fetchone())
		cursor.execute('SELECT mosaic_id FROM symbol_transaction_mosaics')
		self.assertEqual([(MOSAIC_ID,)], cursor.fetchall())
		self.assertEqual(([expected_row], []), self._fetch_persisted_lock_state())
		self.assertEqual([resolution_path('mosaic', 1)], [
			path for path in connector.paths if path.startswith('statements/resolutions/')
		])
		self.assertEqual(['lock/hash/' + LOCK_HASH], [
			path for path in connector.paths if path.startswith('lock/')
		])

	def test_sync_block_headers_resolves_a_secret_lock_mosaic_alias_without_changing_the_raw_payload(self):
		# Arrange:
		transaction = create_node_transaction(
			1,
			type=TransactionType.SECRET_LOCK.value,
			secret=SECRET,
			hashAlgorithm=1,
			mosaicId=ALIAS_MOSAIC_ID,
			amount='1234')

		# Act:
		connector = self._assert_sync_persists_secret_lock_transaction(
			[transaction],
			1,
			1,
			{
				'transaction_type': TransactionType.SECRET_LOCK.value,
				'is_embedded': False,
				'lock_path': _secret_search_path(SIGNER_ADDRESS, SECRET),
				'owner_address': SIGNER_ADDRESS,
				'mosaic_resolutions_by_height': {1: [create_resolution_statement(
					1,
					ALIAS_MOSAIC_ID,
					[_resolution_entry(1, 0, MOSAIC_ID)])]}
			})

		# Assert:
		cursor = self.puller.symbol_db.connection.cursor()
		cursor.execute('SELECT body->>\'mosaicId\' FROM symbol_transactions')
		self.assertEqual((ALIAS_MOSAIC_ID,), cursor.fetchone())
		cursor.execute('SELECT mosaic_id FROM symbol_transaction_mosaics')
		self.assertEqual([(MOSAIC_ID,)], cursor.fetchall())
		self.assertEqual([resolution_path('mosaic', 1)], [
			path for path in connector.paths if path.startswith('statements/resolutions/')
		])

	def test_sync_block_headers_resolves_a_secret_proof_recipient_alias_without_changing_the_raw_payload(self):
		# Arrange:
		transaction = create_node_transaction(
			1,
			type=TransactionType.SECRET_PROOF.value,
			recipientAddress=ALIAS_ADDRESS,
			secret=SECRET,
			hashAlgorithm=1)

		# Act:
		connector = self._assert_sync_persists_secret_lock_transaction(
			[transaction],
			1,
			1,
			{
				'transaction_type': TransactionType.SECRET_PROOF.value,
				'is_embedded': False,
				'lock_path': _secret_only_search_path(SECRET),
				'owner_address': SIGNER_ADDRESS,
				'address_resolutions_by_height': {1: [create_resolution_statement(
					1,
					ALIAS_ADDRESS,
					[_resolution_entry(1, 0, RECIPIENT_ADDRESS)])]}
			})

		# Assert:
		cursor = self.puller.symbol_db.connection.cursor()
		cursor.execute('SELECT body->>\'recipientAddress\', encode(recipient_address, \'hex\') FROM symbol_transactions')
		self.assertEqual((ALIAS_ADDRESS, RECIPIENT_ADDRESS.lower()), cursor.fetchone())
		self.assertEqual([resolution_path('address', 1)], [
			path for path in connector.paths if path.startswith('statements/resolutions/')
		])

	def test_sync_block_headers_rejects_a_missing_hash_lock_mosaic_alias_resolution(self):
		# Arrange:
		transaction = create_node_transaction(
			1,
			type=TransactionType.HASH_LOCK.value,
			hash=LOCK_HASH,
			mosaicId=ALIAS_MOSAIC_ID,
			amount='1234')
		connector = LockConnector(
			1,
			{0: [create_node_block(1, transactions_count=1, total_transactions_count=1)]},
			transactions_by_path={transaction_path(1, 1): create_transaction_page([transaction])},
			statement_pages={statement_path(1, 1): {'data': []}})

		# Act / Assert:
		with self.assertRaisesRegex(ValueError, f'height 1.*{ALIAS_MOSAIC_ID}'):
			self._sync_with_connector(connector)

		# Assert:
		self.assertEqual([resolution_path('mosaic', 1)], [
			path for path in connector.paths if path.startswith('statements/resolutions/')
		])
		self.assertEqual([], [path for path in connector.paths if path.startswith('lock/')])
		self.assertEqual({
			'symbol_blocks': 0,
			'symbol_transactions': 0,
			'symbol_receipts': 0,
			'symbol_hash_locks': 0,
			'symbol_secret_locks': 0,
			'symbol_sync_state': 0
		}, self._fetch_lock_alias_failure_state())

	def test_sync_block_headers_rejects_a_hash_lock_mosaic_alias_surviving_resolution(self):
		# Arrange:
		transaction = create_node_transaction(
			1,
			type=TransactionType.HASH_LOCK.value,
			hash=LOCK_HASH,
			mosaicId=ALIAS_MOSAIC_ID,
			amount='1234')
		connector = LockConnector(
			1,
			{0: [create_node_block(1, transactions_count=1, total_transactions_count=1)]},
			transactions_by_path={transaction_path(1, 1): create_transaction_page([transaction])},
			mosaic_resolutions_by_height={1: [create_resolution_statement(
				1,
				ALIAS_MOSAIC_ID,
				[_resolution_entry(1, 0, 'A95F1F8A96159516')])]},
			statement_pages={statement_path(1, 1): {'data': []}})

		# Act / Assert:
		with self.assertRaisesRegex(ValueError, 'mosaic_id.*Lock'):
			self._sync_with_connector(connector)

		# Assert:
		self.assertEqual([], [path for path in connector.paths if path.startswith('lock/')])

	def test_sync_block_headers_rejects_an_inapplicable_secret_proof_recipient_alias_resolution(self):
		# Arrange:
		transaction = create_node_transaction(
			1,
			type=TransactionType.SECRET_PROOF.value,
			recipientAddress=ALIAS_ADDRESS,
			secret=SECRET,
			hashAlgorithm=1)
		connector = LockConnector(
			1,
			{0: [create_node_block(1, transactions_count=1, total_transactions_count=1)]},
			transactions_by_path={transaction_path(1, 1): create_transaction_page([transaction])},
			statement_pages={statement_path(1, 1): {'data': []}},
			address_resolutions_by_height={1: [create_resolution_statement(
				1,
				ALIAS_ADDRESS,
				[_resolution_entry(2, 0, RECIPIENT_ADDRESS)])]})

		# Act / Assert:
		with self.assertRaisesRegex(ValueError, f'entry at height 1.*{ALIAS_ADDRESS}'):
			self._sync_with_connector(connector)

		# Assert:
		self.assertEqual([resolution_path('address', 1)], [
			path for path in connector.paths if path.startswith('statements/resolutions/')
		])
		self.assertEqual([], [path for path in connector.paths if path.startswith('lock/')])
		self.assertEqual({
			'symbol_blocks': 0,
			'symbol_transactions': 0,
			'symbol_receipts': 0,
			'symbol_hash_locks': 0,
			'symbol_secret_locks': 0,
			'symbol_sync_state': 0
		}, self._fetch_lock_alias_failure_state())

	def test_sync_block_headers_replaces_all_owner_unknown_secret_proof_matches_and_preserves_siblings(self):
		# Arrange:
		other_owner = '98' + '33' * 23
		sibling_secret = '99' * 32
		existing_owner_match_hash = '44' * 32
		existing_other_owner_match_hash = '55' * 32
		node_owner_replacement_hash = '11' * 32
		node_other_owner_replacement_hash = '22' * 32
		surviving_different_secret_hash = 'FF' * 32
		target_key = create_secret_lock_search_key(
			bytes.fromhex(SIGNER_ADDRESS), bytes.fromhex(RECIPIENT_ADDRESS), bytes.fromhex(SECRET), 'hash160')
		other_owner_key = create_secret_lock_search_key(
			bytes.fromhex(other_owner), bytes.fromhex(RECIPIENT_ADDRESS), bytes.fromhex(SECRET), 'hash160')
		self.puller.symbol_db.replace_secret_locks(target_key, [create_secret_lock_row(create_secret_lock_item(
			composite_hash=existing_owner_match_hash, status=1), 1)])
		self.puller.symbol_db.replace_secret_locks(other_owner_key, [create_secret_lock_row(create_secret_lock_item(
			composite_hash=existing_other_owner_match_hash, owner_address=other_owner, status=1), 1)])
		self.puller.symbol_db.replace_secret_locks(
			create_secret_lock_search_key(
				bytes.fromhex(SIGNER_ADDRESS),
				bytes.fromhex(RECIPIENT_ADDRESS),
				bytes.fromhex(sibling_secret),
				'hash160'),
			[create_secret_lock_row(create_secret_lock_item(
				composite_hash=surviving_different_secret_hash, secret=sibling_secret), 1)])
		proof_transaction = create_node_transaction(
			1,
			type=TransactionType.SECRET_PROOF.value,
			secret=SECRET,
			hashAlgorithm=1)
		first_match = create_secret_lock_item(
			composite_hash=node_owner_replacement_hash, owner_address=SIGNER_ADDRESS, status=1)
		second_match = create_secret_lock_item(
			composite_hash=node_other_owner_replacement_hash, owner_address=other_owner, status=1)
		connector = LockConnector(
			1,
			{0: [create_node_block(1, transactions_count=1, total_transactions_count=1)]},
			secret_responses={_secret_only_search_path(SECRET): {'data': [
				first_match,
				second_match,
				create_secret_lock_item(composite_hash='33' * 32, recipientAddress='98' + '44' * 23),
				create_secret_lock_item(composite_hash='66' * 32, secret='77' * 32),
				create_secret_lock_item(composite_hash='88' * 32, hashAlgorithm=0)
			]}},
			transactions_by_path={transaction_path(1, 1): create_transaction_page([proof_transaction])},
			statement_pages={statement_path(1, 1): {'data': []}})
		expected_rows = [
			create_expected_secret_lock_row(
				first_match, 1, bytes.fromhex(node_owner_replacement_hash), bytes.fromhex(SIGNER_ADDRESS),
				bytes.fromhex(RECIPIENT_ADDRESS), bytes.fromhex(SECRET), 'hash160', MOSAIC_ID, 1234, 100, 'used'),
			create_expected_secret_lock_row(
				second_match, 1, bytes.fromhex(node_other_owner_replacement_hash), bytes.fromhex(other_owner),
				bytes.fromhex(RECIPIENT_ADDRESS), bytes.fromhex(SECRET), 'hash160', MOSAIC_ID, 1234, 100, 'used'),
			create_expected_secret_lock_row(
				create_secret_lock_item(
					composite_hash=surviving_different_secret_hash,
					secret=sibling_secret),
				1,
				bytes.fromhex(surviving_different_secret_hash),
				bytes.fromhex(SIGNER_ADDRESS), bytes.fromhex(RECIPIENT_ADDRESS), bytes.fromhex(sibling_secret), 'hash160',
				MOSAIC_ID, 1234, 100, 'unused')
		]

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		self.assertEqual(([], expected_rows), self._fetch_persisted_lock_state())
		self.assertEqual([_secret_only_search_path(SECRET)], [
			path for path in connector.paths if path.startswith('lock/')
		])

	def test_sync_block_headers_refreshes_a_rollback_affected_hash_lock_from_a_current_row_key(self):
		# Arrange:
		# The local block 2 hash differs from the node block 2 hash, which triggers rollback repair.
		self._seed_blocks(self.puller.symbol_db, [1, 2], {2: b'local mismatch'.hex()})
		self.puller.symbol_db.upsert_sync_state(create_sync_state(
			chain_height=2,
			last_synced_height=2,
			last_synced_block_hash=bytes.fromhex('02' * 32)))
		self.puller.symbol_db.upsert_hash_lock(create_hash_lock_row(create_hash_lock_item(), 2))
		connector = LockConnector(
			2,
			{1: [create_node_block(2)]},
			{2: create_node_block(2)},
			hash_responses={'lock/hash/' + LOCK_HASH: create_hash_lock_item(status=1)},
			transactions_by_path={transaction_path(2, 2): create_transaction_page([])},
			statement_pages={statement_path(2, 2): {'data': []}})
		expected_row = {
			'hash': bytes.fromhex(LOCK_HASH),
			'owner_address': bytes.fromhex(SIGNER_ADDRESS),
			'mosaic_id': MOSAIC_ID,
			'amount': 1234,
			'end_height': 100,
			'status': 'used',
			'raw_payload': create_hash_lock_item(status=1),
			'updated_at_height': 1
		}

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		self.assertEqual(([expected_row], []), self._fetch_persisted_lock_state())
		self.assertEqual([1, 2], self._fetch_block_heights(self.puller.symbol_db))
		self.assertEqual(bytes.fromhex(f'{2:064X}'), self._fetch_block_hash(self.puller.symbol_db, 2))
		self.assertEqual(create_sync_state(
			chain_height=2,
			finalized_height=1,
			finalized_hash=bytes.fromhex(f'{1:064X}'),
			finalized_epoch=4,
			finalized_point=5,
			last_synced_height=2,
			last_synced_block_hash=bytes.fromhex(f'{2:064X}')),
			fetch_normalized_sync_state(self.puller.symbol_db))
		self.assertEqual(['lock/hash/' + LOCK_HASH], [
			path for path in connector.paths if path.startswith('lock/')
		])

	def test_sync_block_headers_refreshes_a_rollback_affected_secret_lock_from_a_current_row_key(self):
		# Arrange:
		# The local block 2 hash differs from the node block 2 hash, which triggers rollback repair.
		self._seed_blocks(self.puller.symbol_db, [1, 2], {2: b'local mismatch'.hex()})
		self.puller.symbol_db.upsert_sync_state(create_sync_state(
			chain_height=2,
			last_synced_height=2,
			last_synced_block_hash=bytes.fromhex('02' * 32)))
		secret_key = create_secret_lock_search_key(
			bytes.fromhex(SIGNER_ADDRESS), bytes.fromhex(RECIPIENT_ADDRESS), bytes.fromhex(SECRET), 'hash160')
		self.puller.symbol_db.replace_secret_locks(
			secret_key, [create_secret_lock_row(create_secret_lock_item(), 2)])
		path = _secret_search_path(SIGNER_ADDRESS, SECRET)
		connector = LockConnector(
			2,
			{1: [create_node_block(2)]},
			{2: create_node_block(2)},
			secret_responses={path: {'data': [create_secret_lock_item(status=1)]}},
			transactions_by_path={transaction_path(2, 2): create_transaction_page([])},
			statement_pages={statement_path(2, 2): {'data': []}})
		expected_row = create_expected_secret_lock_row(
			create_secret_lock_item(status=1),
			1,
			composite_hash=bytes.fromhex(COMPOSITE_HASH),
			owner_address=bytes.fromhex(SIGNER_ADDRESS),
			recipient_address=bytes.fromhex(RECIPIENT_ADDRESS),
			secret=bytes.fromhex(SECRET),
			hash_algorithm='hash160',
			mosaic_id=MOSAIC_ID,
			amount=1234,
			end_height=100,
			status='used')

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		self.assertEqual(([], [expected_row]), self._fetch_persisted_lock_state())
		self.assertEqual([1, 2], self._fetch_block_heights(self.puller.symbol_db))
		self.assertEqual(bytes.fromhex(f'{2:064X}'), self._fetch_block_hash(self.puller.symbol_db, 2))
		self.assertEqual(create_sync_state(
			chain_height=2,
			finalized_height=1,
			finalized_hash=bytes.fromhex(f'{1:064X}'),
			finalized_epoch=4,
			finalized_point=5,
			last_synced_height=2,
			last_synced_block_hash=bytes.fromhex(f'{2:064X}')),
			fetch_normalized_sync_state(self.puller.symbol_db))
		self.assertEqual([path], [path for path in connector.paths if path.startswith('lock/')])

	def test_sync_block_headers_deletes_fork_only_hash_and_secret_locks_from_current_row_keys(self):  # pylint: disable=too-many-locals
		# Arrange:
		self._seed_blocks(self.puller.symbol_db, [1, 2], {2: b'local mismatch'.hex()})
		self.puller.symbol_db.upsert_sync_state(create_sync_state(
			chain_height=2,
			last_synced_height=2,
			last_synced_block_hash=bytes.fromhex('02' * 32)))
		survivor_hash_item = create_hash_lock_item()
		fork_hash_item = create_hash_lock_item(lock_hash=LOCK_HASH_2)
		self.puller.symbol_db.upsert_hash_lock(create_hash_lock_row(survivor_hash_item, 1))
		self.puller.symbol_db.upsert_hash_lock(create_hash_lock_row(fork_hash_item, 2))
		other_owner = '98' + '33' * 23
		fork_secret = '99' * 32
		survivor_secret_item = create_secret_lock_item()
		fork_secret_item = create_secret_lock_item(
			composite_hash=COMPOSITE_HASH_2,
			owner_address=other_owner,
			secret=fork_secret)
		survivor_secret_key = create_secret_lock_search_key(
			bytes.fromhex(SIGNER_ADDRESS), bytes.fromhex(RECIPIENT_ADDRESS), bytes.fromhex(SECRET), 'hash160')
		fork_secret_key = create_secret_lock_search_key(
			bytes.fromhex(other_owner), bytes.fromhex(RECIPIENT_ADDRESS), bytes.fromhex(fork_secret), 'hash160')
		self.puller.symbol_db.replace_secret_locks(
			survivor_secret_key, [create_secret_lock_row(survivor_secret_item, 1)])
		self.puller.symbol_db.replace_secret_locks(
			fork_secret_key, [create_secret_lock_row(fork_secret_item, 2)])
		fork_hash_path = 'lock/hash/' + LOCK_HASH_2
		fork_secret_path = _secret_search_path(other_owner, fork_secret)
		connector = LockConnector(
			2,
			{1: [create_node_block(2)]},
			{2: create_node_block(2)},
			hash_responses={fork_hash_path: {'code': 'ResourceNotFound', 'message': 'not found'}},
			secret_responses={fork_secret_path: {'data': []}},
			transactions_by_path={transaction_path(2, 2): create_transaction_page([])},
			statement_pages={statement_path(2, 2): {'data': []}})
		expected_survivor_hash = create_hash_lock_row(survivor_hash_item, 1)
		expected_survivor_secret = create_expected_secret_lock_row(
			survivor_secret_item,
			1,
			composite_hash=bytes.fromhex(COMPOSITE_HASH),
			owner_address=bytes.fromhex(SIGNER_ADDRESS),
			recipient_address=bytes.fromhex(RECIPIENT_ADDRESS),
			secret=bytes.fromhex(SECRET),
			hash_algorithm='hash160',
			mosaic_id=MOSAIC_ID,
			amount=1234,
			end_height=100,
			status='unused')

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		self.assertEqual((
			[expected_survivor_hash],
			[expected_survivor_secret]
		), self._fetch_persisted_lock_state())
		self.assertEqual([fork_hash_path, fork_secret_path], [
			path for path in connector.paths if path.startswith('lock/')])
		self.assertEqual([1, 2], self._fetch_block_heights(self.puller.symbol_db))
		self.assertEqual(bytes.fromhex(f'{2:064X}'), self._fetch_block_hash(self.puller.symbol_db, 2))
		self.assertEqual(create_sync_state(
			chain_height=2,
			finalized_height=1,
			finalized_hash=bytes.fromhex(f'{1:064X}'),
			finalized_epoch=4,
			finalized_point=5,
			last_synced_height=2,
			last_synced_block_hash=bytes.fromhex(f'{2:064X}')),
			fetch_normalized_sync_state(self.puller.symbol_db))

	def test_sync_block_headers_keeps_all_rollback_state_unchanged_when_hash_lock_replacement_fetch_fails(self):
		# Arrange:
		self._seed_rollback_batch_state()
		original_state = self._fetch_complete_batch_state()
		connector = LockConnector(
			2,
			{1: [create_node_block(2)]},
			{2: create_node_block(2)},
			hash_responses={'lock/hash/' + LOCK_HASH: RuntimeError('rollback lock fetch failed')})

		# Act / Assert:
		with self.assertRaisesRegex(RuntimeError, '^rollback lock fetch failed$'):
			self._sync_with_connector(connector)

		# Assert:
		self.assertEqual(original_state, self._fetch_complete_batch_state())
		self.assertEqual(['lock/hash/' + LOCK_HASH], [
			path for path in connector.paths if path.startswith('lock/')])

	def test_sync_block_headers_keeps_all_rollback_state_unchanged_when_secret_lock_replacement_fetch_fails(self):
		# Arrange:
		self._seed_rollback_batch_state()
		original_state = self._fetch_complete_batch_state()
		secret_path = _secret_search_path(SIGNER_ADDRESS, SECRET)
		connector = LockConnector(
			2,
			{1: [create_node_block(2)]},
			{2: create_node_block(2)},
			hash_responses={'lock/hash/' + LOCK_HASH: create_hash_lock_item()},
			secret_responses={secret_path: RuntimeError('rollback secret lock fetch failed')})

		# Act / Assert:
		with self.assertRaisesRegex(RuntimeError, '^rollback secret lock fetch failed$'):
			self._sync_with_connector(connector)

		# Assert:
		self.assertEqual(original_state, self._fetch_complete_batch_state())
		self.assertEqual(['lock/hash/' + LOCK_HASH, secret_path], [
			path for path in connector.paths if path.startswith('lock/')])

	def test_sync_block_headers_does_not_partially_write_when_lock_fetch_fails(self):
		# Arrange:
		transaction = create_node_transaction(
			1,
			transaction_hash='01' * 32,
			type=TransactionType.HASH_LOCK.value,
			hash=LOCK_HASH,
			mosaicId=MOSAIC_ID,
			amount='1234')
		connector = LockConnector(
			1,
			{0: [create_node_block(1, transactions_count=1, total_transactions_count=1)]},
			hash_responses={'lock/hash/' + LOCK_HASH: RuntimeError('lock fetch failed')},
			transactions_by_path={transaction_path(1, 1): create_transaction_page([transaction])},
			statement_pages={statement_path(1, 1): {'data': []}})

		# Act / Assert:
		self._assert_sync_failure_preserves_complete_batch_state(
			connector, RuntimeError, '^lock fetch failed$')

	def test_sync_block_headers_does_not_partially_write_when_secret_lock_fetch_fails(self):
		# Arrange:
		transaction = create_node_transaction(
			1,
			transaction_hash='01' * 32,
			type=TransactionType.SECRET_LOCK.value,
			secret=SECRET,
			hashAlgorithm=1,
			mosaicId=MOSAIC_ID,
			amount='1234')
		path = _secret_search_path(SIGNER_ADDRESS, SECRET)
		connector = LockConnector(
			1,
			{0: [create_node_block(1, transactions_count=1, total_transactions_count=1)]},
			secret_responses={path: RuntimeError('secret lock fetch failed')},
			transactions_by_path={transaction_path(1, 1): create_transaction_page([transaction])},
			statement_pages={statement_path(1, 1): {'data': []}})

		# Act / Assert:
		self._assert_sync_failure_preserves_complete_batch_state(
			connector, RuntimeError, '^secret lock fetch failed$')

	def test_sync_block_headers_does_not_write_a_successful_hash_lock_when_a_later_secret_lock_fetch_fails(self):
		# Arrange:
		hash_transaction = create_node_transaction(
			1, transaction_hash='01' * 32, type=TransactionType.HASH_LOCK.value,
			hash=LOCK_HASH, mosaicId=MOSAIC_ID, amount='1234')
		secret_transaction = create_node_transaction(
			1, transaction_hash='02' * 32, type=TransactionType.SECRET_LOCK.value,
			secret=SECRET, hashAlgorithm=1, mosaicId=MOSAIC_ID, amount='1234')
		secret_path = _secret_search_path(SIGNER_ADDRESS, SECRET)
		connector = LockConnector(
			1,
			{0: [create_node_block(1, transactions_count=2, total_transactions_count=2)]},
			hash_responses={'lock/hash/' + LOCK_HASH: create_hash_lock_item()},
			secret_responses={secret_path: RuntimeError('secret lock fetch failed')},
			transactions_by_path={transaction_path(1, 1): create_transaction_page([hash_transaction, secret_transaction])},
			statement_pages={statement_path(1, 1): {'data': []}})

		# Act / Assert:
		self._assert_sync_failure_preserves_complete_batch_state(
			connector, RuntimeError, '^secret lock fetch failed$')

		# Assert:
		self.assertEqual(['lock/hash/' + LOCK_HASH, secret_path], [path for path in connector.paths if path.startswith('lock/')])

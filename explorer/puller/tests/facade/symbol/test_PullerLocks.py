# pylint: disable=too-many-lines,too-many-public-methods
import asyncio
import copy

from symbolchain.sc import TransactionType
from symbolchain.symbol.Network import Address

from puller.facade.SymbolPuller import LOCK_FETCH_CONCURRENCY
from puller.model.symbol.Lock import (
	create_hash_lock_key_from_hex,
	create_hash_lock_row,
	create_secret_lock_row,
	create_secret_lock_search_key
)
from tests.test.SymbolDatabaseTestUtils import fetch_full_block_state, fetch_normalized_sync_state
from tests.test.SymbolLockTestUtils import create_expected_secret_lock_row
from tests.test.SymbolLockTestUtils import create_secret_lock_item as create_secret_lock_item_fixture
from tests.test.SymbolMetadataTestUtils import create_expected_metadata_row, create_metadata_item, fetch_metadata_rows
from tests.test.SymbolMosaicTestUtils import create_expected_mosaic_row, create_mosaic_item, fetch_mosaic_state
from tests.test.SymbolNamespaceTestUtils import NAMESPACE_ROOT_ID, create_namespace_item, fetch_namespace_state, seed_namespace
from tests.test.SymbolTestConstants import RECIPIENT_ADDRESS, SIGNER_ADDRESS

from ...test.SymbolTransactionTestUtils import create_transaction_entry
from .puller_test_utils import (
	FakeConnector,
	SymbolPullerTestBase,
	create_node_block,
	create_node_transaction,
	create_sync_state,
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
		recipient_address=RECIPIENT_ADDRESS,
		secret=secret,
		hash_algorithm=1,
		mosaic_id=MOSAIC_ID,
		amount='1234',
		end_height='100',
		status=0,
		item_id='secret-lock',
		lock_overrides=overrides)


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
	def __init__(self, *args, **kwargs):
		super().__init__(*args, **kwargs)
		self.in_flight_lock_requests = 0
		self.max_in_flight_lock_requests = 0
		self._requests_released = asyncio.Event()
		self._release_scheduled = False

	async def get(self, url_path, *args):
		if not url_path.startswith('lock/secret?'):
			return await super().get(url_path, *args)

		self.paths.append(url_path)
		self.in_flight_lock_requests += 1
		self.max_in_flight_lock_requests = max(
			self.max_in_flight_lock_requests,
			self.in_flight_lock_requests)
		try:
			if not self._release_scheduled:
				self._release_scheduled = True
				asyncio.get_running_loop().call_soon(self._requests_released.set)
			await self._requests_released.wait()
			response = self.secret_responses.get(url_path, {'data': []})
			if isinstance(response, Exception):
				raise response
			return response
		finally:
			self.in_flight_lock_requests -= 1


def _secret_search_path(owner_address, secret, page_number=1):
	return (
		f'lock/secret?address={Address(bytes.fromhex(owner_address))}&secret={secret}'
		f'&pageSize=100&pageNumber={page_number}'
	)


def _secret_only_search_path(secret, page_number=1):
	return f'lock/secret?secret={secret}&pageSize=100&pageNumber={page_number}'


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
			[{'height': 10}], {10: transaction_rows})

	def _fetch_complete_rollback_state(self):
		cursor = self.puller.symbol_db.connection.cursor()
		cursor.execute('SELECT * FROM symbol_transactions ORDER BY height, id')
		transactions = [
			tuple(bytes(value) if isinstance(value, memoryview) else value for value in row)
			for row in cursor.fetchall()
		]
		cursor.execute('SELECT * FROM symbol_receipts ORDER BY height, id')
		receipts = [
			tuple(bytes(value) if isinstance(value, memoryview) else value for value in row)
			for row in cursor.fetchall()
		]
		cursor.execute('SELECT * FROM symbol_hash_locks ORDER BY hash')
		hash_locks = [
			tuple(bytes(value) if isinstance(value, memoryview) else value for value in row)
			for row in cursor.fetchall()
		]
		cursor.execute('SELECT * FROM symbol_secret_locks ORDER BY composite_hash')
		secret_locks = [
			tuple(bytes(value) if isinstance(value, memoryview) else value for value in row)
			for row in cursor.fetchall()
		]
		return {
			'blocks': fetch_full_block_state(self.puller.symbol_db),
			'transactions': transactions,
			'receipts': receipts,
			'namespace': fetch_namespace_state(self.puller.symbol_db.connection),
			'mosaic': fetch_mosaic_state(self.puller.symbol_db),
			'metadata': fetch_metadata_rows(self.puller.symbol_db),
			'hash_locks': hash_locks,
			'secret_locks': secret_locks,
			'sync_state': fetch_normalized_sync_state(self.puller.symbol_db)
		}

	def test_fetch_hash_lock_success_returns_a_complete_upsert_entry(self):
		# Arrange:
		item = create_hash_lock_item()
		connector = LockConnector(
			hash_responses={'lock/hash/' + LOCK_HASH: item})
		set_symbol_connector(self.puller, connector)
		key = create_hash_lock_key_from_hex(LOCK_HASH)

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
				'raw_payload': item,
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
		key = create_hash_lock_key_from_hex(LOCK_HASH)

		# Act:
		entries = asyncio.run(self.puller._fetch_dirty_hash_locks([key], 12))  # pylint: disable=protected-access
		self.puller.symbol_db.upsert_hash_lock(create_hash_lock_row(create_hash_lock_item(), 12))
		self.puller._write_dirty_hash_locks(entries)  # pylint: disable=protected-access

		# Assert:
		self.assertEqual([{'hash': key}], entries)
		cursor = self.puller.symbol_db.connection.cursor()
		cursor.execute('SELECT COUNT(*) FROM symbol_hash_locks')
		self.assertEqual(0, cursor.fetchone()[0])

	def test_fetch_hash_lock_rejects_a_mismatched_response(self):
		# Arrange:
		connector = LockConnector(hash_responses={
			'lock/hash/' + LOCK_HASH: create_hash_lock_item(lock_hash=LOCK_HASH_2)
		})
		set_symbol_connector(self.puller, connector)

		# Act / Assert:
		with self.assertRaisesRegex(ValueError, '^Symbol Hash Lock response hash does not match dirty key$'):
			asyncio.run(self.puller._fetch_dirty_hash_locks(  # pylint: disable=protected-access
				[create_hash_lock_key_from_hex(LOCK_HASH)], 12))

	def _assert_sync_rejects_malformed_hash_lock_response(self, response):
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
			{0: [create_node_block(1)]},
			hash_responses={'lock/hash/' + LOCK_HASH: response},
			transactions_by_path={transaction_path(1, 1): {'data': [transaction]}},
			statement_pages={statement_path(1, 1): {'data': []}})

		# Act / Assert:
		with self.assertRaises(ValueError):
			self._sync_with_connector(connector)

		# Assert:
		cursor = self.puller.symbol_db.connection.cursor()
		for table_name in ('symbol_blocks', 'symbol_transactions', 'symbol_receipts', 'symbol_hash_locks', 'symbol_secret_locks'):
			cursor.execute(f'SELECT COUNT(*) FROM {table_name}')
			self.assertEqual(0, cursor.fetchone()[0], table_name)
		self.assertIsNone(self.puller.symbol_db.get_sync_state())

	def test_sync_block_headers_rejects_non_dict_hash_lock_response_without_writes(self):
		self._assert_sync_rejects_malformed_hash_lock_response([])

	def test_sync_block_headers_rejects_hash_lock_response_without_lock_wrapper_without_writes(self):
		self._assert_sync_rejects_malformed_hash_lock_response({})

	def test_sync_block_headers_rejects_hash_lock_response_with_non_dict_lock_without_writes(self):
		self._assert_sync_rejects_malformed_hash_lock_response({'lock': []})

	def test_sync_block_headers_rejects_hash_lock_response_with_invalid_required_field_without_writes(self):
		self._assert_sync_rejects_malformed_hash_lock_response(create_hash_lock_item(hash='GG' * 32))

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
			{0: [create_node_block(1)]},
			secret_responses={path: response},
			transactions_by_path={transaction_path(1, 1): {'data': [transaction]}},
			statement_pages={statement_path(1, 1): {'data': []}})

		# Act / Assert:
		with self.assertRaisesRegex(ValueError, expected_error):
			self._sync_with_connector(connector)

		# Assert:
		cursor = self.puller.symbol_db.connection.cursor()
		for table_name in ('symbol_blocks', 'symbol_transactions', 'symbol_receipts', 'symbol_hash_locks', 'symbol_secret_locks'):
			cursor.execute(f'SELECT COUNT(*) FROM {table_name}')
			self.assertEqual(0, cursor.fetchone()[0], table_name)
		self.assertIsNone(self.puller.symbol_db.get_sync_state())
		self.assertEqual([path], [request_path for request_path in connector.paths if request_path.startswith('lock/')])

	def test_sync_block_headers_rejects_non_dict_secret_lock_search_response_without_writes(self):
		self._assert_sync_rejects_malformed_secret_lock_response([], '^Malformed Symbol Secret Lock search response$')

	def test_sync_block_headers_rejects_secret_lock_search_response_without_data_without_writes(self):
		self._assert_sync_rejects_malformed_secret_lock_response({}, '^Malformed Symbol Secret Lock search response$')

	def test_sync_block_headers_rejects_secret_lock_search_response_with_non_list_data_without_writes(self):
		self._assert_sync_rejects_malformed_secret_lock_response({'data': {}}, '^Malformed Symbol Secret Lock search response$')

	def test_sync_block_headers_rejects_secret_lock_search_response_with_malformed_item_without_writes(self):
		self._assert_sync_rejects_malformed_secret_lock_response({'data': [{}]}, '^Malformed Symbol Secret Lock response$')

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

	def test_lock_fetch_concurrency_is_the_approved_ten_request_node_bound(self):
		# Act:
		concurrency = LOCK_FETCH_CONCURRENCY

		# Assert:
		self.assertEqual(10, concurrency)

	def test_fetch_secret_locks_uses_bounded_gather_for_more_than_one_chunk(self):
		# Arrange:
		keys = []
		responses = {}
		for index in range(11):
			secret = f'{index + 1:064X}'
			key = create_secret_lock_search_key(
				bytes.fromhex(SIGNER_ADDRESS), bytes.fromhex(RECIPIENT_ADDRESS), bytes.fromhex(secret), 'hash160')
			keys.append(key)
			responses[_secret_search_path(SIGNER_ADDRESS, secret)] = {
				'data': [create_secret_lock_item(
					composite_hash=f'{index + 1:064X}', secret=secret)]}
		connector = BoundedLockConnector(secret_responses=responses)
		set_symbol_connector(self.puller, connector)

		# Act:
		entries = asyncio.run(self.puller._fetch_dirty_secret_locks(keys, 12))  # pylint: disable=protected-access

		# Assert:
		self.assertLess(LOCK_FETCH_CONCURRENCY, len(keys))
		self.assertEqual(LOCK_FETCH_CONCURRENCY, connector.max_in_flight_lock_requests)
		self.assertEqual(11, len(entries))
		self.assertEqual(11, len(connector.paths))

	def test_fetch_secret_locks_preserves_non_sorted_first_encounter_key_order(self):
		# Arrange:
		secrets = [f'{3:064X}', f'{1:064X}', f'{11:064X}', f'{2:064X}']
		keys = [
			create_secret_lock_search_key(
				bytes.fromhex(SIGNER_ADDRESS), bytes.fromhex(RECIPIENT_ADDRESS), bytes.fromhex(secret), 'hash160')
			for secret in secrets
		]
		connector = LockConnector(secret_responses={
			_secret_search_path(SIGNER_ADDRESS, secret): {
				'data': [create_secret_lock_item(composite_hash=secret, secret=secret)]
			}
			for secret in secrets
		})
		set_symbol_connector(self.puller, connector)

		# Act:
		entries = asyncio.run(self.puller._fetch_dirty_secret_locks(keys, 12))  # pylint: disable=protected-access

		# Assert:
		self.assertEqual([
			(bytes.fromhex(SIGNER_ADDRESS), bytes.fromhex(RECIPIENT_ADDRESS), bytes.fromhex(f'{3:064X}'), 'hash160'),
			(bytes.fromhex(SIGNER_ADDRESS), bytes.fromhex(RECIPIENT_ADDRESS), bytes.fromhex(f'{1:064X}'), 'hash160'),
			(bytes.fromhex(SIGNER_ADDRESS), bytes.fromhex(RECIPIENT_ADDRESS), bytes.fromhex(f'{11:064X}'), 'hash160'),
			(bytes.fromhex(SIGNER_ADDRESS), bytes.fromhex(RECIPIENT_ADDRESS), bytes.fromhex(f'{2:064X}'), 'hash160')
		], [entry['key'] for entry in entries])

	def test_collect_dirty_lock_keys_uses_hash_lock_body_hash(self):
		# Arrange:
		transaction_row = self._create_lock_transaction_row(
			TransactionType.HASH_LOCK.value, {'hash': LOCK_HASH_2})

		# Act:
		keys = self._collect_lock_keys([transaction_row])

		# Assert:
		self.assertEqual([bytes.fromhex(LOCK_HASH_2)], [key.hash for key in keys.hash_keys])
		self.assertEqual([], keys.secret_keys)

	def test_collect_dirty_lock_keys_uses_top_level_aggregate_bonded_hash(self):
		# Arrange:
		top_level = self._create_lock_transaction_row(
			TransactionType.AGGREGATE_BONDED.value, {}, hash=bytes.fromhex(LOCK_HASH_2))

		# Act:
		keys = self._collect_lock_keys([top_level])

		# Assert:
		self.assertEqual([bytes.fromhex(LOCK_HASH_2)], [key.hash for key in keys.hash_keys])
		self.assertEqual([], keys.secret_keys)

	def test_collect_dirty_lock_keys_excludes_embedded_aggregate_bonded_hash(self):
		# Arrange:
		embedded = self._create_lock_transaction_row(
			TransactionType.AGGREGATE_BONDED.value, {}, is_embedded=True, hash=bytes.fromhex(LOCK_HASH_2))

		# Act:
		keys = self._collect_lock_keys([embedded])

		# Assert:
		self.assertEqual([], keys.hash_keys)
		self.assertEqual([], keys.secret_keys)

	def test_collect_dirty_lock_keys_uses_resolved_secret_lock_recipient(self):
		# Arrange:
		transaction_row = self._create_lock_transaction_row(
			TransactionType.SECRET_LOCK.value,
			{'secret': SECRET, 'hashAlgorithm': 1, 'recipientAddress': '99065A28385EB5AE88000000000000000000000000000000'})

		# Act:
		keys = self._collect_lock_keys([transaction_row])

		# Assert:
		self.assertEqual([], keys.hash_keys)
		self.assertEqual([(
			bytes.fromhex(SIGNER_ADDRESS), bytes.fromhex(RECIPIENT_ADDRESS), bytes.fromhex(SECRET), 'hash160'
		)], keys.secret_keys)

	def test_collect_dirty_lock_keys_uses_secret_proof_with_unknown_owner(self):
		# Arrange:
		transaction_row = self._create_lock_transaction_row(
			TransactionType.SECRET_PROOF.value, {'secret': SECRET, 'hashAlgorithm': 0})

		# Act:
		keys = self._collect_lock_keys([transaction_row])

		# Assert:
		self.assertEqual([], keys.hash_keys)
		self.assertEqual([(None, bytes.fromhex(RECIPIENT_ADDRESS), bytes.fromhex(SECRET), 'sha3_256')], keys.secret_keys)

	def test_collect_dirty_lock_keys_ignores_unrelated_transaction_type(self):
		# Arrange:
		unrelated = self._create_lock_transaction_row(TransactionType.TRANSFER.value, {})

		# Act:
		keys = self._collect_lock_keys([unrelated])

		# Assert:
		self.assertEqual(([], []), (keys.hash_keys, keys.secret_keys))

	def test_collect_dirty_lock_keys_accepts_empty_transaction_input(self):
		# Arrange:
		transaction_rows = []

		# Act:
		keys = self._collect_lock_keys(transaction_rows)

		# Assert:
		self.assertEqual(([], []), (keys.hash_keys, keys.secret_keys))

	def test_collect_dirty_lock_keys_deduplicates_hash_keys_in_first_encounter_order(self):
		# Arrange:
		first = self._create_lock_transaction_row(TransactionType.HASH_LOCK.value, {'hash': LOCK_HASH_2})
		second = self._create_lock_transaction_row(TransactionType.HASH_LOCK.value, {'hash': LOCK_HASH})
		duplicate = self._create_lock_transaction_row(TransactionType.HASH_LOCK.value, {'hash': LOCK_HASH_2})

		# Act:
		keys = self._collect_lock_keys([first, second, duplicate])

		# Assert:
		self.assertEqual([bytes.fromhex(LOCK_HASH_2), bytes.fromhex(LOCK_HASH)], [key.hash for key in keys.hash_keys])

	def test_collect_dirty_lock_keys_deduplicates_secret_keys_in_first_encounter_order(self):
		# Arrange:
		first = self._create_lock_transaction_row(TransactionType.SECRET_PROOF.value, {'secret': SECRET, 'hashAlgorithm': 0})
		second = self._create_lock_transaction_row(TransactionType.SECRET_LOCK.value, {'secret': SECRET, 'hashAlgorithm': 1})
		duplicate = self._create_lock_transaction_row(TransactionType.SECRET_PROOF.value, {'secret': SECRET, 'hashAlgorithm': 0})

		# Act:
		keys = self._collect_lock_keys([first, second, duplicate])

		# Assert:
		self.assertEqual([
			(None, bytes.fromhex(RECIPIENT_ADDRESS), bytes.fromhex(SECRET), 'sha3_256'),
			(bytes.fromhex(SIGNER_ADDRESS), bytes.fromhex(RECIPIENT_ADDRESS), bytes.fromhex(SECRET), 'hash160')
		], keys.secret_keys)

	def test_collect_dirty_lock_keys_includes_hash_lock_expiry_key(self):
		# Arrange:
		self.puller.symbol_db.upsert_hash_lock(create_hash_lock_row(create_hash_lock_item(endHeight='10'), 1))

		# Act:
		keys = self._collect_lock_keys([])

		# Assert:
		self.assertEqual([bytes.fromhex(LOCK_HASH)], [key.hash for key in keys.hash_keys])
		self.assertEqual([], keys.secret_keys)

	def test_collect_dirty_lock_keys_includes_secret_lock_expiry_key(self):
		# Arrange:
		key = create_secret_lock_search_key(
			bytes.fromhex(SIGNER_ADDRESS), bytes.fromhex(RECIPIENT_ADDRESS), bytes.fromhex(SECRET), 'hash160')
		self.puller.symbol_db.replace_secret_locks(
			key, [create_secret_lock_row(create_secret_lock_item(endHeight='10'), 1)])

		# Act:
		keys = self._collect_lock_keys([])

		# Assert:
		self.assertEqual([], keys.hash_keys)
		self.assertEqual([key], keys.secret_keys)

	def test_collect_dirty_lock_keys_deduplicates_transaction_and_expiry_hash_key(self):
		# Arrange:
		self.puller.symbol_db.upsert_hash_lock(create_hash_lock_row(create_hash_lock_item(endHeight='10'), 1))
		transaction_row = self._create_lock_transaction_row(TransactionType.HASH_LOCK.value, {'hash': LOCK_HASH})

		# Act:
		keys = self._collect_lock_keys([transaction_row])

		# Assert:
		self.assertEqual([bytes.fromhex(LOCK_HASH)], [key.hash for key in keys.hash_keys])

	def test_collect_dirty_lock_keys_deduplicates_transaction_and_expiry_secret_key(self):
		# Arrange:
		key = create_secret_lock_search_key(
			bytes.fromhex(SIGNER_ADDRESS), bytes.fromhex(RECIPIENT_ADDRESS), bytes.fromhex(SECRET), 'hash160')
		self.puller.symbol_db.replace_secret_locks(
			key, [create_secret_lock_row(create_secret_lock_item(endHeight='10'), 1)])
		transaction_row = self._create_lock_transaction_row(
			TransactionType.SECRET_LOCK.value, {'secret': SECRET, 'hashAlgorithm': 1})

		# Act:
		keys = self._collect_lock_keys([transaction_row])

		# Assert:
		self.assertEqual([key], keys.secret_keys)

	def test_collect_dirty_lock_keys_rejects_surviving_alias_recipient(self):
		# Arrange:
		alias_address = bytes.fromhex('99065A28385EB5AE88000000000000000000000000000000')
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
				[{'height': 1}], {1: [transaction_row]})

	@staticmethod
	def _create_lock_sync_connector():
		hash_transaction = create_node_transaction(
			1,
			transaction_hash='01' * 32,
			type=TransactionType.HASH_LOCK.value,
			hash=LOCK_HASH,
			mosaicId=MOSAIC_ID,
			amount='1234')
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
			{0: [create_node_block(1)]},
			hash_responses={'lock/hash/' + LOCK_HASH: create_hash_lock_item()},
			secret_responses={_secret_search_path(SIGNER_ADDRESS, SECRET): {
				'data': [create_secret_lock_item()]}},
			transactions_by_path={transaction_path(1, 1): {'data': [hash_transaction, secret_transaction]}},
			statement_pages={statement_path(1, 1): {'data': []}})

	@staticmethod
	def _expected_persisted_lock_state():
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
		}], [create_expected_secret_lock_row(
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

	def test_sync_block_headers_persists_hash_and_secret_locks(self):
		# Arrange:
		connector = self._create_lock_sync_connector()
		expected_lock_state = self._expected_persisted_lock_state()

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		self.assertEqual(expected_lock_state, self._fetch_persisted_lock_state())

	def test_sync_block_headers_converges_hash_and_secret_locks_when_restarted_from_existing_blocks(self):
		# Arrange:
		connector = self._create_lock_sync_connector()
		expected_lock_state = self._expected_persisted_lock_state()
		self._sync_with_connector(connector)
		cursor = self.puller.symbol_db.connection.cursor()
		cursor.execute('DELETE FROM symbol_sync_state')
		self.puller.symbol_db.connection.commit()

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		self.assertEqual(expected_lock_state, self._fetch_persisted_lock_state())

	def test_sync_block_headers_restores_a_deleted_hash_lock_from_rollback_transaction_key(self):
		# Arrange:
		self._seed_blocks(self.puller.symbol_db, [1, 2], {2: b'local mismatch'.hex()})
		self.puller.symbol_db.upsert_sync_state(create_sync_state(
			chain_height=2,
			last_synced_height=2,
			last_synced_block_hash=bytes.fromhex('02' * 32)))
		transaction = create_transaction_entry(
			2,
			'rollback-hash-lock',
			type=TransactionType.HASH_LOCK.value,
			body={'hash': LOCK_HASH})
		self.puller.symbol_db.upsert_transactions_for_height(2, [transaction])
		self.puller.symbol_db.upsert_hash_lock(create_hash_lock_row(create_hash_lock_item(), 2))
		self.puller.symbol_db.delete_hash_lock(create_hash_lock_key_from_hex(LOCK_HASH))
		cursor = self.puller.symbol_db.connection.cursor()
		cursor.execute('SELECT hash FROM symbol_hash_locks')
		self.assertEqual([], cursor.fetchall())
		connector = LockConnector(
			2,
			{1: [create_node_block(2)]},
			{2: create_node_block(2)},
			hash_responses={'lock/hash/' + LOCK_HASH: create_hash_lock_item(status=1)},
			transactions_by_path={transaction_path(2, 2): {'data': []}},
			statement_pages={statement_path(2, 2): {'data': []}})

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		cursor.execute('SELECT hash, status, updated_at_height FROM symbol_hash_locks')
		lock_state = [
			(bytes(lock_hash), status, updated_at_height)
			for lock_hash, status, updated_at_height in cursor.fetchall()]
		self.assertEqual([(bytes.fromhex(LOCK_HASH), 'used', 1)], lock_state)
		self.assertEqual([1, 2], self._fetch_block_heights(self.puller.symbol_db))
		cursor.execute('SELECT height, type FROM symbol_transactions WHERE height >= 2')
		self.assertEqual([], cursor.fetchall())

	def test_sync_block_headers_restores_a_deleted_secret_lock_from_rollback_transaction_key(self):
		# Arrange:
		self._seed_blocks(self.puller.symbol_db, [1, 2], {2: b'local mismatch'.hex()})
		self.puller.symbol_db.upsert_sync_state(create_sync_state(
			chain_height=2,
			last_synced_height=2,
			last_synced_block_hash=bytes.fromhex('02' * 32)))
		transaction = create_transaction_entry(
			2,
			'rollback-secret-lock',
			type=TransactionType.SECRET_LOCK.value,
			signer_address=bytes.fromhex(SIGNER_ADDRESS),
			recipient_address=bytes.fromhex(RECIPIENT_ADDRESS),
			body={
				'secret': SECRET,
				'hashAlgorithm': 1,
				'recipientAddress': '99065A28385EB5AE88000000000000000000000000000000'
			})
		self.puller.symbol_db.upsert_transactions_for_height(2, [transaction])
		secret_key = create_secret_lock_search_key(
			bytes.fromhex(SIGNER_ADDRESS), bytes.fromhex(RECIPIENT_ADDRESS), bytes.fromhex(SECRET), 'hash160')
		self.puller.symbol_db.replace_secret_locks(
			secret_key, [create_secret_lock_row(create_secret_lock_item(), 2)])
		self.puller.symbol_db.replace_secret_locks(secret_key, [])
		cursor = self.puller.symbol_db.connection.cursor()
		cursor.execute('SELECT composite_hash FROM symbol_secret_locks')
		self.assertEqual([], cursor.fetchall())
		connector = LockConnector(
			2,
			{1: [create_node_block(2)]},
			{2: create_node_block(2)},
			secret_responses={_secret_search_path(SIGNER_ADDRESS, SECRET): {
				'data': [create_secret_lock_item(status=1)]
			}},
			transactions_by_path={transaction_path(2, 2): {'data': []}},
			statement_pages={statement_path(2, 2): {'data': []}})

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		cursor.execute('SELECT composite_hash, status, updated_at_height FROM symbol_secret_locks')
		self.assertEqual([
			(bytes.fromhex(COMPOSITE_HASH), 'used', 1)
		], [
			(bytes(composite_hash), status, updated_at_height)
			for composite_hash, status, updated_at_height in cursor.fetchall()
		])
		cursor.execute('SELECT height, type FROM symbol_transactions WHERE height >= 2')
		self.assertEqual([], cursor.fetchall())

	def test_sync_block_headers_keeps_rollback_state_unchanged_when_lock_replacement_fetch_fails(self):
		# Arrange:
		self._seed_blocks(self.puller.symbol_db, [1, 2], {2: b'local mismatch'.hex()})
		original_sync_state = create_sync_state(
			chain_height=2,
			last_synced_height=2,
			last_synced_block_hash=bytes.fromhex('02' * 32))
		self.puller.symbol_db.upsert_sync_state(original_sync_state)
		transaction = create_transaction_entry(
			2,
			'rollback-fetch-failure',
			type=TransactionType.HASH_LOCK.value,
			body={'hash': LOCK_HASH})
		self.puller.symbol_db.upsert_transactions_for_height(2, [transaction])
		self.puller.symbol_db.upsert_hash_lock(create_hash_lock_row(create_hash_lock_item(status=1), 2))
		original_lock_state = self._fetch_lock_state()
		original_sync_state = fetch_normalized_sync_state(self.puller.symbol_db)
		connector = LockConnector(
			2,
			{1: [create_node_block(2)]},
			{2: create_node_block(2)},
			hash_responses={'lock/hash/' + LOCK_HASH: RuntimeError('rollback lock fetch failed')})

		# Act / Assert:
		with self.assertRaisesRegex(RuntimeError, '^rollback lock fetch failed$'):
			self._sync_with_connector(connector)

		# Assert:
		cursor = self.puller.symbol_db.connection.cursor()
		cursor.execute('SELECT height, type FROM symbol_transactions ORDER BY height, id')
		self.assertEqual([(2, TransactionType.HASH_LOCK.value)], cursor.fetchall())
		self.assertEqual([1, 2], self._fetch_block_heights(self.puller.symbol_db))
		self.assertEqual(original_lock_state, self._fetch_lock_state())
		self.assertEqual(original_sync_state, fetch_normalized_sync_state(self.puller.symbol_db))

	def test_sync_block_headers_keeps_all_rollback_state_unchanged_when_secret_lock_replacement_fetch_fails(self):
		# Arrange:
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
		transaction = create_transaction_entry(
			2,
			'rollback-secret-fetch-failure',
			type=TransactionType.SECRET_LOCK.value,
			signer_address=bytes.fromhex(SIGNER_ADDRESS),
			recipient_address=bytes.fromhex(RECIPIENT_ADDRESS),
			body={'secret': SECRET, 'hashAlgorithm': 1})
		self.puller.symbol_db.upsert_transactions_for_height(2, [transaction])
		self.puller.symbol_db.upsert_hash_lock(create_hash_lock_row(create_hash_lock_item(status=1), 2))
		secret_key = create_secret_lock_search_key(
			bytes.fromhex(SIGNER_ADDRESS), bytes.fromhex(RECIPIENT_ADDRESS), bytes.fromhex(SECRET), 'hash160')
		self.puller.symbol_db.replace_secret_locks(
			secret_key, [create_secret_lock_row(create_secret_lock_item(status=1), 2)])
		original_state = self._fetch_complete_rollback_state()
		connector = LockConnector(
			2,
			{1: [create_node_block(2)]},
			{2: create_node_block(2)},
			hash_responses={'lock/hash/' + LOCK_HASH: create_hash_lock_item()},
			secret_responses={_secret_search_path(SIGNER_ADDRESS, SECRET): RuntimeError('rollback secret lock fetch failed')})

		# Act / Assert:
		with self.assertRaisesRegex(RuntimeError, '^rollback secret lock fetch failed$'):
			self._sync_with_connector(connector)

		# Assert:
		self.assertEqual(original_state, self._fetch_complete_rollback_state())

	def test_sync_block_headers_preserves_the_approved_residual_window_for_pruned_unused_pre_fork_locks(self):
		self._assert_residual_window_for_pruned_pre_fork_locks(0)

	def test_sync_block_headers_preserves_the_approved_residual_window_for_pruned_used_pre_fork_locks(self):
		self._assert_residual_window_for_pruned_pre_fork_locks(1)

	def _assert_residual_window_for_pruned_pre_fork_locks(self, status_number):
		# Arrange:
		self._seed_blocks(self.puller.symbol_db, [1])
		self.puller.symbol_db.upsert_sync_state(create_sync_state(
			chain_height=1,
			last_synced_height=1,
			last_synced_block_hash=bytes.fromhex('01' * 32)))
		self.puller.symbol_db.upsert_hash_lock(create_hash_lock_row(
			create_hash_lock_item(status=status_number, endHeight='3'), 1))
		secret_key = create_secret_lock_search_key(
			bytes.fromhex(SIGNER_ADDRESS), bytes.fromhex(RECIPIENT_ADDRESS), bytes.fromhex(SECRET), 'hash160')
		self.puller.symbol_db.replace_secret_locks(
			secret_key, [create_secret_lock_row(create_secret_lock_item(status=status_number, endHeight='3'), 1)])
		orphaned_block_two_hash = 'DD' * 32
		orphaned_block_three_hash = 'EE' * 32
		orphaned_connector = LockConnector(
			3,
			{1: [
				create_node_block(2, block_hash=orphaned_block_two_hash),
				create_node_block(3, block_hash=orphaned_block_three_hash, previous_hash=orphaned_block_two_hash)
			]},
			hash_responses={'lock/hash/' + LOCK_HASH: {'code': 'ResourceNotFound', 'message': 'not found'}},
			secret_responses={_secret_search_path(SIGNER_ADDRESS, SECRET): {'data': []}},
			transactions_by_path={transaction_path(2, 3): {'data': []}},
			statement_pages={statement_path(2, 3): {'data': []}})

		# Act: orphaned branch reaches the absolute end height and prunes both rows.
		self._sync_with_connector(orphaned_connector)

		# Assert:
		self.assertEqual(([], []), self._fetch_lock_state())
		self.assertEqual([1, 2, 3], self._fetch_block_heights(self.puller.symbol_db))
		orphaned_sync_state = self.puller.symbol_db.get_sync_state()
		self.assertEqual(3, orphaned_sync_state['chain_height'])
		self.assertEqual(3, orphaned_sync_state['last_synced_height'])
		self.assertEqual(bytes.fromhex(orphaned_block_three_hash), bytes(orphaned_sync_state['last_synced_block_hash']))
		self.assertEqual(bytes.fromhex(orphaned_block_three_hash), self._fetch_block_hash(self.puller.symbol_db, 3))
		self.assertEqual([
			'lock/hash/' + LOCK_HASH,
			_secret_search_path(SIGNER_ADDRESS, SECRET)
		], [path for path in orphaned_connector.paths if path.startswith('lock/')])

		# Act: canonical branch rolls back below the absolute end height.
		rollback_connector = LockConnector(
			2,
			{1: [create_node_block(2, block_hash='FF' * 32)]},
			{2: create_node_block(2, block_hash='FF' * 32)},
			transactions_by_path={transaction_path(2, 2): {'data': []}},
			statement_pages={statement_path(2, 2): {'data': []}})
		self._sync_with_connector(rollback_connector)

		# Assert:
		self.assertEqual(([], []), self._fetch_lock_state())
		self.assertEqual([], [path for path in rollback_connector.paths if path.startswith('lock/')])
		self.assertEqual([1, 2], self._fetch_block_heights(self.puller.symbol_db))
		self.assertEqual(2, self.puller.symbol_db.get_sync_state()['last_synced_height'])
		self.assertEqual(bytes.fromhex('FF' * 32), self._fetch_block_hash(self.puller.symbol_db, 2))

		# Act: canonical branch reaches the same absolute end height.
		canonical_end_height_connector = LockConnector(
			3,
			{2: [create_node_block(3)]},
			{2: create_node_block(2, block_hash='FF' * 32)},
			transactions_by_path={transaction_path(3, 3): {'data': []}},
			statement_pages={statement_path(3, 3): {'data': []}})
		self._sync_with_connector(canonical_end_height_connector)

		# Assert:
		self.assertEqual(([], []), self._fetch_lock_state())
		self.assertEqual([1, 2, 3], self._fetch_block_heights(self.puller.symbol_db))
		self.assertEqual(3, self.puller.symbol_db.get_sync_state()['last_synced_height'])
		self.assertEqual([], [path for path in canonical_end_height_connector.paths if path.startswith('lock/')])

	def _fetch_lock_state(self):
		cursor = self.puller.symbol_db.connection.cursor()
		cursor.execute('SELECT hash, status, updated_at_height FROM symbol_hash_locks ORDER BY hash')
		hash_rows = [tuple([bytes(row[0]), *row[1:]]) for row in cursor.fetchall()]
		cursor.execute('SELECT composite_hash, hash_algorithm, updated_at_height FROM symbol_secret_locks ORDER BY composite_hash')
		secret_rows = [tuple([bytes(row[0]), *row[1:]]) for row in cursor.fetchall()]
		return hash_rows, secret_rows

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
			{0: [create_node_block(1)]},
			hash_responses={'lock/hash/' + LOCK_HASH: RuntimeError('lock fetch failed')},
			transactions_by_path={transaction_path(1, 1): {'data': [transaction]}},
			statement_pages={statement_path(1, 1): {'data': []}})

		# Act / Assert:
		with self.assertRaisesRegex(RuntimeError, '^lock fetch failed$'):
			self._sync_with_connector(connector)

		# Assert:
		cursor = self.puller.symbol_db.connection.cursor()
		for table_name in ('symbol_blocks', 'symbol_transactions', 'symbol_receipts', 'symbol_hash_locks', 'symbol_secret_locks'):
			cursor.execute(f'SELECT COUNT(*) FROM {table_name}')
			self.assertEqual(0, cursor.fetchone()[0], table_name)
		self.assertIsNone(self.puller.symbol_db.get_sync_state())

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
			{0: [create_node_block(1)]},
			secret_responses={path: RuntimeError('secret lock fetch failed')},
			transactions_by_path={transaction_path(1, 1): {'data': [transaction]}},
			statement_pages={statement_path(1, 1): {'data': []}})

		# Act / Assert:
		with self.assertRaisesRegex(RuntimeError, '^secret lock fetch failed$'):
			self._sync_with_connector(connector)

		# Assert:
		cursor = self.puller.symbol_db.connection.cursor()
		for table_name in ('symbol_blocks', 'symbol_transactions', 'symbol_receipts', 'symbol_hash_locks', 'symbol_secret_locks'):
			cursor.execute(f'SELECT COUNT(*) FROM {table_name}')
			self.assertEqual(0, cursor.fetchone()[0], table_name)
		self.assertIsNone(self.puller.symbol_db.get_sync_state())

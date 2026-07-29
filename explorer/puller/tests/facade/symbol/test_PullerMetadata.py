# pylint: disable=too-many-lines
import asyncio
import copy

from psycopg2 import Error as PsycopgError
from symbolchain.sc import TransactionType
from symbolchain.symbol.Network import Address

from puller.facade.SymbolPuller import METADATA_FETCH_CONCURRENCY
from tests.test.SymbolMetadataTestUtils import (
	MOSAIC_ID,
	NAMESPACE_ID,
	SCOPED_METADATA_KEY,
	SOURCE_ADDRESS,
	TARGET_ADDRESS,
	create_expected_metadata_row,
	create_metadata_item,
	fetch_metadata_rows,
	metadata_path
)
from tests.test.SymbolMosaicTestUtils import create_mosaic_item
from tests.test.SymbolNamespaceTestUtils import create_namespace_item
from tests.test.SymbolTestConstants import RECIPIENT_ADDRESS, SIGNER_ADDRESS

from .puller_test_utils import (
	BoundedMetadataConnector,
	FakeConnector,
	SymbolPullerTestBase,
	create_account_item,
	create_embedded_node_transaction,
	create_node_block,
	create_node_transaction,
	create_resolution_statement,
	resolution_path,
	set_symbol_connector,
	transaction_path
)

ALIAS_ADDRESS = '99065A28385EB5AE88000000000000000000000000000000'
ALIAS_MOSAIC_ID = 'E74B99BA41F4AFEE'
DECOY_MOSAIC_ID = '6BED913FA20223F8'
RESOLVED_MOSAIC_ID = MOSAIC_ID
METADATA_COMPOSITE_HASH = 'AB' * 32
ACCOUNT_METADATA_COMPOSITE_HASH = 'CD' * 32
NAMESPACE_METADATA_COMPOSITE_HASH = 'EF' * 32


class MalformedMosaicResolutionConnector(FakeConnector):
	async def get(self, url_path, *args):
		if url_path.startswith('statements/resolutions/mosaic?'):
			self.paths.append(url_path)
			return {'pagination': {'pageNumber': 1}}

		return await super().get(url_path, *args)


def _create_metadata_fetch_fixture():
	key_specs = [
		(4, 'account', None, '0000000000000004'),
		(1, 'mosaic', MOSAIC_ID, '0000000000000001'),
		(10, 'namespace', NAMESPACE_ID, '000000000000000A'),
		(0, 'account', None, '0000000000000000'),
		(9, 'mosaic', MOSAIC_ID, '0000000000000009'),
		(2, 'namespace', NAMESPACE_ID, '0000000000000002'),
		(8, 'account', None, '0000000000000008'),
		(3, 'mosaic', MOSAIC_ID, '0000000000000003'),
		(7, 'namespace', NAMESPACE_ID, '0000000000000007'),
		(5, 'account', None, '0000000000000005'),
		(6, 'mosaic', MOSAIC_ID, '0000000000000006')
	]
	type_numbers = {'account': 0, 'mosaic': 1, 'namespace': 2}
	keys = [{
		'metadata_type': metadata_type,
		'source_address': bytes.fromhex(SOURCE_ADDRESS),
		'target_address': bytes.fromhex(TARGET_ADDRESS),
		'scoped_metadata_key': scoped_metadata_key,
		'target_id': target_id
	} for _, metadata_type, target_id, scoped_metadata_key in key_specs]
	metadata_by_query = {}
	expected_paths = []
	for index, metadata_type, target_id, scoped_metadata_key in key_specs:
		path = metadata_path(
			type_numbers[metadata_type],
			target_id,
			source_address=SOURCE_ADDRESS,
			target_address=TARGET_ADDRESS,
			scoped_metadata_key=scoped_metadata_key)
		expected_paths.append(path)
		metadata_by_query[path] = {'data': [create_metadata_item(
			composite_hash=f'{index + 1:064X}',
			metadata_type=type_numbers[metadata_type],
			target_id=target_id or '0000000000000000',
			source_address=SOURCE_ADDRESS,
			target_address=TARGET_ADDRESS,
			scoped_metadata_key=scoped_metadata_key)]}

	return keys, metadata_by_query, expected_paths, key_specs


def _create_metadata_node_transaction(height, **transaction_fields):
	transaction = create_node_transaction(height, **transaction_fields)
	del transaction['transaction']['recipientAddress']
	del transaction['transaction']['mosaics']
	return transaction


def _create_metadata_embedded_transaction(height, aggregate_hash, embedded_index, **transaction_fields):
	transaction = create_embedded_node_transaction(height, aggregate_hash, embedded_index, **transaction_fields)
	del transaction['transaction']['recipientAddress']
	del transaction['transaction']['mosaics']
	return transaction


def _create_metadata_block(transactions_count, total_transactions_count):
	block = create_node_block(1)
	block['meta'].update({
		'transactionsCount': transactions_count,
		'totalTransactionsCount': total_transactions_count
	})
	return block


def _create_embedded_metadata_transactions(
	transaction_type,
	include_decoy=False,
	decoy_address=RECIPIENT_ADDRESS,
	decoy_mosaic_id=DECOY_MOSAIC_ID,
	**transaction_fields
):  # pylint: disable=too-many-arguments,too-many-positional-arguments
	decoy_transaction = None
	if include_decoy:
		decoy_transaction = create_node_transaction(
			1,
			transaction_hash='D' * 64,
			transaction_id='decoy-transfer',
			block_index=0,
			recipientAddress=decoy_address,
			mosaics=[{'id': decoy_mosaic_id, 'amount': '1000'}])

	aggregate_hash = 'A' * 64
	parent_transaction = _create_metadata_node_transaction(
		1,
		transaction_hash=aggregate_hash,
		transaction_id='aggregate',
		block_index=1 if include_decoy else 0,
		type=TransactionType.AGGREGATE_COMPLETE.value,
		transactionsHash='9' * 64,
		cosignatures=[])
	embedded_transaction = _create_metadata_embedded_transaction(
		1,
		aggregate_hash,
		0,
		transaction_id='embedded-metadata',
		type=transaction_type,
		**transaction_fields)
	transactions = [parent_transaction, embedded_transaction]
	if decoy_transaction is not None:
		transactions.insert(0, decoy_transaction)

	return decoy_transaction, parent_transaction, embedded_transaction, transactions


def _create_embedded_metadata_fixture(
	target_address,
	target_mosaic_id,
	resolved_address=RECIPIENT_ADDRESS,
	resolved_mosaic_id=RESOLVED_MOSAIC_ID,
	address_resolution_entries=None,
	mosaic_resolution_entries=None,
	include_decoy=False,
	decoy_address=RECIPIENT_ADDRESS,
	decoy_mosaic_id=DECOY_MOSAIC_ID,
	connector_class=FakeConnector
):  # pylint: disable=too-many-arguments,too-many-positional-arguments,too-many-locals
	decoy_transaction, parent_transaction, embedded_transaction, transactions = _create_embedded_metadata_transactions(
		TransactionType.MOSAIC_METADATA.value,
		include_decoy=include_decoy,
		decoy_address=decoy_address,
		decoy_mosaic_id=decoy_mosaic_id,
		targetAddress=target_address,
		targetMosaicId=target_mosaic_id,
		scopedMetadataKey=SCOPED_METADATA_KEY,
		valueSizeDelta=5,
		value='68656C6C6F')
	metadata_item = create_metadata_item(
		metadata_type=1,
		target_id=resolved_mosaic_id,
		composite_hash=METADATA_COMPOSITE_HASH,
		target_address=resolved_address,
		item_id='embedded-metadata-result')
	address_resolution_items = [] if address_resolution_entries is None else [create_resolution_statement(
		1, target_address, address_resolution_entries)]
	mosaic_resolution_items = [] if mosaic_resolution_entries is None else [create_resolution_statement(
		1, target_mosaic_id, mosaic_resolution_entries)]
	connector = connector_class(
		1,
		{0: [_create_metadata_block(
			2 if decoy_transaction is not None else 1,
			3 if decoy_transaction is not None else 2)]},
		transactions_by_path={transaction_path(1, 1): {'data': transactions}},
		address_resolutions_by_height={1: address_resolution_items},
		mosaic_resolutions_by_height={1: mosaic_resolution_items},
		metadata_by_query={metadata_path(
			1,
			resolved_mosaic_id,
			source_address=SOURCE_ADDRESS,
			target_address=resolved_address,
			scoped_metadata_key=SCOPED_METADATA_KEY): {'data': [metadata_item]}})
	return connector, decoy_transaction, parent_transaction, embedded_transaction, transactions, metadata_item


def _create_resolution_entry(primary_id, secondary_id, resolved):
	return {'source': {'primaryId': primary_id, 'secondaryId': secondary_id}, 'resolved': resolved}


class SymbolPullerMetadataTest(SymbolPullerTestBase):  # pylint: disable=too-many-public-methods
	def test_collect_dirty_metadata_keys_maps_account_mosaic_and_namespace_transactions(self):
		# Arrange:
		rows = {
			1: [
				{'type': TransactionType.ACCOUNT_METADATA.value, 'signer_address': bytes.fromhex(SIGNER_ADDRESS),
					'target_address': bytes.fromhex(RECIPIENT_ADDRESS), 'metadata_target_id': None,
					'body': {'targetAddress': RECIPIENT_ADDRESS, 'scopedMetadataKey': '0000000000000001'}},
				{'type': TransactionType.MOSAIC_METADATA.value, 'signer_address': bytes.fromhex(SIGNER_ADDRESS),
					'target_address': bytes.fromhex(RECIPIENT_ADDRESS), 'metadata_target_id': MOSAIC_ID,
					'body': {'targetAddress': RECIPIENT_ADDRESS, 'targetMosaicId': MOSAIC_ID, 'scopedMetadataKey': '0000000000000002'}},
				{'type': TransactionType.NAMESPACE_METADATA.value, 'signer_address': bytes.fromhex(SIGNER_ADDRESS),
					'target_address': bytes.fromhex(RECIPIENT_ADDRESS), 'metadata_target_id': None,
					'body': {'targetAddress': RECIPIENT_ADDRESS, 'targetNamespaceId': NAMESPACE_ID, 'scopedMetadataKey': '0000000000000003'}}
			]
		}

		# Act:
		keys = self.puller._collect_dirty_metadata_keys_for_batch(rows)  # pylint: disable=protected-access

		# Assert:
		self.assertEqual([
			{'metadata_type': 'account', 'source_address': bytes.fromhex(SIGNER_ADDRESS),
				'target_address': bytes.fromhex(RECIPIENT_ADDRESS), 'scoped_metadata_key': '0000000000000001', 'target_id': None},
			{'metadata_type': 'mosaic', 'source_address': bytes.fromhex(SIGNER_ADDRESS),
				'target_address': bytes.fromhex(RECIPIENT_ADDRESS), 'scoped_metadata_key': '0000000000000002', 'target_id': MOSAIC_ID},
			{'metadata_type': 'namespace', 'source_address': bytes.fromhex(SIGNER_ADDRESS),
				'target_address': bytes.fromhex(RECIPIENT_ADDRESS), 'scoped_metadata_key': '0000000000000003', 'target_id': NAMESPACE_ID}
		], keys)

	def test_collect_dirty_metadata_keys_deduplicates_repeated_keys_in_first_encounter_order(self):
		# Arrange:
		rows = {
			1: [
				{'type': TransactionType.NAMESPACE_METADATA.value, 'signer_address': bytes.fromhex(SIGNER_ADDRESS),
					'target_address': bytes.fromhex(RECIPIENT_ADDRESS), 'metadata_target_id': None,
					'body': {'targetAddress': RECIPIENT_ADDRESS, 'targetNamespaceId': NAMESPACE_ID, 'scopedMetadataKey': '0000000000000003'}},
				{'type': TransactionType.ACCOUNT_METADATA.value, 'signer_address': bytes.fromhex(SIGNER_ADDRESS),
					'target_address': bytes.fromhex(RECIPIENT_ADDRESS), 'metadata_target_id': None,
					'body': {'targetAddress': RECIPIENT_ADDRESS, 'scopedMetadataKey': '0000000000000001'}},
				{'type': TransactionType.MOSAIC_METADATA.value, 'signer_address': bytes.fromhex(SIGNER_ADDRESS),
					'target_address': bytes.fromhex(RECIPIENT_ADDRESS), 'metadata_target_id': MOSAIC_ID,
					'body': {'targetAddress': RECIPIENT_ADDRESS, 'targetMosaicId': MOSAIC_ID, 'scopedMetadataKey': '0000000000000002'}},
				{'type': TransactionType.NAMESPACE_METADATA.value, 'signer_address': bytes.fromhex(SIGNER_ADDRESS),
					'target_address': bytes.fromhex(RECIPIENT_ADDRESS), 'metadata_target_id': None,
					'body': {'targetAddress': RECIPIENT_ADDRESS, 'targetNamespaceId': NAMESPACE_ID, 'scopedMetadataKey': '0000000000000003'}},
				{'type': TransactionType.ACCOUNT_METADATA.value, 'signer_address': bytes.fromhex(SIGNER_ADDRESS),
					'target_address': bytes.fromhex(RECIPIENT_ADDRESS), 'metadata_target_id': None,
					'body': {'targetAddress': RECIPIENT_ADDRESS, 'scopedMetadataKey': '0000000000000001'}}
			]
		}

		# Act:
		keys = self.puller._collect_dirty_metadata_keys_for_batch(rows)  # pylint: disable=protected-access

		# Assert:
		self.assertEqual([
			{'metadata_type': 'namespace', 'source_address': bytes.fromhex(SIGNER_ADDRESS),
				'target_address': bytes.fromhex(RECIPIENT_ADDRESS), 'scoped_metadata_key': '0000000000000003', 'target_id': NAMESPACE_ID},
			{'metadata_type': 'account', 'source_address': bytes.fromhex(SIGNER_ADDRESS),
				'target_address': bytes.fromhex(RECIPIENT_ADDRESS), 'scoped_metadata_key': '0000000000000001', 'target_id': None},
			{'metadata_type': 'mosaic', 'source_address': bytes.fromhex(SIGNER_ADDRESS),
				'target_address': bytes.fromhex(RECIPIENT_ADDRESS), 'scoped_metadata_key': '0000000000000002', 'target_id': MOSAIC_ID}
		], keys)

	def test_collect_dirty_metadata_keys_ignores_non_metadata_transactions(self):
		# Arrange:
		rows = {
			1: [{'type': TransactionType.TRANSFER.value, 'signer_address': bytes.fromhex(SIGNER_ADDRESS), 'body': {}}]
		}

		# Act:
		keys = self.puller._collect_dirty_metadata_keys_for_batch(rows)  # pylint: disable=protected-access

		# Assert:
		self.assertEqual([], keys)

	def test_collect_dirty_metadata_keys_returns_empty_for_empty_batch(self):
		# Arrange:
		rows = {}

		# Act:
		keys = self.puller._collect_dirty_metadata_keys_for_batch(rows)  # pylint: disable=protected-access

		# Assert:
		self.assertEqual([], keys)

	def _assert_collect_dirty_metadata_keys_prefers_row_target_address(self, transaction_row, expected_key):
		# Arrange:
		# body targetAddress is an unresolved alias; row target_address is the resolved address.

		# Act:
		keys = self.puller._collect_dirty_metadata_keys_for_batch({1: [transaction_row]})  # pylint: disable=protected-access

		# Assert:
		self.assertEqual([expected_key], keys)

	def test_collect_dirty_metadata_keys_prefers_row_target_address_over_body_target_address_for_account_metadata(self):
		self._assert_collect_dirty_metadata_keys_prefers_row_target_address(
			{
				'type': TransactionType.ACCOUNT_METADATA.value,
				'signer_address': bytes.fromhex(SIGNER_ADDRESS),
				'target_address': bytes.fromhex(TARGET_ADDRESS),
				'metadata_target_id': None,
				'body': {'targetAddress': ALIAS_ADDRESS, 'scopedMetadataKey': '0000000000000004'}
			},
			{
				'metadata_type': 'account',
				'source_address': bytes.fromhex(SIGNER_ADDRESS),
				'target_address': bytes.fromhex(TARGET_ADDRESS),
				'scoped_metadata_key': '0000000000000004',
				'target_id': None
			})

	def test_collect_dirty_metadata_keys_prefers_row_target_address_over_body_target_address_for_mosaic_metadata(self):
		self._assert_collect_dirty_metadata_keys_prefers_row_target_address(
			{
				'type': TransactionType.MOSAIC_METADATA.value,
				'signer_address': bytes.fromhex(SIGNER_ADDRESS),
				'target_address': bytes.fromhex(TARGET_ADDRESS),
				'metadata_target_id': MOSAIC_ID,
				'body': {
					'targetAddress': ALIAS_ADDRESS,
					'targetMosaicId': MOSAIC_ID,
					'scopedMetadataKey': '0000000000000005'
				}
			},
			{
				'metadata_type': 'mosaic',
				'source_address': bytes.fromhex(SIGNER_ADDRESS),
				'target_address': bytes.fromhex(TARGET_ADDRESS),
				'scoped_metadata_key': '0000000000000005',
				'target_id': MOSAIC_ID
			})

	def test_collect_dirty_metadata_keys_prefers_row_target_address_over_body_target_address_for_namespace_metadata(self):
		self._assert_collect_dirty_metadata_keys_prefers_row_target_address(
			{
				'type': TransactionType.NAMESPACE_METADATA.value,
				'signer_address': bytes.fromhex(SIGNER_ADDRESS),
				'target_address': bytes.fromhex(TARGET_ADDRESS),
				'metadata_target_id': None,
				'body': {
					'targetAddress': ALIAS_ADDRESS,
					'targetNamespaceId': NAMESPACE_ID,
					'scopedMetadataKey': '0000000000000006'
				}
			},
			{
				'metadata_type': 'namespace',
				'source_address': bytes.fromhex(SIGNER_ADDRESS),
				'target_address': bytes.fromhex(TARGET_ADDRESS),
				'scoped_metadata_key': '0000000000000006',
				'target_id': NAMESPACE_ID
			})

	def test_collect_dirty_metadata_keys_uses_resolved_mosaic_target_id_for_mosaic_alias(self):
		# Arrange:
		alias_mosaic_id = ALIAS_MOSAIC_ID
		row = {
			'type': TransactionType.MOSAIC_METADATA.value,
			'signer_address': bytes.fromhex(SIGNER_ADDRESS),
			'target_address': bytes.fromhex(TARGET_ADDRESS),
			'metadata_target_id': MOSAIC_ID,
			'body': {
				'targetAddress': RECIPIENT_ADDRESS,
				'targetMosaicId': alias_mosaic_id,
				'scopedMetadataKey': '0000000000000007'
			}
		}

		# Act:
		keys = self.puller._collect_dirty_metadata_keys_for_batch({1: [row]})  # pylint: disable=protected-access

		# Assert:
		self.assertEqual([{
			'metadata_type': 'mosaic', 'source_address': bytes.fromhex(SIGNER_ADDRESS),
			'target_address': bytes.fromhex(TARGET_ADDRESS), 'scoped_metadata_key': '0000000000000007', 'target_id': MOSAIC_ID
		}], keys)

	def test_fetch_dirty_metadata_uses_exact_request_contract_for_each_metadata_type(self):
		# Arrange:
		keys = [
			{'metadata_type': 'account', 'source_address': bytes.fromhex(SIGNER_ADDRESS),
				'target_address': bytes.fromhex(RECIPIENT_ADDRESS), 'scoped_metadata_key': SCOPED_METADATA_KEY, 'target_id': None},
			{'metadata_type': 'mosaic', 'source_address': bytes.fromhex(SIGNER_ADDRESS),
				'target_address': bytes.fromhex(RECIPIENT_ADDRESS), 'scoped_metadata_key': SCOPED_METADATA_KEY, 'target_id': MOSAIC_ID},
			{'metadata_type': 'namespace', 'source_address': bytes.fromhex(SIGNER_ADDRESS),
				'target_address': bytes.fromhex(RECIPIENT_ADDRESS), 'scoped_metadata_key': SCOPED_METADATA_KEY, 'target_id': NAMESPACE_ID}
		]
		expected_paths = [metadata_path(0), metadata_path(1, MOSAIC_ID), metadata_path(2, NAMESPACE_ID)]
		metadata_by_query = {
			expected_paths[0]: {'data': [create_metadata_item(metadata_type=0, scoped_metadata_key=SCOPED_METADATA_KEY)]},
			expected_paths[1]: {'data': [create_metadata_item(metadata_type=1, target_id=MOSAIC_ID, scoped_metadata_key=SCOPED_METADATA_KEY)]},
			expected_paths[2]: {'data': [create_metadata_item(metadata_type=2, target_id=NAMESPACE_ID, scoped_metadata_key=SCOPED_METADATA_KEY)]}
		}
		connector = FakeConnector(1, {}, metadata_by_query=metadata_by_query)
		set_symbol_connector(self.puller, connector)

		# Act:
		asyncio.run(self.puller._fetch_dirty_metadata(keys, 9))  # pylint: disable=protected-access

		# Assert:
		self.assertEqual(expected_paths, connector.paths)

	def test_fetch_dirty_metadata_preserves_order_across_bounded_chunks(self):
		# Arrange:
		keys, metadata_by_query, expected_paths, key_specs = _create_metadata_fetch_fixture()
		connector = FakeConnector(1, {}, metadata_by_query=metadata_by_query)
		set_symbol_connector(self.puller, connector)

		# Act:
		entries = asyncio.run(self.puller._fetch_dirty_metadata(keys, 9))  # pylint: disable=protected-access

		# Assert:
		self.assertEqual([f'{index + 1:064X}' for index, _, _, _ in key_specs], [
			entry['row']['composite_hash'].hex().upper() for entry in entries])
		self.assertEqual(expected_paths, connector.paths)

	def test_fetch_dirty_metadata_limits_bounded_concurrency(self):
		# Arrange:
		keys, metadata_by_query, _, _ = _create_metadata_fetch_fixture()
		connector = BoundedMetadataConnector(1, {}, metadata_by_query=metadata_by_query)
		set_symbol_connector(self.puller, connector)

		# Act:
		asyncio.run(self.puller._fetch_dirty_metadata(keys, 9))  # pylint: disable=protected-access

		# Assert:
		self.assertGreater(connector.max_in_flight_detail_requests, 1)
		self.assertLessEqual(connector.max_in_flight_detail_requests, METADATA_FETCH_CONCURRENCY)
		self.assertEqual(0, connector.in_flight_detail_requests)
		self.assertEqual(11, len(connector.paths))

	def test_fetch_dirty_metadata_returns_delete_entry_for_empty_search(self):
		# Arrange:
		key = {
			'metadata_type': 'mosaic',
			'source_address': bytes.fromhex(SIGNER_ADDRESS),
			'target_address': bytes.fromhex(RECIPIENT_ADDRESS),
			'scoped_metadata_key': SCOPED_METADATA_KEY,
			'target_id': MOSAIC_ID
		}
		connector = FakeConnector(1, {}, metadata_by_query={metadata_path(1, MOSAIC_ID): {'data': []}})
		set_symbol_connector(self.puller, connector)

		# Act:
		entries = asyncio.run(self.puller._fetch_dirty_metadata([key], 9))  # pylint: disable=protected-access

		# Assert:
		self.assertEqual([{'key': key}], entries)
		self.assertEqual([metadata_path(1, MOSAIC_ID)], connector.paths)

	def test_write_dirty_metadata_deletes_empty_exact_key(self):
		# Arrange:
		key = {
			'metadata_type': 'mosaic',
			'source_address': bytes.fromhex(SIGNER_ADDRESS),
			'target_address': bytes.fromhex(RECIPIENT_ADDRESS),
			'scoped_metadata_key': SCOPED_METADATA_KEY,
			'target_id': MOSAIC_ID
		}
		item = create_metadata_item(metadata_type=1, target_id=MOSAIC_ID, composite_hash='11' * 32)
		sibling_item = create_metadata_item(metadata_type=1, target_id=NAMESPACE_ID, composite_hash='22' * 32)
		sibling_row = create_expected_metadata_row(
			sibling_item, 1, composite_hash=bytes.fromhex('22' * 32), metadata_type='mosaic',
			target_id=NAMESPACE_ID, value_utf8='hello')
		self.puller.symbol_db.upsert_metadata(create_expected_metadata_row(
			item, 1, composite_hash=bytes.fromhex('11' * 32), metadata_type='mosaic',
			target_id=MOSAIC_ID, value_utf8='hello'))
		self.puller.symbol_db.upsert_metadata(sibling_row)

		# Act:
		self.puller._write_dirty_metadata([{'key': key}])  # pylint: disable=protected-access

		# Assert:
		self.assertEqual([sibling_row], fetch_metadata_rows(self.puller.symbol_db))

	def _assert_fetch_dirty_metadata_rejects_response(self, response, expected_message):
		# Arrange:
		key = {
			'metadata_type': 'account',
			'source_address': bytes.fromhex(SIGNER_ADDRESS),
			'target_address': bytes.fromhex(RECIPIENT_ADDRESS),
			'scoped_metadata_key': SCOPED_METADATA_KEY,
			'target_id': None
		}
		connector = FakeConnector(1, {}, metadata_by_query={metadata_path(0): response})
		set_symbol_connector(self.puller, connector)

		# Act:
		with self.assertRaisesRegex(ValueError, expected_message):
			asyncio.run(self.puller._fetch_dirty_metadata([key], 9))  # pylint: disable=protected-access

		# Assert:
		self.assertEqual([metadata_path(0)], connector.paths)

	def test_fetch_dirty_metadata_rejects_malformed_response(self):
		self._assert_fetch_dirty_metadata_rejects_response(None, '^Malformed Symbol metadata search response$')

	def test_fetch_dirty_metadata_rejects_response_missing_data(self):
		self._assert_fetch_dirty_metadata_rejects_response({}, '^Malformed Symbol metadata search response$')

	def test_fetch_dirty_metadata_rejects_non_list_data(self):
		self._assert_fetch_dirty_metadata_rejects_response({'data': {}}, '^Malformed Symbol metadata search data$')

	def test_fetch_dirty_metadata_rejects_multiple_entries(self):
		self._assert_fetch_dirty_metadata_rejects_response(
			{
				'data': [
					create_metadata_item(),
					create_metadata_item(composite_hash='22' * 32)
				]
			},
			'^Symbol metadata exact-key search returned multiple entries$')

	def test_fetch_dirty_metadata_returns_empty_for_no_keys(self):
		# Arrange:
		connector = FakeConnector(1, {})
		set_symbol_connector(self.puller, connector)

		# Act:
		entries = asyncio.run(self.puller._fetch_dirty_metadata([], 9))  # pylint: disable=protected-access

		# Assert:
		self.assertEqual([], entries)
		self.assertEqual([], connector.paths)

	def _assert_embedded_metadata_persisted(
		self,
		connector,
		transactions_snapshot,
		embedded_transaction_snapshot,
		expected_metadata_row,
		expected_path,
		expected_resolution_paths,
		expected_body
	):  # pylint: disable=too-many-arguments,too-many-positional-arguments
		# Assert:
		metadata_paths = [path for path in connector.paths if path.startswith('metadata?')]
		resolution_paths = [path for path in connector.paths if path.startswith('statements/resolutions/')]
		self.assertEqual([expected_path], metadata_paths)
		self.assertEqual(expected_resolution_paths, resolution_paths)
		self.assertEqual(transactions_snapshot, connector.transactions_by_path[transaction_path(1, 1)]['data'])
		self.assertEqual([expected_metadata_row], fetch_metadata_rows(self.puller.symbol_db))
		cursor = self.puller.symbol_db.connection.cursor()
		cursor.execute(
			'SELECT body, raw_payload FROM symbol_transactions WHERE aggregate_hash IS NOT NULL')
		persisted_body, persisted_raw_payload = cursor.fetchone()
		self.assertEqual(expected_body, persisted_body)
		self.assertEqual(embedded_transaction_snapshot, persisted_raw_payload)

	def test_sync_block_headers_persists_direct_mosaic_metadata_from_embedded_transaction(self):
		# Arrange:
		connector, _, _, embedded_transaction, transactions, metadata_item = _create_embedded_metadata_fixture(
			RECIPIENT_ADDRESS, MOSAIC_ID)
		expected_path = metadata_path(1, MOSAIC_ID)
		transactions_snapshot = copy.deepcopy(transactions)
		embedded_transaction_snapshot = copy.deepcopy(embedded_transaction)
		metadata_item_snapshot = copy.deepcopy(metadata_item)
		expected_metadata_row = create_expected_metadata_row(
			metadata_item_snapshot,
			1,
			composite_hash=bytes.fromhex(METADATA_COMPOSITE_HASH),
			metadata_type='mosaic',
			target_id=MOSAIC_ID,
			value_utf8='hello')

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		self._assert_embedded_metadata_persisted(
			connector, transactions_snapshot, embedded_transaction_snapshot, expected_metadata_row, expected_path, [],
			{
				'version': 1,
				'network': 152,
				'targetAddress': RECIPIENT_ADDRESS,
				'targetMosaicId': MOSAIC_ID,
				'scopedMetadataKey': SCOPED_METADATA_KEY,
				'valueSizeDelta': 5,
				'value': '68656C6C6F'
			})

	def test_sync_block_headers_resolves_address_alias_for_embedded_mosaic_metadata(self):
		# Arrange:
		connector, _, _, embedded_transaction, transactions, metadata_item = _create_embedded_metadata_fixture(
			ALIAS_ADDRESS,
			MOSAIC_ID,
			include_decoy=True,
			decoy_address=ALIAS_ADDRESS,
			address_resolution_entries=[
				_create_resolution_entry(1, 0, SIGNER_ADDRESS),
				_create_resolution_entry(2, 1, RECIPIENT_ADDRESS)])
		expected_path = metadata_path(1, MOSAIC_ID)
		transactions_snapshot = copy.deepcopy(transactions)
		embedded_transaction_snapshot = copy.deepcopy(embedded_transaction)
		metadata_item_snapshot = copy.deepcopy(metadata_item)
		expected_metadata_row = create_expected_metadata_row(
			metadata_item_snapshot,
			1,
			composite_hash=bytes.fromhex(METADATA_COMPOSITE_HASH),
			metadata_type='mosaic',
			target_id=MOSAIC_ID,
			value_utf8='hello')

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		self._assert_embedded_metadata_persisted(
			connector, transactions_snapshot, embedded_transaction_snapshot, expected_metadata_row, expected_path,
			[resolution_path('address', 1)], {
				'version': 1,
				'network': 152,
				'targetAddress': ALIAS_ADDRESS,
				'targetMosaicId': MOSAIC_ID,
				'scopedMetadataKey': SCOPED_METADATA_KEY,
				'valueSizeDelta': 5,
				'value': '68656C6C6F'
			})

	def test_sync_block_headers_resolves_target_mosaic_id_alias_for_embedded_mosaic_metadata(self):
		# Arrange:
		connector, _, _, embedded_transaction, transactions, metadata_item = _create_embedded_metadata_fixture(
			RECIPIENT_ADDRESS,
			ALIAS_MOSAIC_ID,
			include_decoy=True,
			decoy_mosaic_id=ALIAS_MOSAIC_ID,
			mosaic_resolution_entries=[
				_create_resolution_entry(1, 0, DECOY_MOSAIC_ID),
				_create_resolution_entry(2, 1, RESOLVED_MOSAIC_ID)])
		expected_path = metadata_path(1, RESOLVED_MOSAIC_ID)
		transactions_snapshot = copy.deepcopy(transactions)
		embedded_transaction_snapshot = copy.deepcopy(embedded_transaction)
		metadata_item_snapshot = copy.deepcopy(metadata_item)
		expected_metadata_row = create_expected_metadata_row(
			metadata_item_snapshot,
			1,
			composite_hash=bytes.fromhex(METADATA_COMPOSITE_HASH),
			metadata_type='mosaic',
			target_id=RESOLVED_MOSAIC_ID,
			value_utf8='hello')

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		self._assert_embedded_metadata_persisted(
			connector, transactions_snapshot, embedded_transaction_snapshot, expected_metadata_row, expected_path,
			[resolution_path('mosaic', 1)], {
				'version': 1,
				'network': 152,
				'targetAddress': RECIPIENT_ADDRESS,
				'targetMosaicId': ALIAS_MOSAIC_ID,
				'scopedMetadataKey': SCOPED_METADATA_KEY,
				'valueSizeDelta': 5,
				'value': '68656C6C6F'
			})

	def test_sync_block_headers_resolves_address_and_target_mosaic_id_aliases_for_embedded_mosaic_metadata(self):
		# Arrange:
		connector, _, _, embedded_transaction, transactions, metadata_item = _create_embedded_metadata_fixture(
			ALIAS_ADDRESS,
			ALIAS_MOSAIC_ID,
			include_decoy=True,
			decoy_address=ALIAS_ADDRESS,
			decoy_mosaic_id=ALIAS_MOSAIC_ID,
			address_resolution_entries=[
				_create_resolution_entry(1, 0, SIGNER_ADDRESS),
				_create_resolution_entry(2, 1, RECIPIENT_ADDRESS)],
			mosaic_resolution_entries=[
				_create_resolution_entry(1, 0, DECOY_MOSAIC_ID),
				_create_resolution_entry(2, 1, RESOLVED_MOSAIC_ID)])
		expected_path = metadata_path(1, RESOLVED_MOSAIC_ID)
		transactions_snapshot = copy.deepcopy(transactions)
		embedded_transaction_snapshot = copy.deepcopy(embedded_transaction)
		metadata_item_snapshot = copy.deepcopy(metadata_item)
		expected_metadata_row = create_expected_metadata_row(
			metadata_item_snapshot,
			1,
			composite_hash=bytes.fromhex(METADATA_COMPOSITE_HASH),
			metadata_type='mosaic',
			target_id=RESOLVED_MOSAIC_ID,
			value_utf8='hello')

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		self._assert_embedded_metadata_persisted(
			connector, transactions_snapshot, embedded_transaction_snapshot, expected_metadata_row, expected_path,
			[resolution_path('address', 1), resolution_path('mosaic', 1)],
			{
				'version': 1,
				'network': 152,
				'targetAddress': ALIAS_ADDRESS,
				'targetMosaicId': ALIAS_MOSAIC_ID,
				'scopedMetadataKey': SCOPED_METADATA_KEY,
				'valueSizeDelta': 5,
				'value': '68656C6C6F'
			})

	def test_sync_block_headers_resolves_address_alias_for_embedded_account_metadata(self):
		# Arrange:
		_, _, embedded_transaction, transactions = _create_embedded_metadata_transactions(
			TransactionType.ACCOUNT_METADATA.value,
			include_decoy=True,
			decoy_address=ALIAS_ADDRESS,
			targetAddress=ALIAS_ADDRESS,
			scopedMetadataKey=SCOPED_METADATA_KEY,
			valueSizeDelta=5,
			value='68656C6C6F')
		metadata_item = create_metadata_item(
			metadata_type=0,
			target_id='0000000000000000',
			composite_hash=ACCOUNT_METADATA_COMPOSITE_HASH,
			item_id='account-metadata-result',
			target_address=RECIPIENT_ADDRESS)
		expected_path = metadata_path(
			0,
			source_address=SOURCE_ADDRESS,
			target_address=RECIPIENT_ADDRESS,
			scoped_metadata_key=SCOPED_METADATA_KEY)
		connector = FakeConnector(
			1,
			{0: [_create_metadata_block(2, 3)]},
			transactions_by_path={transaction_path(1, 1): {'data': transactions}},
			address_resolutions_by_height={1: [create_resolution_statement(
				1, ALIAS_ADDRESS, [
					_create_resolution_entry(1, 0, SIGNER_ADDRESS),
					_create_resolution_entry(2, 1, RECIPIENT_ADDRESS)])]},
			mosaic_resolutions_by_height={1: []},
			metadata_by_query={expected_path: {'data': [metadata_item]}})
		transactions_snapshot = copy.deepcopy(transactions)
		embedded_transaction_snapshot = copy.deepcopy(embedded_transaction)
		metadata_item_snapshot = copy.deepcopy(metadata_item)
		expected_metadata_row = create_expected_metadata_row(
			metadata_item_snapshot,
			1,
			composite_hash=bytes.fromhex(ACCOUNT_METADATA_COMPOSITE_HASH),
			metadata_type='account',
			target_id=None,
			value_utf8='hello')

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		self._assert_embedded_metadata_persisted(
			connector, transactions_snapshot, embedded_transaction_snapshot, expected_metadata_row, expected_path,
			[resolution_path('address', 1)], {
				'version': 1,
				'network': 152,
				'targetAddress': ALIAS_ADDRESS,
				'scopedMetadataKey': SCOPED_METADATA_KEY,
				'valueSizeDelta': 5,
				'value': '68656C6C6F'
			})

	def test_sync_block_headers_resolves_address_alias_for_embedded_namespace_metadata(self):
		# Arrange:
		_, _, embedded_transaction, transactions = _create_embedded_metadata_transactions(
			TransactionType.NAMESPACE_METADATA.value,
			include_decoy=True,
			decoy_address=ALIAS_ADDRESS,
			targetAddress=ALIAS_ADDRESS,
			targetNamespaceId=NAMESPACE_ID,
			scopedMetadataKey=SCOPED_METADATA_KEY,
			valueSizeDelta=5,
			value='68656C6C6F')
		metadata_item = create_metadata_item(
			metadata_type=2,
			target_id=NAMESPACE_ID,
			composite_hash=NAMESPACE_METADATA_COMPOSITE_HASH,
			item_id='namespace-metadata-result',
			target_address=RECIPIENT_ADDRESS)
		expected_path = metadata_path(
			2,
			NAMESPACE_ID,
			source_address=SOURCE_ADDRESS,
			target_address=RECIPIENT_ADDRESS,
			scoped_metadata_key=SCOPED_METADATA_KEY)
		connector = FakeConnector(
			1,
			{0: [_create_metadata_block(2, 3)]},
			transactions_by_path={transaction_path(1, 1): {'data': transactions}},
			address_resolutions_by_height={1: [create_resolution_statement(
				1, ALIAS_ADDRESS, [
					_create_resolution_entry(1, 0, SIGNER_ADDRESS),
					_create_resolution_entry(2, 1, RECIPIENT_ADDRESS)])]},
			mosaic_resolutions_by_height={1: []},
			metadata_by_query={expected_path: {'data': [metadata_item]}})
		transactions_snapshot = copy.deepcopy(transactions)
		embedded_transaction_snapshot = copy.deepcopy(embedded_transaction)
		metadata_item_snapshot = copy.deepcopy(metadata_item)
		expected_metadata_row = create_expected_metadata_row(
			metadata_item_snapshot,
			1,
			composite_hash=bytes.fromhex(NAMESPACE_METADATA_COMPOSITE_HASH),
			metadata_type='namespace',
			target_id=NAMESPACE_ID,
			value_utf8='hello')

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		self._assert_embedded_metadata_persisted(
			connector, transactions_snapshot, embedded_transaction_snapshot, expected_metadata_row, expected_path,
			[resolution_path('address', 1)],
			{
				'version': 1,
				'network': 152,
				'targetAddress': ALIAS_ADDRESS,
				'targetNamespaceId': NAMESPACE_ID,
				'scopedMetadataKey': SCOPED_METADATA_KEY,
				'valueSizeDelta': 5,
				'value': '68656C6C6F'
			})

	def test_write_dirty_metadata_found_row_failure_preserves_existing_row_without_predelete(self):
		# Arrange:
		original_item = create_metadata_item(metadata_type=1, target_id=MOSAIC_ID)
		original_row = create_expected_metadata_row(
			original_item,
			123,
			composite_hash=bytes.fromhex('11' * 32),
			metadata_type='mosaic',
			target_id=MOSAIC_ID,
			value_utf8='hello')
		self.puller.symbol_db.upsert_metadata(original_row)
		invalid_updated_row = {**original_row, 'value_utf8': None}

		# Act:
		with self.assertRaises(PsycopgError):
			self.puller._write_dirty_metadata([{'row': invalid_updated_row}])  # pylint: disable=protected-access

		# Assert:
		self.assertEqual([original_row], fetch_metadata_rows(self.puller.symbol_db))

	def test_write_dirty_metadata_failure_keeps_connection_usable_and_preserves_target_row(self):
		# Arrange:
		original_item = create_metadata_item(metadata_type=1, target_id=MOSAIC_ID, composite_hash='11' * 32)
		original_row = create_expected_metadata_row(
			original_item,
			123,
			composite_hash=bytes.fromhex('11' * 32),
			metadata_type='mosaic',
			target_id=MOSAIC_ID,
			value_utf8='hello')
		sibling_item = create_metadata_item(
			metadata_type=2,
			target_id=NAMESPACE_ID,
			composite_hash='22' * 32,
			scoped_metadata_key='0000000000000002')
		sibling_row = create_expected_metadata_row(
			sibling_item,
			123,
			composite_hash=bytes.fromhex('22' * 32),
			metadata_type='namespace',
			scoped_metadata_key='0000000000000002',
			target_id=NAMESPACE_ID,
			value_utf8='hello')
		self.puller.symbol_db.upsert_metadata(original_row)
		self.puller.symbol_db.upsert_metadata(sibling_row)
		invalid_updated_row = {**original_row, 'value_utf8': None}
		valid_updated_sibling_row = {
			**sibling_row,
			'value_hex': '776F726C64',
			'value_utf8': 'world',
			'updated_at_height': 456
		}

		# Act:
		with self.assertRaises(PsycopgError):
			self.puller._write_dirty_metadata([{'row': invalid_updated_row}])  # pylint: disable=protected-access
		self.puller._write_dirty_metadata([{'row': valid_updated_sibling_row}])  # pylint: disable=protected-access

		# Assert:
		self.assertEqual([original_row, valid_updated_sibling_row], fetch_metadata_rows(self.puller.symbol_db))

	def _assert_embedded_mosaic_resolution_failure(self, connector, error_message):
		# Arrange:
		set_symbol_connector(self.puller, connector)

		# Act:
		with self.assertRaisesRegex(ValueError, error_message):
			asyncio.run(self.puller.sync_block_headers())

		# Assert:
		cursor = self.puller.symbol_db.connection.cursor()
		for table in (
			'symbol_sync_state',
			'symbol_blocks',
			'symbol_account_refresh_state',
			'symbol_accounts',
			'symbol_account_mosaics',
			'symbol_multisig',
			'symbol_account_refresh_accounts',
			'symbol_account_refresh_mosaics',
			'symbol_account_list_ranks',
			'symbol_namespaces',
			'symbol_alias_names',
			'symbol_mosaics',
			'symbol_metadata',
			'symbol_transactions',
			'symbol_transaction_mosaics',
			'symbol_transaction_addresses',
			'symbol_receipts'
		):
			cursor.execute(f'SELECT COUNT(*) FROM {table}')
			self.assertEqual(0, cursor.fetchone()[0])
		self.assertEqual([resolution_path('mosaic', 1)], [
			path for path in connector.paths if path.startswith('statements/resolutions/')])
		self.assertIsNone(self.puller.symbol_db.get_sync_state())

	def test_sync_block_headers_rejects_missing_mosaic_resolution_statement_for_embedded_metadata(self):
		# Arrange:
		connector, _, _, _, _, _ = _create_embedded_metadata_fixture(
			RECIPIENT_ADDRESS, ALIAS_MOSAIC_ID, include_decoy=True)

		# Act:
		self._assert_embedded_mosaic_resolution_failure(
			connector, 'Missing Symbol mosaic resolution at height 1')

	def test_sync_block_headers_rejects_inapplicable_mosaic_resolution_entry_for_embedded_metadata(self):
		# Arrange:
		connector, _, _, _, _, _ = _create_embedded_metadata_fixture(
			RECIPIENT_ADDRESS,
			ALIAS_MOSAIC_ID,
			include_decoy=True,
			mosaic_resolution_entries=[_create_resolution_entry(3, 1, RESOLVED_MOSAIC_ID)])

		# Act:
		self._assert_embedded_mosaic_resolution_failure(
			connector, 'Missing Symbol mosaic resolution entry at height 1')

	def test_sync_block_headers_rejects_malformed_mosaic_resolution_response_for_embedded_metadata(self):
		# Arrange:
		connector, _, _, _, _, _ = _create_embedded_metadata_fixture(
			RECIPIENT_ADDRESS,
			ALIAS_MOSAIC_ID,
			include_decoy=True,
			connector_class=MalformedMosaicResolutionConnector)

		# Act:
		self._assert_embedded_mosaic_resolution_failure(
			connector, 'Malformed Symbol mosaic resolution page response')

	def test_sync_block_headers_converges_metadata_when_restarted_from_existing_blocks(self):
		# Arrange:
		connector, _, _, embedded_transaction, transactions, metadata_item = _create_embedded_metadata_fixture(
			RECIPIENT_ADDRESS, MOSAIC_ID)
		expected_path = metadata_path(1, MOSAIC_ID)
		transactions_snapshot = copy.deepcopy(transactions)
		embedded_transaction_snapshot = copy.deepcopy(embedded_transaction)
		metadata_item_snapshot = copy.deepcopy(metadata_item)
		expected_metadata_row = create_expected_metadata_row(
			metadata_item_snapshot,
			1,
			composite_hash=bytes.fromhex(METADATA_COMPOSITE_HASH),
			metadata_type='mosaic',
			target_id=MOSAIC_ID,
			value_utf8='hello')

		# Act:
		self._sync_with_connector(connector)
		first_state = fetch_metadata_rows(self.puller.symbol_db)
		self._assert_embedded_metadata_persisted(
			connector, transactions_snapshot, embedded_transaction_snapshot, expected_metadata_row, expected_path, [],
			{
				'version': 1,
				'network': 152,
				'targetAddress': RECIPIENT_ADDRESS,
				'targetMosaicId': MOSAIC_ID,
				'scopedMetadataKey': SCOPED_METADATA_KEY,
				'valueSizeDelta': 5,
				'value': '68656C6C6F'
			})
		connector.paths.clear()
		cursor = self.puller.symbol_db.connection.cursor()
		cursor.execute('DELETE FROM symbol_sync_state')
		self.puller.symbol_db.connection.commit()

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		self.assertEqual(first_state, fetch_metadata_rows(self.puller.symbol_db))
		self._assert_embedded_metadata_persisted(
			connector, transactions_snapshot, embedded_transaction_snapshot, expected_metadata_row, expected_path, [],
			{
				'version': 1,
				'network': 152,
				'targetAddress': RECIPIENT_ADDRESS,
				'targetMosaicId': MOSAIC_ID,
				'scopedMetadataKey': SCOPED_METADATA_KEY,
				'valueSizeDelta': 5,
				'value': '68656C6C6F'
			})

	def test_sync_block_headers_leaves_no_partial_writes_when_metadata_fetch_fails(self):  # pylint: disable=too-many-locals
		# Arrange:
		dirty_mosaic_id = '6BED913FA20223F8'
		namespace_transaction = _create_metadata_node_transaction(
			1,
			transaction_hash='B' * 64,
			transaction_id='namespace-registration',
			block_index=0,
			type=TransactionType.NAMESPACE_REGISTRATION.value,
			id=NAMESPACE_ID,
			name='metadata-namespace',
			registrationType=0,
			duration='0')
		mosaic_transaction = _create_metadata_node_transaction(
			1,
			transaction_hash='C' * 64,
			transaction_id='mosaic-definition',
			block_index=1,
			type=TransactionType.MOSAIC_DEFINITION.value,
			id=dirty_mosaic_id,
			duration='0',
			nonce=0,
			flags=2,
			divisibility=6)
		aggregate_hash = 'A' * 64
		parent_transaction = _create_metadata_node_transaction(
			1,
			transaction_hash=aggregate_hash,
			transaction_id='aggregate-parent',
			block_index=2,
			type=TransactionType.AGGREGATE_COMPLETE.value,
			transactionsHash='9' * 64,
			cosignatures=[])
		embedded_transaction = _create_metadata_embedded_transaction(
			1,
			aggregate_hash,
			0,
			transaction_id='embedded-metadata',
			type=TransactionType.MOSAIC_METADATA.value,
			targetAddress=RECIPIENT_ADDRESS,
			targetMosaicId=MOSAIC_ID,
			scopedMetadataKey=SCOPED_METADATA_KEY,
			valueSizeDelta=5,
			value='68656C6C6F')
		transactions = [namespace_transaction, mosaic_transaction, parent_transaction, embedded_transaction]
		transactions_snapshot = copy.deepcopy(transactions)
		account_addresses = [
			str(Address(bytes.fromhex(SIGNER_ADDRESS))),
			str(Address(bytes.fromhex(RECIPIENT_ADDRESS)))
		]
		metadata_failure_path = metadata_path(1, MOSAIC_ID)
		connector = FakeConnector(
			1,
			{0: [_create_metadata_block(3, 4)]},
			transactions_by_path={transaction_path(1, 1): {'data': transactions}},
			account_by_address={
				str(Address(bytes.fromhex(SIGNER_ADDRESS))): create_account_item(
					address_hex=SIGNER_ADDRESS, item_id='signer-account'),
				str(Address(bytes.fromhex(RECIPIENT_ADDRESS))): create_account_item(
					address_hex=RECIPIENT_ADDRESS, item_id='recipient-account')},
			namespace_by_id={NAMESPACE_ID: create_namespace_item(namespace_id=NAMESPACE_ID, root_id=NAMESPACE_ID)},
			namespace_names={NAMESPACE_ID: 'metadata-namespace'},
			mosaics_by_id={dirty_mosaic_id: create_mosaic_item(mosaic_id=dirty_mosaic_id)},
			metadata_by_query={metadata_failure_path: RuntimeError('metadata fetch failed')})

		# Act:
		with self.assertRaisesRegex(RuntimeError, 'metadata fetch failed'):
			self._sync_with_connector(connector)

		# Assert:
		transactions = connector.transactions_by_path[transaction_path(1, 1)]['data']
		self.assertEqual(transactions_snapshot, transactions)
		cursor = self.puller.symbol_db.connection.cursor()
		for table in (
			'symbol_blocks', 'symbol_transactions', 'symbol_accounts', 'symbol_namespaces', 'symbol_alias_names',
			'symbol_mosaics', 'symbol_metadata'
		):
			cursor.execute(f'SELECT COUNT(*) FROM {table}')
			self.assertEqual(0, cursor.fetchone()[0])
		self.assertIsNone(self.puller.symbol_db.get_sync_state())
		self.assertEqual([
			'accounts',
			f'namespaces/{NAMESPACE_ID}',
			'namespaces/names',
			'mosaics',
			metadata_failure_path
		], [
			path for path in connector.paths
			if path in ('accounts', f'namespaces/{NAMESPACE_ID}', 'namespaces/names', 'mosaics') or path.startswith('metadata?')
		])
		self.assertEqual([{'addresses': account_addresses}], [
			payload for path, payload in connector.post_requests if 'accounts' == path])
		self.assertEqual([{'namespaceIds': [NAMESPACE_ID]}], [
			payload for path, payload in connector.post_requests if 'namespaces/names' == path])
		self.assertEqual([{'mosaicIds': [dirty_mosaic_id]}], [
			payload for path, payload in connector.post_requests if 'mosaics' == path])

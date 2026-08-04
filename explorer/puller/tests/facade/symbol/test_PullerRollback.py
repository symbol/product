# pylint: disable=duplicate-code,too-many-lines
import asyncio

from symbolchain.sc import TransactionType
from symbolchain.symbol.Network import Address

from puller.facade.SymbolPuller import SymbolRollbackError
from puller.model.symbol.Transaction import TRANSACTION_TYPE_LABELS
from tests.test.SymbolDatabaseTestUtils import fetch_full_block_state, fetch_normalized_sync_state
from tests.test.SymbolMetadataTestUtils import create_expected_metadata_row, create_metadata_item, fetch_metadata_rows, metadata_path
from tests.test.SymbolMosaicTestUtils import (
	create_expected_mosaic_row,
	create_mosaic_item,
	create_persisted_mosaic_state,
	fetch_mosaic_state
)
from tests.test.SymbolNamespaceTestUtils import (
	NAMESPACE_ROOT_ID,
	NAMESPACE_SUB_ID,
	NAMESPACE_SUB_SUB_ID,
	create_namespace_item,
	fetch_namespace_state,
	seed_namespace
)

from ...test.SymbolTestConstants import BENEFICIARY_ADDRESS, RECIPIENT_ADDRESS, SIGNER_ADDRESS
from ...test.SymbolTransactionTestUtils import create_transaction_entry
from .puller_test_utils import (
	NATIVE_MOSAIC_ID,
	FakeConnector,
	SymbolPullerTestBase,
	create_amount_statement_item,
	create_node_block,
	create_node_transaction,
	create_sync_state,
	set_symbol_connector,
	statement_path,
	transaction_path
)


class SymbolPullerRollbackTest(SymbolPullerTestBase):  # pylint: disable=too-many-public-methods
	def _fetch_namespace_rows(self):
		cursor = self.puller.symbol_db.connection.cursor()
		cursor.execute(
			'''
			SELECT namespace_id, full_name, updated_at_height
			FROM symbol_namespaces
			ORDER BY namespace_id
			''')
		namespace_rows = cursor.fetchall()
		cursor.execute(
			'''
			SELECT artifact_type, artifact_id, name, updated_at_height
			FROM symbol_alias_names
			ORDER BY artifact_type, artifact_id, name
			''')

		return namespace_rows, cursor.fetchall()

	def _seed_transaction_metadata_rollback(self, transaction_type, body, mosaic_rows, metadata_item):
		metadata_type_number = metadata_item['metadataEntry']['metadataType']
		metadata_type = {0: 'account', 1: 'mosaic', 2: 'namespace'}[metadata_type_number]
		target_id = metadata_item['metadataEntry']['targetId'].upper() if 'account' != metadata_type else None
		metadata_key_path = metadata_path(
			metadata_type_number,
			target_id,
			source_address=SIGNER_ADDRESS,
			target_address=RECIPIENT_ADDRESS,
			scoped_metadata_key=metadata_item['metadataEntry']['scopedMetadataKey'].upper())
		self._seed_blocks(
			self.puller.symbol_db,
			[1, 2, 3],
			{2: b'local mismatch'.hex()})
		self.puller.symbol_db.upsert_sync_state(create_sync_state())
		self.puller.symbol_db.upsert_transactions_for_height(2, [create_transaction_entry(
			2,
			f'{metadata_type}-metadata-rollback',
			type=transaction_type,
			type_name=TRANSACTION_TYPE_LABELS[transaction_type],
			signer_address=bytes.fromhex(SIGNER_ADDRESS),
			target_address=bytes.fromhex(RECIPIENT_ADDRESS),
			body=body,
			mosaic_rows=mosaic_rows)])
		connector = FakeConnector(
			3,
			{1: [create_node_block(2), create_node_block(3)]},
			{2: create_node_block(2)},
			metadata_by_query={metadata_key_path: {'data': [metadata_item]}})
		set_symbol_connector(self.puller, connector)

		return connector, metadata_key_path

	def _assert_metadata_rollback_recovery(self, connector, metadata_key_path, expected_metadata_row):
		# Assert:
		self.assertEqual([expected_metadata_row], fetch_metadata_rows(self.puller.symbol_db))
		self.assertEqual(
			[metadata_key_path],
			[path for path in connector.paths if path.startswith('metadata?')])
		self.assertEqual(3, self.puller.symbol_db.get_sync_state()['last_synced_height'])

	def test_sync_block_headers_refreshes_namespace_state_at_or_above_rollback_height(self):
		# Arrange:
		self._seed_blocks(
			self.puller.symbol_db,
			[1, 2, 3],
			{2: b'local mismatch'.hex()})
		self.puller.symbol_db.upsert_sync_state(create_sync_state())
		seed_namespace(
			self.puller.symbol_db,
			create_namespace_item(namespace_id='B95F1F8A96159516', root_id='B95F1F8A96159516'),
			{'B95F1F8A96159516': 'unaffected'},
			1)
		seed_namespace(self.puller.symbol_db, create_namespace_item(), {NAMESPACE_ROOT_ID: 'root'}, 2)
		seed_namespace(
			self.puller.symbol_db,
			create_namespace_item(NAMESPACE_SUB_ID, NAMESPACE_ROOT_ID, NAMESPACE_ROOT_ID),
			{NAMESPACE_ROOT_ID: 'root', NAMESPACE_SUB_ID: 'orphaned'},
			3)
		connector = FakeConnector(
			3,
			{1: [create_node_block(2), create_node_block(3)]},
			{2: create_node_block(2)},
			namespace_by_id={
				NAMESPACE_ROOT_ID: create_namespace_item(),
				NAMESPACE_SUB_ID: {
					'code': 'ResourceNotFound',
					'message': f'no resource exists with id {NAMESPACE_SUB_ID}'
				}
			},
			namespace_names={NAMESPACE_ROOT_ID: 'root'})
		set_symbol_connector(self.puller, connector)

		# Act:
		asyncio.run(self.puller.sync_block_headers())

		# Assert:
		namespace_rows, alias_rows = self._fetch_namespace_rows()
		self.assertEqual([
			(NAMESPACE_ROOT_ID, 'root', 1),
			('B95F1F8A96159516', 'unaffected', 1)
		], namespace_rows)
		self.assertEqual([
			('namespace', NAMESPACE_ROOT_ID, 'root', 1),
			('namespace', 'B95F1F8A96159516', 'unaffected', 1)
		], alias_rows)
		self._assert_namespace_requests(
			connector,
			[NAMESPACE_ROOT_ID, NAMESPACE_SUB_ID],
			[{'namespaceIds': [NAMESPACE_ROOT_ID]}])

	def test_sync_block_headers_leaves_rollback_state_unchanged_when_namespace_fetch_fails(self):
		# Arrange:
		self._seed_blocks(
			self.puller.symbol_db,
			[1, 2, 3],
			{2: b'local mismatch'.hex()})
		self.puller.symbol_db.upsert_sync_state(create_sync_state())
		seed_namespace(self.puller.symbol_db, create_namespace_item(), {NAMESPACE_ROOT_ID: 'root'}, 2)
		seed_namespace(
			self.puller.symbol_db,
			create_namespace_item(NAMESPACE_SUB_ID, NAMESPACE_ROOT_ID, NAMESPACE_ROOT_ID),
			{NAMESPACE_ROOT_ID: 'root', NAMESPACE_SUB_ID: 'child'},
			2)
		original_sync_state = self.puller.symbol_db.get_sync_state()
		original_namespace_rows = self._fetch_namespace_rows()
		connector = FakeConnector(
			3,
			{},
			{2: create_node_block(2)},
			namespace_by_id={
				NAMESPACE_ROOT_ID: create_namespace_item(),
				NAMESPACE_SUB_ID: RuntimeError('namespace fetch failed')})
		set_symbol_connector(self.puller, connector)

		# Act / Assert:
		with self.assertRaisesRegex(RuntimeError, 'namespace fetch failed'):
			asyncio.run(self.puller.sync_block_headers())

		self.assertEqual([1, 2, 3], self._fetch_block_heights(self.puller.symbol_db))
		self.assertEqual(original_sync_state, self.puller.symbol_db.get_sync_state())
		self.assertEqual(original_namespace_rows, self._fetch_namespace_rows())

	def test_sync_block_headers_refreshes_mosaics_at_or_above_rollback_height_and_deletes_fork_only_rows(self):
		# Arrange:
		before_fork_id = '0000000000000000'
		survivor_id = '0000000000000001'
		fork_only_id = '0000000000000002'
		self._seed_blocks(
			self.puller.symbol_db,
			[1, 2, 3],
			{2: b'local mismatch'.hex()})
		self.puller.symbol_db.upsert_sync_state(create_sync_state())
		before_fork_item = create_mosaic_item(
			mosaic_id=before_fork_id,
			supply='111',
			item_id='000000000000000000000002')
		survivor_item = create_mosaic_item(
			mosaic_id=survivor_id,
			supply='222',
			item_id='000000000000000000000003')
		fork_only_item = create_mosaic_item(
			mosaic_id=fork_only_id,
			supply='333',
			item_id='000000000000000000000004')
		self.puller.symbol_db.upsert_mosaic(create_expected_mosaic_row(before_fork_item, 1))
		self.puller.symbol_db.upsert_mosaic(create_expected_mosaic_row(survivor_item, 2))
		self.puller.symbol_db.upsert_mosaic(create_expected_mosaic_row(fork_only_item, 3))
		canonical_survivor_item = create_mosaic_item(
			mosaic_id=survivor_id,
			supply='999',
			item_id='000000000000000000000005')
		connector = FakeConnector(
			3,
			{1: [create_node_block(2), create_node_block(3)]},
			{2: create_node_block(2)},
			mosaics_by_id={survivor_id: canonical_survivor_item})
		set_symbol_connector(self.puller, connector)

		# Act:
		asyncio.run(self.puller.sync_block_headers())

		# Assert:
		self.assertEqual([
			create_persisted_mosaic_state(create_expected_mosaic_row(before_fork_item, 1), []),
			create_persisted_mosaic_state(create_expected_mosaic_row(canonical_survivor_item, 1), [])
		], fetch_mosaic_state(self.puller.symbol_db))
		self.assertEqual(3, self.puller.symbol_db.get_sync_state()['last_synced_height'])
		self.assertEqual([{'mosaicIds': [survivor_id, fork_only_id]}], [
			payload for path, payload in connector.post_requests if 'mosaics' == path
		])
		self.assertEqual(1, connector.paths.count('mosaics'))

	def test_sync_block_headers_leaves_rollback_state_unchanged_when_mosaic_fetch_fails(self):
		# Arrange:
		mosaic_id = '0000000000000001'
		self._seed_blocks(
			self.puller.symbol_db,
			[1, 2, 3],
			{2: b'local mismatch'.hex()})
		self.puller.symbol_db.upsert_sync_state(create_sync_state())
		self.puller.symbol_db.upsert_mosaic(create_expected_mosaic_row(create_mosaic_item(mosaic_id=mosaic_id), 2))
		seed_namespace(
			self.puller.symbol_db,
			create_namespace_item(alias={'type': 1, 'mosaicId': mosaic_id}),
			{NAMESPACE_ROOT_ID: 'root'},
			2)
		original_sync_state = self.puller.symbol_db.get_sync_state()
		original_mosaic_state = fetch_mosaic_state(self.puller.symbol_db)
		original_namespace_state = self._fetch_namespace_rows()
		connector = FakeConnector(
			3,
			{},
			{2: create_node_block(2)},
			namespace_by_id={NAMESPACE_ROOT_ID: create_namespace_item(alias={'type': 1, 'mosaicId': mosaic_id})},
			namespace_names={NAMESPACE_ROOT_ID: 'root'},
			mosaics_by_id={mosaic_id: RuntimeError('mosaic fetch failed')})
		set_symbol_connector(self.puller, connector)

		# Act / Assert:
		with self.assertRaisesRegex(RuntimeError, 'mosaic fetch failed'):
			asyncio.run(self.puller.sync_block_headers())

		# Assert:
		self.assertEqual([1, 2, 3], self._fetch_block_heights(self.puller.symbol_db))
		self.assertEqual(original_sync_state, self.puller.symbol_db.get_sync_state())
		self.assertEqual(original_mosaic_state, fetch_mosaic_state(self.puller.symbol_db))
		self.assertEqual(original_namespace_state, self._fetch_namespace_rows())

	def test_sync_block_headers_refreshes_metadata_at_or_above_rollback_height_and_deletes_fork_only_rows(self):
		# Arrange:
		mosaic_id = '72C0212E67A08BCE'
		before_fork_item = create_metadata_item(
			metadata_type=1,
			target_id=mosaic_id,
			composite_hash='11' * 32,
			scoped_metadata_key='0000000000000001',
			value='6265666F7265')
		survivor_item = create_metadata_item(
			metadata_type=1,
			target_id=mosaic_id,
			composite_hash='22' * 32,
			scoped_metadata_key='0000000000000002',
			value='6F6C64')
		fork_only_item = create_metadata_item(
			metadata_type=1,
			target_id=mosaic_id,
			composite_hash='33' * 32,
			scoped_metadata_key='0000000000000003',
			value='666F726B')
		canonical_survivor_item = create_metadata_item(
			metadata_type=1,
			target_id=mosaic_id,
			composite_hash='22' * 32,
			scoped_metadata_key='0000000000000002',
			value='6E6577',
			item_id='canonical-survivor-item-id')
		self._seed_blocks(
			self.puller.symbol_db,
			[1, 2, 3],
			{2: b'local mismatch'.hex()})
		self.puller.symbol_db.upsert_sync_state(create_sync_state())
		self.puller.symbol_db.upsert_metadata(create_expected_metadata_row(
			before_fork_item, 1, composite_hash=bytes.fromhex('11' * 32), metadata_type='mosaic',
			scoped_metadata_key='0000000000000001', target_id=mosaic_id, value_hex='6265666F7265', value_utf8='before'))
		self.puller.symbol_db.upsert_metadata(create_expected_metadata_row(
			survivor_item, 2, composite_hash=bytes.fromhex('22' * 32), metadata_type='mosaic',
			scoped_metadata_key='0000000000000002', target_id=mosaic_id, value_hex='6F6C64', value_utf8='old'))
		self.puller.symbol_db.upsert_metadata(create_expected_metadata_row(
			fork_only_item, 3, composite_hash=bytes.fromhex('33' * 32), metadata_type='mosaic',
			scoped_metadata_key='0000000000000003', target_id=mosaic_id, value_hex='666F726B', value_utf8='fork'))
		connector = FakeConnector(
			3,
			{1: [create_node_block(2), create_node_block(3)]},
			{2: create_node_block(2)},
			metadata_by_query={
				metadata_path(1, mosaic_id, scoped_metadata_key='0000000000000002'): {
					'data': [canonical_survivor_item]},
				metadata_path(1, mosaic_id, scoped_metadata_key='0000000000000003'): {'data': []}})
		set_symbol_connector(self.puller, connector)

		# Act:
		asyncio.run(self.puller.sync_block_headers())

		# Assert:
		expected_rows = [
			create_expected_metadata_row(
				before_fork_item, 1, composite_hash=bytes.fromhex('11' * 32), metadata_type='mosaic',
				scoped_metadata_key='0000000000000001', target_id=mosaic_id, value_hex='6265666F7265', value_utf8='before'),
			create_expected_metadata_row(
				canonical_survivor_item, 1, composite_hash=bytes.fromhex('22' * 32), metadata_type='mosaic',
				scoped_metadata_key='0000000000000002', target_id=mosaic_id, value_hex='6E6577', value_utf8='new')
		]
		self.assertEqual(expected_rows, fetch_metadata_rows(self.puller.symbol_db))
		metadata_paths = [path for path in connector.paths if path.startswith('metadata?')]
		self.assertEqual([
			metadata_path(1, mosaic_id, scoped_metadata_key='0000000000000002'),
			metadata_path(1, mosaic_id, scoped_metadata_key='0000000000000003')
		], metadata_paths)
		self.assertEqual(3, self.puller.symbol_db.get_sync_state()['last_synced_height'])

	def test_sync_block_headers_leaves_metadata_rollback_state_unchanged_when_metadata_fetch_fails(self):
		# Arrange:
		mosaic_id = '72C0212E67A08BCE'
		orphaned_namespace_item = create_namespace_item(
			alias={'type': 1, 'mosaicId': mosaic_id},
			owner_address=SIGNER_ADDRESS,
			end_height='5')
		canonical_namespace_item = create_namespace_item(
			alias={'type': 2, 'address': RECIPIENT_ADDRESS},
			owner_address=RECIPIENT_ADDRESS,
			end_height='50')
		orphaned_mosaic_item = create_mosaic_item(mosaic_id=mosaic_id, supply='222')
		canonical_mosaic_item = create_mosaic_item(
			mosaic_id=mosaic_id,
			owner_address=RECIPIENT_ADDRESS,
			supply='999')
		item = create_metadata_item(metadata_type=1, target_id=mosaic_id, value='6F6C64')
		self._seed_blocks(
			self.puller.symbol_db,
			[1, 2, 3],
			{2: b'local mismatch'.hex()})
		self.puller.symbol_db.upsert_sync_state(create_sync_state())
		seed_namespace(
			self.puller.symbol_db,
			orphaned_namespace_item,
			{NAMESPACE_ROOT_ID: 'root'},
			2)
		self.puller.symbol_db.upsert_mosaic(create_expected_mosaic_row(orphaned_mosaic_item, 2))
		self.puller.symbol_db.upsert_metadata(create_expected_metadata_row(
			item, 2, composite_hash=bytes.fromhex('11' * 32), metadata_type='mosaic',
			target_id=mosaic_id, value_hex='6F6C64', value_utf8='old'))
		self.puller.symbol_db.upsert_transactions_for_height(2, [create_transaction_entry(
			2,
			'metadata-rollback-fetch-failure',
			type=TransactionType.MOSAIC_METADATA.value,
			type_name=TRANSACTION_TYPE_LABELS[TransactionType.MOSAIC_METADATA.value],
			signer_address=bytes.fromhex(SIGNER_ADDRESS),
			target_address=bytes.fromhex(RECIPIENT_ADDRESS),
			body={
				'targetAddress': RECIPIENT_ADDRESS,
				'targetMosaicId': mosaic_id,
				'scopedMetadataKey': item['metadataEntry']['scopedMetadataKey']
			},
			mosaic_rows=[{
				'mosaic_id': mosaic_id,
				'amount': 0,
				'role': 'metadata_target',
				'position': 0
			}])])
		original_block_state = fetch_full_block_state(self.puller.symbol_db)
		original_sync_state = fetch_normalized_sync_state(self.puller.symbol_db)
		original_namespace_state = fetch_namespace_state(self.puller.symbol_db.connection)
		original_mosaic_state = fetch_mosaic_state(self.puller.symbol_db)
		original_metadata_rows = fetch_metadata_rows(self.puller.symbol_db)
		original_transaction_rows = self._fetch_transaction_rows(self.puller.symbol_db)
		original_transaction_mosaic_rows = self._fetch_transaction_mosaic_rows(self.puller.symbol_db)
		self.assertEqual(1, len(original_namespace_state[0]))
		self.assertEqual(1, len(original_mosaic_state))
		self.assertEqual(1, len(original_metadata_rows))
		connector = FakeConnector(
			3,
			{},
			{2: create_node_block(2)},
			namespace_by_id={NAMESPACE_ROOT_ID: canonical_namespace_item},
			namespace_names={NAMESPACE_ROOT_ID: 'root'},
			mosaics_by_id={mosaic_id: canonical_mosaic_item},
			metadata_by_query={metadata_path(1, mosaic_id): RuntimeError('metadata fetch failed')})
		set_symbol_connector(self.puller, connector)

		# Act / Assert:
		with self.assertRaisesRegex(RuntimeError, 'metadata fetch failed'):
			asyncio.run(self.puller.sync_block_headers())

		# Assert:
		self.assertEqual(original_block_state, fetch_full_block_state(self.puller.symbol_db))
		self.assertEqual(original_sync_state, fetch_normalized_sync_state(self.puller.symbol_db))
		self.assertEqual(original_namespace_state, fetch_namespace_state(self.puller.symbol_db.connection))
		self.assertEqual(original_mosaic_state, fetch_mosaic_state(self.puller.symbol_db))
		self.assertEqual(original_metadata_rows, fetch_metadata_rows(self.puller.symbol_db))
		self.assertEqual(original_transaction_rows, self._fetch_transaction_rows(self.puller.symbol_db))
		self.assertEqual(original_transaction_mosaic_rows, self._fetch_transaction_mosaic_rows(self.puller.symbol_db))
		self.assertEqual([
			f'namespaces/{NAMESPACE_ROOT_ID}',
			'namespaces/names',
			'mosaics',
			metadata_path(1, mosaic_id)
		], [
			path for path in connector.paths
			if path in (f'namespaces/{NAMESPACE_ROOT_ID}', 'namespaces/names', 'mosaics') or path.startswith('metadata?')
		])
		self.assertEqual([{'namespaceIds': [NAMESPACE_ROOT_ID]}], [
			payload for path, payload in connector.post_requests if 'namespaces/names' == path])
		self.assertEqual([{'mosaicIds': [mosaic_id]}], [
			payload for path, payload in connector.post_requests if 'mosaics' == path])

	def test_sync_block_headers_recovers_orphaned_account_metadata_from_confirmed_transaction(self):
		# Arrange:
		metadata_item = create_metadata_item(
			metadata_type=0,
			composite_hash='44' * 32,
			scoped_metadata_key='abcdef0123456789',
			value='7265636F7665726564',
			target_address=RECIPIENT_ADDRESS,
			item_id='account-metadata-recovered')
		connector, metadata_key_path = self._seed_transaction_metadata_rollback(
			TransactionType.ACCOUNT_METADATA.value,
			{'targetAddress': 'unresolved-address', 'scopedMetadataKey': 'abcdef0123456789'},
			[],
			metadata_item)
		expected_metadata_row = create_expected_metadata_row(
			metadata_item,
			1,
			composite_hash=bytes.fromhex('44' * 32),
			metadata_type='account',
			target_id=None,
			scoped_metadata_key='ABCDEF0123456789',
			value_hex='7265636F7665726564',
			value_utf8='recovered')

		# Act:
		asyncio.run(self.puller.sync_block_headers())

		# Assert:
		self._assert_metadata_rollback_recovery(connector, metadata_key_path, expected_metadata_row)

	def test_sync_block_headers_recovers_orphaned_namespace_metadata_from_confirmed_transaction(self):
		# Arrange:
		metadata_item = create_metadata_item(
			metadata_type=2,
			target_id='a95f1f8a96159516',
			scoped_metadata_key='0000000000000010',
			source_address=SIGNER_ADDRESS.lower())
		connector, metadata_key_path = self._seed_transaction_metadata_rollback(
			TransactionType.NAMESPACE_METADATA.value,
			{
				'targetAddress': 'unresolved-address',
				'targetNamespaceId': 'a95f1f8a96159516',
				'scopedMetadataKey': '0000000000000010'
			},
			[],
			metadata_item)
		expected_metadata_row = create_expected_metadata_row(
			metadata_item,
			1,
			composite_hash=bytes.fromhex('11' * 32),
			metadata_type='namespace',
			target_id='A95F1F8A96159516',
			scoped_metadata_key='0000000000000010',
			value_utf8='hello')

		# Act:
		asyncio.run(self.puller.sync_block_headers())

		# Assert:
		self._assert_metadata_rollback_recovery(connector, metadata_key_path, expected_metadata_row)

	def test_sync_block_headers_recovers_orphaned_resolved_alias_mosaic_metadata_from_relation(self):
		# Arrange:
		metadata_item = create_metadata_item(
			metadata_type=1,
			target_id='72c0212e67a08bce',
			scoped_metadata_key='0000000000000011',
			source_address=SIGNER_ADDRESS.lower())
		connector, metadata_key_path = self._seed_transaction_metadata_rollback(
			TransactionType.MOSAIC_METADATA.value,
			{
				'targetAddress': 'unresolved-address-alias',
				'targetMosaicId': 'a95f1f8a96159516',
				'scopedMetadataKey': '0000000000000011'
			},
			[{
				'mosaic_id': '72c0212e67a08bce',
				'amount': 0,
				'role': 'metadata_target',
				'position': 0
			}],
			metadata_item)
		expected_metadata_row = create_expected_metadata_row(
			metadata_item,
			1,
			composite_hash=bytes.fromhex('11' * 32),
			metadata_type='mosaic',
			target_id='72C0212E67A08BCE',
			scoped_metadata_key='0000000000000011',
			value_utf8='hello')

		# Act:
		asyncio.run(self.puller.sync_block_headers())

		# Assert:
		self._assert_metadata_rollback_recovery(connector, metadata_key_path, expected_metadata_row)

	def test_sync_block_headers_recovers_orphaned_direct_mosaic_metadata_from_relation(self):
		# Arrange:
		metadata_item = create_metadata_item(
			metadata_type=1,
			target_id='72c0212e67a08bce',
			scoped_metadata_key='0000000000000012',
			source_address=SIGNER_ADDRESS.lower())
		connector, metadata_key_path = self._seed_transaction_metadata_rollback(
			TransactionType.MOSAIC_METADATA.value,
			{
				'targetAddress': RECIPIENT_ADDRESS,
				'targetMosaicId': '72c0212e67a08bce',
				'scopedMetadataKey': '0000000000000012'
			},
			[{
				'mosaic_id': '72c0212e67a08bce',
				'amount': 0,
				'role': 'metadata_target',
				'position': 0
			}],
			metadata_item)
		expected_metadata_row = create_expected_metadata_row(
			metadata_item,
			1,
			composite_hash=bytes.fromhex('11' * 32),
			metadata_type='mosaic',
			target_id='72C0212E67A08BCE',
			scoped_metadata_key='0000000000000012',
			value_utf8='hello')

		# Act:
		asyncio.run(self.puller.sync_block_headers())

		# Assert:
		self._assert_metadata_rollback_recovery(connector, metadata_key_path, expected_metadata_row)

	def test_sync_block_headers_deduplicates_current_and_transaction_metadata_keys_after_canonicalization(self):
		# Arrange:
		resolved_mosaic_id = '72C0212E67A08BCE'
		metadata_item = create_metadata_item(
			metadata_type=1,
			target_id=resolved_mosaic_id.lower(),
			scoped_metadata_key='abcdef0123456789',
			source_address=SIGNER_ADDRESS.lower())
		connector, metadata_key_path = self._seed_transaction_metadata_rollback(
			TransactionType.MOSAIC_METADATA.value,
			{
				'targetAddress': 'unresolved-address',
				'targetMosaicId': 'a95f1f8a96159516',
				'scopedMetadataKey': 'abcdef0123456789'
			},
			[{
				'mosaic_id': resolved_mosaic_id,
				'amount': 0,
				'role': 'metadata_target',
				'position': 0
			}],
			metadata_item)
		current_item = create_metadata_item(
			metadata_type=1,
			target_id=resolved_mosaic_id,
			scoped_metadata_key='ABCDEF0123456789',
			source_address=SIGNER_ADDRESS,
			value='7374616C65')
		self.puller.symbol_db.upsert_metadata(create_expected_metadata_row(
			current_item, 2, composite_hash=bytes.fromhex('11' * 32), metadata_type='mosaic',
			target_id=resolved_mosaic_id, scoped_metadata_key='ABCDEF0123456789',
			value_hex='7374616C65', value_utf8='stale'))
		current_keys = self.puller.symbol_db.get_metadata_keys_updated_from_height(2)
		confirmed_keys = self.puller.symbol_db.get_confirmed_metadata_keys_since(2)
		expected_metadata_row = create_expected_metadata_row(
			metadata_item, 1, composite_hash=bytes.fromhex('11' * 32), metadata_type='mosaic',
			target_id=resolved_mosaic_id, scoped_metadata_key='ABCDEF0123456789', value_utf8='hello')

		# Act:
		asyncio.run(self.puller.sync_block_headers())

		# Assert:
		self.assertEqual(1, len(current_keys))
		self.assertEqual(current_keys, confirmed_keys)
		self._assert_metadata_rollback_recovery(connector, metadata_key_path, expected_metadata_row)

	def test_sync_block_headers_deduplicates_namespace_metadata_keys_after_canonicalization(self):
		# Arrange:
		namespace_id = 'A95F1F8A96159516'
		metadata_item = create_metadata_item(
			metadata_type=2,
			target_id=namespace_id.lower(),
			scoped_metadata_key='abcdef0123456789',
			source_address=SIGNER_ADDRESS.lower())
		connector, metadata_key_path = self._seed_transaction_metadata_rollback(
			TransactionType.NAMESPACE_METADATA.value,
			{
				'targetAddress': 'unresolved-address',
				'targetNamespaceId': namespace_id.lower(),
				'scopedMetadataKey': 'abcdef0123456789'
			},
			[],
			metadata_item)
		current_item = create_metadata_item(
			metadata_type=2,
			target_id=namespace_id,
			scoped_metadata_key='ABCDEF0123456789',
			source_address=SIGNER_ADDRESS,
			value='7374616C65')
		self.puller.symbol_db.upsert_metadata(create_expected_metadata_row(
			current_item, 2, composite_hash=bytes.fromhex('11' * 32), metadata_type='namespace',
			target_id=namespace_id, scoped_metadata_key='ABCDEF0123456789',
			value_hex='7374616C65', value_utf8='stale'))
		current_keys = self.puller.symbol_db.get_metadata_keys_updated_from_height(2)
		confirmed_keys = self.puller.symbol_db.get_confirmed_metadata_keys_since(2)
		expected_metadata_row = create_expected_metadata_row(
			metadata_item, 1, composite_hash=bytes.fromhex('11' * 32), metadata_type='namespace',
			target_id=namespace_id, scoped_metadata_key='ABCDEF0123456789', value_utf8='hello')

		# Act:
		asyncio.run(self.puller.sync_block_headers())

		# Assert:
		self.assertEqual(1, len(current_keys))
		self.assertEqual(current_keys, confirmed_keys)
		self._assert_metadata_rollback_recovery(connector, metadata_key_path, expected_metadata_row)

	def test_sync_block_headers_refreshes_orphaned_namespace_state_to_canonical_state_during_rollback(self):
		# Arrange:
		self._seed_blocks(
			self.puller.symbol_db,
			[1, 2, 3],
			{2: b'local mismatch'.hex()})
		self.puller.symbol_db.upsert_sync_state(create_sync_state())
		orphaned_root_item = create_namespace_item(
			alias={'type': 1, 'mosaicId': NATIVE_MOSAIC_ID},
			end_height='5')
		orphaned_child_item = create_namespace_item(
			NAMESPACE_SUB_ID,
			NAMESPACE_ROOT_ID,
			NAMESPACE_ROOT_ID,
			alias={'type': 2, 'address': BENEFICIARY_ADDRESS},
			level_ids=[NAMESPACE_ROOT_ID, NAMESPACE_SUB_ID],
			end_height='5')
		orphaned_grandchild_item = create_namespace_item(
			NAMESPACE_SUB_SUB_ID,
			NAMESPACE_ROOT_ID,
			NAMESPACE_SUB_ID,
			alias={'type': 1, 'mosaicId': '6BED913FA20223F8'},
			level_ids=[NAMESPACE_ROOT_ID, NAMESPACE_SUB_ID, NAMESPACE_SUB_SUB_ID],
			end_height='5')
		canonical_root_item = create_namespace_item(end_height='50')
		canonical_child_item = create_namespace_item(
			NAMESPACE_SUB_ID,
			NAMESPACE_ROOT_ID,
			NAMESPACE_ROOT_ID,
			alias={'type': 1, 'mosaicId': NATIVE_MOSAIC_ID},
			level_ids=[NAMESPACE_ROOT_ID, NAMESPACE_SUB_ID],
			end_height='50')
		canonical_grandchild_item = create_namespace_item(
			NAMESPACE_SUB_SUB_ID,
			NAMESPACE_ROOT_ID,
			NAMESPACE_SUB_ID,
			alias={'type': 2, 'address': BENEFICIARY_ADDRESS},
			level_ids=[NAMESPACE_ROOT_ID, NAMESPACE_SUB_ID, NAMESPACE_SUB_SUB_ID],
			end_height='50')
		unaffected_item = create_namespace_item(
			namespace_id='B95F1F8A96159516',
			root_id='B95F1F8A96159516',
			alias={'type': 1, 'mosaicId': '6BED913FA20223F8'})
		seed_namespace(self.puller.symbol_db, orphaned_root_item, {NAMESPACE_ROOT_ID: 'root'}, 2)
		seed_namespace(
			self.puller.symbol_db,
			orphaned_child_item,
			{NAMESPACE_ROOT_ID: 'root', NAMESPACE_SUB_ID: 'child'},
			2)
		seed_namespace(
			self.puller.symbol_db,
			orphaned_grandchild_item,
			{NAMESPACE_ROOT_ID: 'root', NAMESPACE_SUB_ID: 'child', NAMESPACE_SUB_SUB_ID: 'grandchild'},
			2)
		seed_namespace(
			self.puller.symbol_db,
			unaffected_item,
			{'B95F1F8A96159516': 'unaffected'},
			1)
		connector = FakeConnector(
			3,
			{1: [create_node_block(2), create_node_block(3)]},
			{2: create_node_block(2)},
			namespace_by_id={
				NAMESPACE_ROOT_ID: canonical_root_item,
				NAMESPACE_SUB_ID: canonical_child_item,
				NAMESPACE_SUB_SUB_ID: canonical_grandchild_item},
			namespace_names={
				NAMESPACE_ROOT_ID: 'root',
				NAMESPACE_SUB_ID: 'child',
				NAMESPACE_SUB_SUB_ID: 'grandchild'})
		set_symbol_connector(self.puller, connector)

		# Act:
		asyncio.run(self.puller.sync_block_headers())

		# Assert:
		namespace_rows, alias_rows = fetch_namespace_state(self.puller.symbol_db.connection)
		self.assertEqual([
			(NAMESPACE_ROOT_ID, None, NAMESPACE_ROOT_ID, 'root', 'root', 1, 'root',
				BENEFICIARY_ADDRESS.lower(), 1, 50, 'none', None, None, canonical_root_item, 1),
			('B95F1F8A96159516', None, 'B95F1F8A96159516', 'unaffected', 'unaffected', 1, 'root',
				BENEFICIARY_ADDRESS.lower(), 1, None, 'mosaic', '6BED913FA20223F8', None, unaffected_item, 1),
			(NAMESPACE_SUB_SUB_ID, NAMESPACE_SUB_ID, NAMESPACE_ROOT_ID, 'grandchild', 'root.child.grandchild', 3, 'child',
				BENEFICIARY_ADDRESS.lower(), 1, 50, 'address', None, BENEFICIARY_ADDRESS.lower(), canonical_grandchild_item, 1),
			(NAMESPACE_SUB_ID, NAMESPACE_ROOT_ID, NAMESPACE_ROOT_ID, 'child', 'root.child', 2, 'child',
				BENEFICIARY_ADDRESS.lower(), 1, 50, 'mosaic', NATIVE_MOSAIC_ID, None, canonical_child_item, 1)
		], namespace_rows)
		self.assertEqual([
			('mosaic', '6BED913FA20223F8', 'unaffected', 1),
			('mosaic', NATIVE_MOSAIC_ID, 'root.child', 1),
			('namespace', NAMESPACE_ROOT_ID, 'root', 1),
			('namespace', 'B95F1F8A96159516', 'unaffected', 1),
			('namespace', NAMESPACE_SUB_SUB_ID, 'root.child.grandchild', 1),
			('namespace', NAMESPACE_SUB_ID, 'root.child', 1),
			('account', str(Address.from_decoded_address_hex_string(BENEFICIARY_ADDRESS)), 'root.child.grandchild', 1)
		], alias_rows)
		self._assert_namespace_requests(
			connector,
			[NAMESPACE_ROOT_ID, NAMESPACE_SUB_SUB_ID, NAMESPACE_SUB_ID],
			[{'namespaceIds': [NAMESPACE_ROOT_ID, NAMESPACE_SUB_ID, NAMESPACE_SUB_SUB_ID]}])

	def test_sync_block_headers_deletes_missing_descendants_during_rollback(self):
		# Arrange:
		self._seed_blocks(
			self.puller.symbol_db,
			[1, 2, 3],
			{2: b'local mismatch'.hex()})
		self.puller.symbol_db.upsert_sync_state(create_sync_state())
		seed_namespace(self.puller.symbol_db, create_namespace_item(), {NAMESPACE_ROOT_ID: 'root'}, 2)
		seed_namespace(
			self.puller.symbol_db,
			create_namespace_item(NAMESPACE_SUB_ID, NAMESPACE_ROOT_ID, NAMESPACE_ROOT_ID),
			{NAMESPACE_ROOT_ID: 'root', NAMESPACE_SUB_ID: 'child'},
			2)
		seed_namespace(
			self.puller.symbol_db,
			create_namespace_item(
				NAMESPACE_SUB_SUB_ID,
				NAMESPACE_ROOT_ID,
				NAMESPACE_SUB_ID,
				level_ids=[NAMESPACE_ROOT_ID, NAMESPACE_SUB_ID, NAMESPACE_SUB_SUB_ID]),
			{NAMESPACE_ROOT_ID: 'root', NAMESPACE_SUB_ID: 'child', NAMESPACE_SUB_SUB_ID: 'grandchild'},
			2)
		# The root remains on the canonical node; both known descendants explicitly return ResourceNotFound.
		connector = FakeConnector(
			3,
			{1: [create_node_block(2), create_node_block(3)]},
			{2: create_node_block(2)},
			namespace_by_id={
				NAMESPACE_ROOT_ID: create_namespace_item(),
				NAMESPACE_SUB_ID: {
					'code': 'ResourceNotFound',
					'message': f'no resource exists with id {NAMESPACE_SUB_ID}'
				},
				NAMESPACE_SUB_SUB_ID: {
					'code': 'ResourceNotFound',
					'message': f'no resource exists with id {NAMESPACE_SUB_SUB_ID}'
				}
			},
			namespace_names={NAMESPACE_ROOT_ID: 'root'})
		set_symbol_connector(self.puller, connector)

		# Act:
		asyncio.run(self.puller.sync_block_headers())

		# Assert:
		self.assertEqual([
			(NAMESPACE_ROOT_ID, 'root', 1)
		], self._fetch_namespace_rows()[0])
		self.assertEqual([
			('namespace', NAMESPACE_ROOT_ID, 'root', 1)
		], self._fetch_namespace_rows()[1])
		self._assert_namespace_requests(
			connector,
			[NAMESPACE_ROOT_ID, NAMESPACE_SUB_SUB_ID, NAMESPACE_SUB_ID],
			[{'namespaceIds': [NAMESPACE_ROOT_ID]}])

	@staticmethod
	def _fetch_transaction_rows(database):
		cursor = database.connection.cursor()
		cursor.execute(
			'''
			SELECT height, hash
			FROM symbol_transactions
			ORDER BY height, id
			'''
		)

		return [(height, bytes(hash_value) if hash_value is not None else None) for height, hash_value in cursor.fetchall()]

	@staticmethod
	def _fetch_transaction_mosaic_rows(database):
		cursor = database.connection.cursor()
		cursor.execute(
			'''
			SELECT mosaic_id, amount, role
			FROM symbol_transaction_mosaics
			ORDER BY mosaic_id, role
			'''
		)

		return cursor.fetchall()

	@staticmethod
	def _fetch_transaction_address_rows(database):
		cursor = database.connection.cursor()
		cursor.execute(
			'''
			SELECT encode(address, 'hex'), role
			FROM symbol_transaction_addresses
			ORDER BY role, address
			'''
		)

		return cursor.fetchall()

	def test_sync_block_headers_repairs_shallow_unfinalized_rollback(self):
		# Arrange:
		connector = FakeConnector(
			3,
			{1: [create_node_block(2), create_node_block(3)]},
			{2: create_node_block(2)},
			statement_pages={
				statement_path(2, 3): {
					'data': [
						create_amount_statement_item(2, 222),
						create_amount_statement_item(3, 333)
					]
				}
			}
		)
		self._seed_blocks(
			self.puller.symbol_db,
			[1, 2, 3],
			{2: b'local mismatch'.hex()}
		)
		# amount=999 here is a stale value that must be replaced by the real amount=222
		# after repair — the full-list assertion below fails if this row survives.
		self.puller.symbol_db.upsert_receipts_for_height(2, [{
			'height': 2,
			'receipt_type': 'inflation',
			'receipt_group': 'inflation',
			'version': 1,
			'source_primary_id': 0,
			'source_secondary_id': 0,
			'sender_address': None,
			'recipient_address': None,
			'target_address': None,
			'mosaic_id': '72C0212E67A08BCE',
			'amount': 999,
			'artifact_id': None,
			'raw_payload': {'amount': '999'}
		}], 999)
		self.puller.symbol_db.upsert_sync_state(create_sync_state())
		set_symbol_connector(self.puller, connector)

		# Act:
		asyncio.run(self.puller.sync_block_headers())

		# Assert:
		block_heights = self._fetch_block_heights(self.puller.symbol_db)
		block_hash = self._fetch_block_hash(self.puller.symbol_db, 2)
		receipts = self._fetch_receipts(self.puller.symbol_db)
		sync_state = self.puller.symbol_db.get_sync_state()

		self.assertEqual([1, 2, 3], block_heights)
		self.assertEqual(
			bytes.fromhex(f'{2:064X}'),
			block_hash
		)
		self.assertEqual([
			(2, 'inflation', 'inflation', 2, 0, '72C0212E67A08BCE', 222),
			(3, 'inflation', 'inflation', 3, 0, '72C0212E67A08BCE', 333)
		], receipts)
		self.assertEqual('healthy', sync_state['status'])
		self.assertEqual(3, sync_state['last_synced_height'])

	def test_sync_block_headers_repairs_transaction_rows_on_shallow_unfinalized_rollback(self):
		# Arrange:
		replacement_transaction_hash = 'C' * 64
		connector = FakeConnector(
			3,
			{1: [create_node_block(2), create_node_block(3)]},
			{2: create_node_block(2)},
			transactions_by_path={
				transaction_path(2, 3): {
					'data': [
						create_node_transaction(
							2,
							transaction_hash=replacement_transaction_hash,
							transaction_id='replacement-transaction'
						)
					]
				}
			}
		)
		self._seed_blocks(
			self.puller.symbol_db,
			[1, 2, 3],
			{2: b'local mismatch'.hex()}
		)
		self.puller.symbol_db.upsert_transactions_for_height(2, [create_transaction_entry(
			2,
			'old-transaction',
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
		self.puller.symbol_db.upsert_sync_state(create_sync_state())
		set_symbol_connector(self.puller, connector)

		# Act:
		asyncio.run(self.puller.sync_block_headers())

		# Assert:
		transaction_rows = self._fetch_transaction_rows(self.puller.symbol_db)
		mosaic_rows = self._fetch_transaction_mosaic_rows(self.puller.symbol_db)
		address_rows = self._fetch_transaction_address_rows(self.puller.symbol_db)

		self.assertEqual([
			(2, bytes.fromhex(replacement_transaction_hash))
		], transaction_rows)
		self.assertEqual([
			(NATIVE_MOSAIC_ID, 2000, 'transfer')
		], mosaic_rows)
		self.assertEqual([
			(SIGNER_ADDRESS.lower(), 'signer'),
			(RECIPIENT_ADDRESS.lower(), 'recipient')
		], address_rows)

	def test_sync_block_headers_keeps_transaction_rows_idempotent_when_restarted(self):
		# Arrange:
		connector = FakeConnector(
			3,
			{1: [create_node_block(2), create_node_block(3)]},
			{
				2: create_node_block(2),
				3: create_node_block(3)
			},
			transactions_by_path={
				transaction_path(2, 3): {
					'data': [
						create_node_transaction(2, transaction_id='transaction-2'),
						create_node_transaction(3, transaction_id='transaction-3')
					]
				}
			}
		)
		self._seed_blocks(self.puller.symbol_db, [1])
		self.puller.symbol_db.upsert_sync_state(create_sync_state(
			chain_height=1,
			last_synced_height=1,
			last_synced_block_hash=bytes.fromhex(f'{1:064X}')
		))
		set_symbol_connector(self.puller, connector)

		# Act:
		asyncio.run(self.puller.sync_block_headers())
		first_sync_rows = self._fetch_transaction_rows(self.puller.symbol_db)
		asyncio.run(self.puller.sync_block_headers())

		# Assert:
		second_sync_rows = self._fetch_transaction_rows(self.puller.symbol_db)

		self.assertEqual([
			(2, bytes.fromhex(f'{2:064X}')),
			(3, bytes.fromhex(f'{3:064X}'))
		], first_sync_rows)
		self.assertEqual(first_sync_rows, second_sync_rows)

	def test_sync_block_headers_marks_deep_finalized_mismatch_unhealthy(self):
		# Arrange:
		connector = FakeConnector(3, {})
		self._seed_blocks(self.puller.symbol_db, [1], {1: b'local mismatch'.hex()})
		self.puller.symbol_db.upsert_sync_state(create_sync_state(
			finalized_hash=b'old finalized'
		))
		set_symbol_connector(self.puller, connector)

		# Act / Assert:
		with self.assertRaisesRegex(
			SymbolRollbackError,
			'Finalized block hash does not match local database'
		):
			asyncio.run(self.puller.sync_block_headers())

		# Assert:
		sync_state = self.puller.symbol_db.get_sync_state()

		self.assertEqual('unhealthy', sync_state['status'])

	def test_sync_block_headers_marks_missing_finalized_block_unhealthy(self):
		# Arrange:
		connector = FakeConnector(3, {})
		self.puller.symbol_db.upsert_sync_state(create_sync_state())
		set_symbol_connector(self.puller, connector)

		# Act / Assert:
		with self.assertRaisesRegex(
			SymbolRollbackError,
			'Finalized block is missing from local database'
		):
			asyncio.run(self.puller.sync_block_headers())

		# Assert:
		sync_state = self.puller.symbol_db.get_sync_state()

		self.assertEqual('unhealthy', sync_state['status'])
		self.assertEqual(
			bytes.fromhex(f'{1:064X}'),
			bytes(sync_state['finalized_hash'])
		)

	def test_sync_block_headers_keeps_watermark_when_no_new_pages_exist(
		self
	):
		# Arrange:
		connector = FakeConnector(
			3,
			{},
			{2: create_node_block(2), 3: create_node_block(3)},
			finalized_height=3
		)
		self._seed_blocks(self.puller.symbol_db, [1, 2, 3])
		self.puller.symbol_db.upsert_sync_state(create_sync_state(
			finalized_height=3,
			finalized_hash=bytes.fromhex(f'{3:064X}')
		))
		set_symbol_connector(self.puller, connector)

		# Act:
		asyncio.run(self.puller.sync_block_headers())

		# Assert:
		sync_state = self.puller.symbol_db.get_sync_state()

		self.assertEqual(3, sync_state['last_synced_height'])
		self.assertEqual(
			bytes.fromhex(f'{3:064X}'),
			bytes(sync_state['last_synced_block_hash'])
		)

	def test_sync_block_headers_verifies_unfinalized_hashes_without_rollback(
		self
	):
		# Arrange:
		connector = FakeConnector(
			3,
			{},
			{2: create_node_block(2), 3: create_node_block(3)}
		)
		self._seed_blocks(self.puller.symbol_db, [1, 2, 3])
		self.puller.symbol_db.upsert_sync_state(create_sync_state())
		set_symbol_connector(self.puller, connector)

		# Act:
		asyncio.run(self.puller.sync_block_headers())

		# Assert:
		block_heights = self._fetch_block_heights(self.puller.symbol_db)
		sync_state = self.puller.symbol_db.get_sync_state()

		self.assertEqual([1, 2, 3], block_heights)
		self.assertEqual(3, sync_state['last_synced_height'])
		self.assertEqual(
			['chain/info', 'network/properties', f'mosaics/{NATIVE_MOSAIC_ID}', 'blocks/2', 'blocks/3'],
			connector.paths
		)

	def test_sync_block_headers_repairs_missing_unfinalized_block_hash(self):
		# Arrange:
		connector = FakeConnector(
			3,
			{2: [create_node_block(3)]},
			{2: create_node_block(2)}
		)
		self._seed_blocks(self.puller.symbol_db, [1, 2])
		self.puller.symbol_db.upsert_sync_state(create_sync_state())
		set_symbol_connector(self.puller, connector)

		# Act:
		asyncio.run(self.puller.sync_block_headers())

		# Assert:
		block_heights = self._fetch_block_heights(self.puller.symbol_db)
		sync_state = self.puller.symbol_db.get_sync_state()

		self.assertEqual([1, 2, 3], block_heights)
		self.assertEqual('healthy', sync_state['status'])
		self.assertEqual(3, sync_state['last_synced_height'])

	def test_sync_block_headers_repairs_gap_in_unfinalized_block_hashes(self):
		# Arrange:
		connector = FakeConnector(
			3,
			{1: [create_node_block(2), create_node_block(3)]}
		)
		self._seed_blocks(self.puller.symbol_db, [1, 3])
		self.puller.symbol_db.upsert_sync_state(create_sync_state())
		set_symbol_connector(self.puller, connector)

		# Act:
		asyncio.run(self.puller.sync_block_headers())

		# Assert:
		block_heights = self._fetch_block_heights(self.puller.symbol_db)
		sync_state = self.puller.symbol_db.get_sync_state()

		self.assertEqual([1, 2, 3], block_heights)
		self.assertEqual('healthy', sync_state['status'])
		self.assertEqual(3, sync_state['last_synced_height'])

	def test_sync_block_headers_rejects_empty_page_before_chain_height(self):
		# Arrange:
		connector = FakeConnector(1, {0: []})

		# Act / Assert:
		self._assert_sync_rejects_node_response(
			connector,
			ValueError,
			'Expected Symbol blocks at offset 0 before chain height 1'
		)

	def test_sync_block_headers_rejects_page_past_target_height(self):
		# Arrange:
		connector = FakeConnector(1, {0: [create_node_block(2)]})

		# Act / Assert:
		self._assert_sync_rejects_node_response(
			connector,
			ValueError,
			'Symbol block page at offset 0 does not contain blocks at or '
			'below chain height 1'
		)

	def test_sync_block_headers_rejects_unexpected_height_sequence(self):
		# Arrange:
		connector = FakeConnector(2, {0: [create_node_block(2)]})
		set_symbol_connector(self.puller, connector)

		# Act / Assert:
		with self.assertRaisesRegex(
			ValueError,
			'Unexpected Symbol block height 2; expected 1'
		):
			asyncio.run(self.puller.sync_block_headers())

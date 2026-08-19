# pylint: disable=too-many-lines
import asyncio
from unittest.mock import AsyncMock

from psycopg2 import Error as PsycopgError
from symbolchain.sc import MosaicSupplyChangeAction, ReceiptType, TransactionType
from symbolchain.symbol.IdGenerator import generate_namespace_id
from symbollightapi.model.Exceptions import NodeException

from puller.facade.SymbolPuller import BLOCK_PAGE_FETCH_CONCURRENCY, MAX_PAGE_SIZE
from puller.model.symbol.Block import create_block_row
from puller.model.symbol.Receipt import create_receipt_rows
from tests.test.SymbolMosaicTestUtils import (
	MOSAIC_ID,
	create_expected_mosaic_row,
	create_mosaic_item,
	create_persisted_mosaic_state,
	fetch_mosaic_state
)
from tests.test.SymbolNamespaceTestUtils import (
	NAMESPACE_ROOT_ID,
	NAMESPACE_SUB_ID,
	create_namespace_item,
	fetch_namespace_state,
	seed_namespace
)
from tests.test.SymbolTestConstants import BENEFICIARY_ADDRESS

from .puller_test_utils import (
	NATIVE_MOSAIC_ID,
	BoundedNamespaceDetailConnector,
	FakeConnector,
	NamespaceNamesResponseConnector,
	NoOpRateLimiter,
	ResponseConnector,
	SymbolPullerTestBase,
	create_amount_statement_item,
	create_artifact_expiry_statement,
	create_complete_aggregate_pair,
	create_embedded_node_transaction,
	create_network_properties,
	create_node_block,
	create_node_transaction,
	create_resolution_statement,
	create_statement_item,
	create_sync_state,
	resolution_path,
	set_symbol_connector,
	set_symbol_rate_limiter,
	set_sync_block_pages,
	statement_path,
	transaction_path
)


class SymbolPullerSyncTest(SymbolPullerTestBase):  # pylint: disable=too-many-public-methods
	@staticmethod
	def _create_namespace_batch_connector():
		return FakeConnector(
			1,
			{0: [create_node_block(1)]},
			transactions_by_path={
				transaction_path(1, 1): {
					'data': [
						create_node_transaction(
							1,
							transaction_hash='A' * 64,
							transaction_id='namespace-registration',
							type=TransactionType.NAMESPACE_REGISTRATION.value,
							id=NAMESPACE_ROOT_ID,
							name='root',
							registrationType=0),
						create_node_transaction(
							1,
							transaction_hash='B' * 64,
							transaction_id='mosaic-alias',
							type=TransactionType.MOSAIC_ALIAS.value,
							namespaceId=NAMESPACE_ROOT_ID,
							mosaicId=NATIVE_MOSAIC_ID,
							aliasAction=1)
					]
				}
			},
			namespace_by_id={
				NAMESPACE_ROOT_ID: create_namespace_item(alias={'type': 1, 'mosaicId': NATIVE_MOSAIC_ID})
			},
			namespace_names={NAMESPACE_ROOT_ID: 'root'})

	@staticmethod
	def _create_mosaic_definition_sync_connector(include_namespace_alias=False, mosaics_by_id=None, mosaics_response=None):
		transactions = [create_node_transaction(
			1,
			transaction_hash='A' * 64,
			transaction_id='mosaic-definition',
			type=TransactionType.MOSAIC_DEFINITION.value,
			id=MOSAIC_ID,
			duration='0',
			flags=2,
			divisibility=6)]
		connector_arguments = {
			'transactions_by_path': {transaction_path(1, 1): {'data': transactions}},
			'mosaics_by_id': mosaics_by_id if mosaics_by_id is not None else {MOSAIC_ID: create_mosaic_item()}
		}
		if include_namespace_alias:
			transactions.extend([
				create_node_transaction(
					1,
					transaction_hash='B' * 64,
					transaction_id='namespace-registration',
					type=TransactionType.NAMESPACE_REGISTRATION.value,
					id=NAMESPACE_ROOT_ID,
					name='root',
					registrationType=0),
				create_node_transaction(
					1,
					transaction_hash='C' * 64,
					transaction_id='mosaic-alias',
					type=TransactionType.MOSAIC_ALIAS.value,
					namespaceId=NAMESPACE_ROOT_ID,
					mosaicId=MOSAIC_ID,
					aliasAction=1)
			])
			connector_arguments.update({
				'namespace_by_id': {NAMESPACE_ROOT_ID: create_namespace_item(alias={'type': 1, 'mosaicId': MOSAIC_ID})},
				'namespace_names': {NAMESPACE_ROOT_ID: 'root'}
			})
		if mosaics_response is not None:
			connector_arguments['mosaics_response'] = mosaics_response

		return FakeConnector(1, {0: [create_node_block(1)]}, **connector_arguments)

	def test_sync_block_headers_persists_mosaic_discovered_from_definition_transaction(self):
		# Arrange:
		connector = self._create_mosaic_definition_sync_connector()

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		expected_row = create_expected_mosaic_row(create_mosaic_item(), 1)
		self.assertEqual([create_persisted_mosaic_state(expected_row, [])], fetch_mosaic_state(self.puller.symbol_db))
		self.assertEqual(1, connector.paths.count('mosaics'))

	def test_sync_block_headers_persists_mosaic_expired_receipt_and_refreshes_mosaic(self):
		# Arrange:
		mosaic_item = create_mosaic_item(supply='777', item_id='000000000000000000000001')
		connector = FakeConnector(
			1,
			{0: [create_node_block(1)]},
			statement_pages={statement_path(1, 1): {'data': [create_artifact_expiry_statement(
				1, ReceiptType.MOSAIC_EXPIRED.value, MOSAIC_ID)]}},
			mosaics_by_id={MOSAIC_ID: mosaic_item})

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		cursor = self.puller.symbol_db.connection.cursor()
		cursor.execute(
			'SELECT receipt_type, receipt_group, artifact_id, mosaic_id, amount FROM symbol_receipts')
		self.assertEqual([
			('mosaicExpired', 'artifactExpiry', MOSAIC_ID, None, 0)
		], cursor.fetchall())
		self.assertEqual([{'mosaicIds': [MOSAIC_ID]}], [
			payload for path, payload in connector.post_requests if 'mosaics' == path
		])
		self.assertEqual(1, connector.paths.count('mosaics'))
		expected_row = create_expected_mosaic_row(mosaic_item, 1)
		self.assertEqual([create_persisted_mosaic_state(expected_row, [])], fetch_mosaic_state(self.puller.symbol_db))

	def _assert_alias_supply_change_refreshes_mosaic_state(
		self, alias_mosaic_id, transaction_items, resolution_entries, original_supply, new_supply
	):  # pylint: disable=too-many-arguments,too-many-positional-arguments
		# Arrange:
		self.puller.symbol_db.upsert_mosaic(create_expected_mosaic_row(
			create_mosaic_item(supply=str(original_supply)),
			0))
		connector = FakeConnector(
			1,
			{0: [create_node_block(1)]},
			transactions_by_path={transaction_path(1, 1): {'data': transaction_items}},
			mosaic_resolutions_by_height={1: [create_resolution_statement(
				1,
				alias_mosaic_id,
				resolution_entries
			)]},
			mosaics_by_id={MOSAIC_ID: create_mosaic_item(supply=str(new_supply))})

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		mosaic_state = fetch_mosaic_state(self.puller.symbol_db)
		self.assertEqual(new_supply, mosaic_state[0].supply)
		self.assertEqual(1, mosaic_state[0].updated_at_height)
		self.assertEqual([{'mosaicIds': [MOSAIC_ID]}], [
			payload for path, payload in connector.post_requests if 'mosaics' == path
		])
		self.assertEqual([resolution_path('mosaic', 1)], [
			path for path in connector.paths if path.startswith('statements/resolutions/mosaic?')
		])

	def test_sync_block_headers_refreshes_mosaic_supply_for_top_level_alias_supply_change(self):
		alias_mosaic_id = 'A95F1F8A96159516'
		original_supply = 987654321
		supply_delta = 10
		self._assert_alias_supply_change_refreshes_mosaic_state(
			alias_mosaic_id,
			[create_node_transaction(
				1,
				transaction_hash='A' * 64,
				transaction_id='mosaic-supply-change',
				type=TransactionType.MOSAIC_SUPPLY_CHANGE.value,
				mosaicId=alias_mosaic_id,
				delta=str(supply_delta),
				action=MosaicSupplyChangeAction.INCREASE.value)],
			[{'source': {'primaryId': 1, 'secondaryId': 0}, 'resolved': MOSAIC_ID}],
			original_supply,
			original_supply + supply_delta)

	def test_sync_block_headers_refreshes_mosaic_supply_for_embedded_alias_supply_change(self):
		alias_mosaic_id = 'A95F1F8A96159516'
		mosaic_id_at_aggregate_source = '0000000000000002'
		original_supply = 987654321
		supply_delta = 10
		aggregate_hash = 'A' * 64
		self._assert_alias_supply_change_refreshes_mosaic_state(
			alias_mosaic_id,
			create_complete_aggregate_pair(
				1,
				aggregate_hash,
				0,
				transaction_id='embedded-mosaic-supply-change',
				type=TransactionType.MOSAIC_SUPPLY_CHANGE.value,
				mosaicId=alias_mosaic_id,
				delta=str(supply_delta),
				action=MosaicSupplyChangeAction.INCREASE.value),
			[
				# The (1, 0) entry proves the embedded transaction uses (1, 1), not its parent aggregate source.
				{'source': {'primaryId': 1, 'secondaryId': 0}, 'resolved': mosaic_id_at_aggregate_source},
				{'source': {'primaryId': 1, 'secondaryId': 1}, 'resolved': MOSAIC_ID}
			],
			original_supply,
			original_supply + supply_delta)

	def test_sync_block_headers_deletes_dirty_mosaic_when_batch_response_omits_it(self):
		# Arrange:
		self.puller.symbol_db.upsert_mosaic(create_expected_mosaic_row(create_mosaic_item(), 0))
		connector = self._create_mosaic_definition_sync_connector(mosaics_by_id={})

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		self.assertEqual([], fetch_mosaic_state(self.puller.symbol_db))

	def test_sync_block_headers_writes_namespaces_before_mosaics_for_same_batch_alias(self):
		# Arrange:
		connector = self._create_mosaic_definition_sync_connector(include_namespace_alias=True)

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		self.assertEqual(['root'], fetch_mosaic_state(self.puller.symbol_db)[0].alias_names)
		self.assertEqual([
			('namespaces/names', {'namespaceIds': [NAMESPACE_ROOT_ID]}),
			('mosaics', {'mosaicIds': [MOSAIC_ID]})
		], [
			(path, payload) for path, payload in connector.post_requests
			if path in ('namespaces/names', 'mosaics')
		])

	def test_sync_block_headers_rejects_malformed_mosaics_response(self):
		# Arrange:
		connector = self._create_mosaic_definition_sync_connector(mosaics_response={'data': []})

		# Act / Assert:
		self._assert_sync_rejects_node_response(
			connector,
			ValueError,
			'Malformed Symbol mosaics batch response')

		# Assert:
		self.assertEqual(1, connector.paths.count('mosaics'))

	def test_sync_block_headers_does_not_write_any_batch_state_when_mosaic_fetch_fails(self):
		# Arrange:
		connector = self._create_mosaic_definition_sync_connector(
			include_namespace_alias=True,
			mosaics_by_id={MOSAIC_ID: RuntimeError('mosaic fetch failed')})

		# Act / Assert:
		with self.assertRaisesRegex(RuntimeError, 'mosaic fetch failed'):
			self._sync_with_connector(connector)

		# Assert:
		cursor = self.puller.symbol_db.connection.cursor()
		cursor.execute('SELECT COUNT(*) FROM symbol_accounts')
		account_count = cursor.fetchone()[0]
		cursor.execute('SELECT COUNT(*) FROM symbol_namespaces')
		namespace_count = cursor.fetchone()[0]
		cursor.execute('SELECT COUNT(*) FROM symbol_mosaics')
		mosaic_count = cursor.fetchone()[0]
		namespace_rows, alias_rows = fetch_namespace_state(self.puller.symbol_db.connection)
		self.assertEqual([], self._fetch_block_heights(self.puller.symbol_db))
		self.assertEqual(0, account_count)
		self.assertEqual(0, namespace_count)
		self.assertEqual(0, mosaic_count)
		self.assertEqual([], namespace_rows)
		self.assertEqual([], alias_rows)
		self.assertIsNone(self.puller.symbol_db.get_sync_state())

	def test_sync_block_headers_converges_mosaic_state_when_restarted_from_existing_blocks(self):
		# Arrange:
		connector = self._create_mosaic_definition_sync_connector()
		self._sync_with_connector(connector)
		first_mosaic_state = fetch_mosaic_state(self.puller.symbol_db)
		cursor = self.puller.symbol_db.connection.cursor()
		cursor.execute('DELETE FROM symbol_sync_state')
		self.puller.symbol_db.connection.commit()

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		self.assertEqual(first_mosaic_state, fetch_mosaic_state(self.puller.symbol_db))

	def test_sync_block_headers_persists_dirty_namespace_state_after_registration_and_alias_transactions(self):
		# Arrange:
		connector = self._create_namespace_batch_connector()

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		namespace_rows, alias_rows = fetch_namespace_state(self.puller.symbol_db.connection)
		self.assertEqual([
			(
				NAMESPACE_ROOT_ID, None, NAMESPACE_ROOT_ID, 'root', 'root', 1, 'root',
				BENEFICIARY_ADDRESS.lower(), 1, None, 'mosaic', NATIVE_MOSAIC_ID, None,
				create_namespace_item(alias={'type': 1, 'mosaicId': NATIVE_MOSAIC_ID}), 1)
		], namespace_rows)
		self.assertEqual([
			('mosaic', NATIVE_MOSAIC_ID, 'root', 1),
			('namespace', NAMESPACE_ROOT_ID, 'root', 1)
		], alias_rows)
		self.assertEqual([
			{'addresses': [self._beneficiary_address_text()]},
			{'namespaceIds': [NAMESPACE_ROOT_ID]}
		], connector.post_payloads)
		self._assert_namespace_requests(
			connector,
			[NAMESPACE_ROOT_ID],
			[{'namespaceIds': [NAMESPACE_ROOT_ID]}])

	def test_sync_block_headers_deletes_dirty_namespace_state_when_namespace_is_not_found(self):
		# Arrange:
		seed_namespace(self.puller.symbol_db, create_namespace_item(), {NAMESPACE_ROOT_ID: 'root'})
		connector = FakeConnector(
			1,
			{0: [create_node_block(1)]},
			transactions_by_path={
				transaction_path(1, 1): {
					'data': [create_node_transaction(
						1,
						transaction_hash='A' * 64,
						transaction_id='namespace-registration',
						type=TransactionType.NAMESPACE_REGISTRATION.value,
						id=NAMESPACE_ROOT_ID,
						name='root',
						registrationType=0)]
				}
			},
			namespace_by_id={NAMESPACE_ROOT_ID: {
				'code': 'ResourceNotFound',
				'message': f'no resource exists with id {NAMESPACE_ROOT_ID}'
			}}
		)

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		self.assertEqual(([], []), fetch_namespace_state(self.puller.symbol_db.connection))
		self.assertEqual([1], self._fetch_block_heights(self.puller.symbol_db))
		self._assert_namespace_requests(connector, [NAMESPACE_ROOT_ID], [])

	def test_sync_block_headers_rolls_back_namespace_entries_when_later_write_conflicts_with_stale_full_name(self):
		# Arrange:
		first_name = 'first'
		second_name = 'second'
		stale_name = 'stale'
		first_id = f'{generate_namespace_id(first_name):016X}'
		second_id = f'{generate_namespace_id(second_name):016X}'
		stale_id = f'{generate_namespace_id(stale_name):016X}'
		seed_namespace(
			self.puller.symbol_db,
			create_namespace_item(
				namespace_id=first_id,
				root_id=first_id,
				alias={'type': 1, 'mosaicId': 'mosaic-a-old'}),
			{first_id: first_name},
			0)
		# Seed a stale local row that occupies the second namespace's full name,
		# allowing valid Node namespace data to trigger a later persistence failure.
		seed_namespace(
			self.puller.symbol_db,
			create_namespace_item(namespace_id=stale_id, root_id=stale_id),
			{stale_id: second_name},
			0)
		before_state = fetch_namespace_state(self.puller.symbol_db.connection)
		connector = FakeConnector(
			1,
			{0: [create_node_block(1)]},
			transactions_by_path={transaction_path(1, 1): {'data': [
				create_node_transaction(
					1,
					transaction_hash='A' * 64,
					transaction_id='namespace-a-registration',
					type=TransactionType.NAMESPACE_REGISTRATION.value,
					id=first_id,
					name=first_name,
					registrationType=0),
				create_node_transaction(
					1,
					transaction_hash='B' * 64,
					transaction_id='namespace-b-registration',
					type=TransactionType.NAMESPACE_REGISTRATION.value,
					id=second_id,
					name=second_name,
					registrationType=0)
			]}},
			namespace_by_id={
				first_id: create_namespace_item(
					namespace_id=first_id,
					root_id=first_id,
					alias={'type': 1, 'mosaicId': 'mosaic-a-new'}),
				second_id: create_namespace_item(namespace_id=second_id, root_id=second_id)
			},
			namespace_names={first_id: first_name, second_id: second_name})

		# Act:
		with self.assertRaises(PsycopgError):
			self._sync_with_connector(connector)

		# Assert:
		self.assertEqual(before_state, fetch_namespace_state(self.puller.symbol_db.connection))
		self.assertEqual([1], self._fetch_block_heights(self.puller.symbol_db))
		self.assertIsNone(self.puller.symbol_db.get_sync_state())
		self._assert_namespace_requests(
			connector,
			[first_id, second_id],
			[{'namespaceIds': [first_id, second_id]}])

	def test_sync_block_headers_converges_namespace_state_when_restarted_from_existing_blocks(self):
		# Arrange:
		connector = self._create_namespace_batch_connector()
		self._sync_with_connector(connector)
		first_sync_namespace_paths = [
			path for path in connector.paths if path.startswith('namespaces/') and path != 'namespaces/names'
		]
		first_sync_names_payloads = [
			payload for path, payload in connector.post_requests if 'namespaces/names' == path
		]
		first_namespace_state = fetch_namespace_state(self.puller.symbol_db.connection)
		cursor = self.puller.symbol_db.connection.cursor()
		cursor.execute('DELETE FROM symbol_sync_state')
		self.puller.symbol_db.connection.commit()

		# Act:
		self._sync_with_connector(connector)
		second_sync_namespace_paths = [
			path for path in connector.paths if path.startswith('namespaces/') and path != 'namespaces/names'
		][len(first_sync_namespace_paths):]
		second_sync_names_payloads = [
			payload for path, payload in connector.post_requests if 'namespaces/names' == path
		][len(first_sync_names_payloads):]

		# Assert:
		self.assertEqual(first_namespace_state, fetch_namespace_state(self.puller.symbol_db.connection))
		# The two identical requests correspond to the initial sync and the resync after sync state deletion.
		self.assertEqual([f'namespaces/{NAMESPACE_ROOT_ID}'], first_sync_namespace_paths)
		self.assertEqual([f'namespaces/{NAMESPACE_ROOT_ID}'], second_sync_namespace_paths)
		self.assertEqual([{'namespaceIds': [NAMESPACE_ROOT_ID]}], first_sync_names_payloads)
		self.assertEqual([{'namespaceIds': [NAMESPACE_ROOT_ID]}], second_sync_names_payloads)

	def test_sync_block_headers_does_not_write_batch_state_when_namespace_fetch_fails(self):
		# Arrange:
		connector = FakeConnector(
			1,
			{0: [create_node_block(1)]},
			transactions_by_path={
				transaction_path(1, 1): {
					'data': [create_node_transaction(
						1,
						type=TransactionType.NAMESPACE_REGISTRATION.value,
						id=NAMESPACE_ROOT_ID,
						name='root',
						registrationType=0)]
				}
			},
			namespace_by_id={NAMESPACE_ROOT_ID: RuntimeError('namespace fetch failed')})

		# Act:
		with self.assertRaisesRegex(RuntimeError, 'namespace fetch failed'):
			self._sync_with_connector(connector)

		# Assert:
		cursor = self.puller.symbol_db.connection.cursor()
		cursor.execute('SELECT COUNT(*) FROM symbol_accounts')
		account_count = cursor.fetchone()[0]
		cursor.execute('SELECT COUNT(*) FROM symbol_namespaces')
		namespace_count = cursor.fetchone()[0]
		self.assertEqual([], self._fetch_block_heights(self.puller.symbol_db))
		self.assertEqual(0, account_count)
		self.assertEqual(0, namespace_count)
		self.assertIsNone(self.puller.symbol_db.get_sync_state())
		self._assert_namespace_requests(connector, [NAMESPACE_ROOT_ID], [])

	def test_sync_block_headers_ignores_unrelated_transaction_and_receipt_for_namespace_refresh(self):
		# Arrange:
		connector = FakeConnector(
			1,
			{0: [create_node_block(1)]},
			transactions_by_path={transaction_path(1, 1): {'data': [create_node_transaction(
				1,
				type=TransactionType.TRANSFER.value)]}},
			statement_pages={statement_path(1, 1): {'data': [create_artifact_expiry_statement(
				1, ReceiptType.MOSAIC_EXPIRED.value, '0000000000000001')]}})

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		self._assert_namespace_requests(connector, [], [])

	def test_sync_block_headers_makes_no_namespace_requests_for_empty_transaction_and_receipt_batch(self):
		# Arrange:
		connector = FakeConnector(1, {0: [create_node_block(1)]})

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		self._assert_namespace_requests(connector, [], [])

	def test_sync_block_headers_collects_all_namespace_dirty_sources_in_first_encounter_order(self):
		# Arrange:
		namespace_ids = [f'{index:016X}' for index in (8, 2, 7, 1, 6, 3, 5, 4)]
		transactions = [
			create_node_transaction(
				1,
				transaction_hash=f'{index + 100:064X}',
				transaction_id=f'transaction-{index}',
				type=transaction_type,
				**fields)
			for index, transaction_type, fields in [
				(0, TransactionType.NAMESPACE_REGISTRATION.value, {'id': namespace_ids[0]}),
				(1, TransactionType.ADDRESS_ALIAS.value, {'namespaceId': namespace_ids[1], 'aliasAction': 0, 'address': BENEFICIARY_ADDRESS}),
				(2, TransactionType.ADDRESS_ALIAS.value, {'namespaceId': namespace_ids[2], 'aliasAction': 1, 'address': BENEFICIARY_ADDRESS}),
				(3, TransactionType.MOSAIC_ALIAS.value, {'namespaceId': namespace_ids[3], 'aliasAction': 0}),
				(4, TransactionType.MOSAIC_ALIAS.value, {'namespaceId': namespace_ids[4], 'aliasAction': 1}),
			]
		]
		transactions.append(create_embedded_node_transaction(
			1,
			'A' * 64,
			1,
			transaction_id='embedded-registration',
			type=TransactionType.NAMESPACE_REGISTRATION.value,
			id=namespace_ids[5]))
		statement_items = [
			create_artifact_expiry_statement(1, ReceiptType.NAMESPACE_EXPIRED.value, namespace_ids[6]),
			create_artifact_expiry_statement(1, ReceiptType.NAMESPACE_DELETED.value, namespace_ids[7])
		]
		connector = FakeConnector(
			1,
			{0: [create_node_block(1)]},
			transactions_by_path={transaction_path(1, 1): {'data': transactions}},
			statement_pages={statement_path(1, 1): {'data': statement_items}},
			namespace_by_id={
				namespace_id: create_namespace_item(namespace_id=namespace_id, root_id=namespace_id)
				for namespace_id in namespace_ids
			},
			namespace_names={namespace_id: f'name-{namespace_id}' for namespace_id in namespace_ids})

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		self._assert_namespace_requests(connector, namespace_ids, [{'namespaceIds': namespace_ids}])

	def test_sync_block_headers_resolves_duplicate_and_ancestor_namespace_names(self):
		# Arrange:
		connector = NamespaceNamesResponseConnector(
			1,
			{0: [create_node_block(1)]},
			transactions_by_path={transaction_path(1, 1): {'data': [create_node_transaction(
				1,
				type=TransactionType.NAMESPACE_REGISTRATION.value,
				id=NAMESPACE_SUB_ID)]}},
			namespace_by_id={NAMESPACE_SUB_ID: create_namespace_item(
				namespace_id=NAMESPACE_SUB_ID,
				root_id=NAMESPACE_ROOT_ID,
				parent_id=NAMESPACE_ROOT_ID)},
			names_response=[
				{'id': NAMESPACE_ROOT_ID, 'name': 'root'},
				{'id': NAMESPACE_SUB_ID, 'name': 'sub', 'parentId': NAMESPACE_ROOT_ID},
				{'id': NAMESPACE_ROOT_ID, 'name': 'root'}
			])
		# Only the child is dirty; its root name comes from the ancestor entry returned by POST /namespaces/names.

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		cursor = self.puller.symbol_db.connection.cursor()
		cursor.execute('SELECT name, full_name FROM symbol_namespaces')
		self.assertEqual([('sub', 'root.sub')], cursor.fetchall())
		self._assert_namespace_requests(
			connector,
			[NAMESPACE_SUB_ID],
			[{'namespaceIds': [NAMESPACE_ROOT_ID, NAMESPACE_SUB_ID]}])

	def test_sync_block_headers_rejects_malformed_namespace_names_response_before_writes(self):
		# Arrange:
		connector = NamespaceNamesResponseConnector(
			1,
			{0: [create_node_block(1)]},
			transactions_by_path={transaction_path(1, 1): {'data': [create_node_transaction(
				1,
				type=TransactionType.NAMESPACE_REGISTRATION.value,
				id=NAMESPACE_ROOT_ID)]}},
			namespace_by_id={NAMESPACE_ROOT_ID: create_namespace_item()},
			names_response={'data': []})

		# Act / Assert:
		with self.assertRaisesRegex(ValueError, 'Malformed Symbol namespace names response'):
			self._sync_with_connector(connector)

		# Assert:
		self.assertEqual([], self._fetch_block_heights(self.puller.symbol_db))
		self.assertIsNone(self.puller.symbol_db.get_sync_state())
		self._assert_namespace_requests(
			connector,
			[NAMESPACE_ROOT_ID],
			[{'namespaceIds': [NAMESPACE_ROOT_ID]}])

	def test_sync_block_headers_fetches_namespace_details_concurrently_in_bounded_chunks(self):
		# Arrange:
		namespace_ids = [f'{index:016X}' for index in range(1, MAX_PAGE_SIZE + 2)]
		connector = BoundedNamespaceDetailConnector(
			1,
			{0: [create_node_block(1)]},
			transactions_by_path={transaction_path(1, 1): {'data': [
				create_node_transaction(
					1,
					transaction_hash=f'{index + 100:064X}',
					transaction_id=f'namespace-{index}',
					type=TransactionType.NAMESPACE_REGISTRATION.value,
					id=namespace_id)
				for index, namespace_id in enumerate(namespace_ids)
			]}},
			namespace_by_id={
				namespace_id: create_namespace_item(namespace_id=namespace_id, root_id=namespace_id)
				for namespace_id in namespace_ids
			},
			namespace_names={namespace_id: f'name-{namespace_id}' for namespace_id in namespace_ids})
		set_symbol_rate_limiter(self.puller, NoOpRateLimiter())

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		self.assertEqual(
			[f'namespaces/{namespace_id}' for namespace_id in namespace_ids],
			connector.detail_paths)
		self._assert_namespace_requests(
			connector,
			namespace_ids,
			[
				{'namespaceIds': namespace_ids[:MAX_PAGE_SIZE]},
				{'namespaceIds': namespace_ids[MAX_PAGE_SIZE:]}
			])
		self.assertGreater(connector.max_in_flight_detail_requests, 1)
		self.assertLessEqual(connector.max_in_flight_detail_requests, MAX_PAGE_SIZE)
		self.assertEqual(0, connector.in_flight_detail_requests)

	def _assert_sync_request_counts(self, connector, block_page_count, batch_count):
		# Assert:
		block_paths = [
			path for path in connector.paths
			if path.startswith('blocks?pageSize=100&offset=')
		]
		transaction_paths = [
			path for path in connector.paths
			if path.startswith('transactions/confirmed?')
		]
		statement_paths = [
			path for path in connector.paths
			if path.startswith('statements/transaction?')
		]
		account_paths = [
			path for path in connector.paths
			if 'accounts' == path
		]
		multisig_paths = [
			path for path in connector.paths
			if path.startswith('account/') and path.endswith('/multisig')
		]

		self.assertEqual(1, connector.paths.count('chain/info'))
		self.assertEqual(1, connector.paths.count('network/properties'))
		self.assertEqual(1, connector.paths.count(f'mosaics/{NATIVE_MOSAIC_ID}'))
		self.assertEqual(block_page_count, len(block_paths))
		self.assertEqual(batch_count, len(transaction_paths))
		self.assertEqual(batch_count, len(statement_paths))
		self.assertEqual(batch_count, len(account_paths))
		self.assertEqual(batch_count, len(multisig_paths))
		self.assertEqual(3 + block_page_count + 4 * batch_count, len(connector.paths))

	def test_sync_block_headers_pulls_chain_info_network_properties_and_blocks(
		self
	):
		# Arrange:
		connector = FakeConnector(
			2,
			{0: [create_node_block(1), create_node_block(2)]}
		)

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		beneficiary_address_text = self._beneficiary_address_text()
		self.assertEqual([
			'chain/info',
			'network/properties',
			f'mosaics/{NATIVE_MOSAIC_ID}',
			'blocks?pageSize=100&offset=0&orderBy=height',
			transaction_path(1, 2),
			statement_path(1, 2),
			'accounts',
			f'account/{beneficiary_address_text}/multisig'
		], connector.paths)

	def test_sync_block_headers_persists_synced_block_watermark(self):
		# Arrange:
		connector = FakeConnector(
			2,
			{0: [create_node_block(1), create_node_block(2)]}
		)

		# Act:
		block_heights, sync_state = self._sync_with_connector(connector)

		# Assert:
		self.assertEqual([1, 2], block_heights)
		self.assertEqual('healthy', sync_state['status'])
		self.assertEqual(2, sync_state['chain_height'])
		self.assertEqual(1, sync_state['finalized_height'])
		self.assertEqual(
			bytes.fromhex(f'{2:064X}'),
			bytes(sync_state['last_synced_block_hash'])
		)

	def test_sync_block_headers_accepts_valid_parent_hash_chain(self):
		# Arrange:
		connector = FakeConnector(
			3,
			{0: [create_node_block(1), create_node_block(2), create_node_block(3)]}
		)

		# Act:
		block_heights, sync_state = self._sync_with_connector(connector)

		# Assert:
		self.assertEqual([1, 2, 3], block_heights)
		self.assertEqual(3, sync_state['last_synced_height'])

	def test_sync_block_headers_accepts_height_one_without_stored_parent_hash(self):
		# Arrange:
		connector = FakeConnector(1, {0: [create_node_block(1, previous_hash='A' * 64)]})

		# Act:
		block_heights, sync_state = self._sync_with_connector(connector)

		# Assert:
		self.assertEqual([1], block_heights)
		self.assertEqual(1, sync_state['last_synced_height'])

	def test_sync_block_headers_rejects_parent_hash_mismatch_at_stored_block_boundary(self):
		# Arrange:
		stored_height = 1
		connector = FakeConnector(
			2,
			{1: [create_node_block(2, previous_hash='A' * 64)]}
		)
		self._seed_blocks(self.puller.symbol_db, [stored_height])
		existing_sync_state = create_sync_state(
			chain_height=stored_height,
			last_synced_height=stored_height,
			last_synced_block_hash=bytes.fromhex(f'{stored_height:064X}'))
		self.puller.symbol_db.upsert_sync_state(existing_sync_state)
		expected_state = self._fetch_complete_batch_state()
		set_symbol_connector(self.puller, connector)

		# Act / Assert:
		with self.assertRaisesRegex(
			ValueError,
			f'Symbol block chain mismatch at height 2: expected previous hash {1:064X}, got {"A" * 64}'
		):
			asyncio.run(self.puller.sync_block_headers())

		# Assert:
		self.assertEqual(expected_state, self._fetch_complete_batch_state())
		self.assertEqual([
			'chain/info',
			'network/properties',
			f'mosaics/{NATIVE_MOSAIC_ID}',
			'blocks?pageSize=100&offset=1&orderBy=height'
		], connector.paths)

	def test_sync_block_headers_rejects_parent_hash_mismatch_within_page_before_related_fetches(self):
		# Arrange:
		connector = FakeConnector(
			2,
			{0: [create_node_block(1), create_node_block(2, previous_hash='A' * 64)]},
			transactions_by_path={
				transaction_path(1, 2): {'data': [create_node_transaction(2)]}
			},
			statement_pages={
				statement_path(1, 2): {'data': [create_amount_statement_item(2, 2000)]}
			}
		)
		expected_state = self._fetch_complete_batch_state()
		set_symbol_connector(self.puller, connector)

		# Act / Assert:
		with self.assertRaisesRegex(
			ValueError,
			f'Symbol block chain mismatch at height 2: expected previous hash {1:064X}, got {"A" * 64}'
		):
			asyncio.run(self.puller.sync_block_headers())

		# Assert:
		self.assertEqual(expected_state, self._fetch_complete_batch_state())
		self.assertEqual([
			'chain/info',
			'network/properties',
			f'mosaics/{NATIVE_MOSAIC_ID}',
			'blocks?pageSize=100&offset=0&orderBy=height'
		], connector.paths)

	def test_sync_block_headers_rejects_parent_hash_mismatch_at_page_boundary(self):
		# Arrange:
		first_page = [create_node_block(height) for height in range(1, 101)]
		second_page = [create_node_block(101, previous_hash='A' * 64)]
		connector = FakeConnector(101, {0: first_page, 100: second_page})
		expected_state = self._fetch_complete_batch_state()
		set_symbol_connector(self.puller, connector)

		# Act / Assert:
		with self.assertRaisesRegex(
			ValueError,
			f'Symbol block chain mismatch at height 101: expected previous hash {100:064X}, got {"A" * 64}'
		):
			asyncio.run(self.puller.sync_block_headers())

		# Assert:
		self.assertEqual(expected_state, self._fetch_complete_batch_state())
		self.assertEqual([
			'chain/info',
			'network/properties',
			f'mosaics/{NATIVE_MOSAIC_ID}',
			'blocks?pageSize=100&offset=0&orderBy=height',
			'blocks?pageSize=100&offset=100&orderBy=height'
		], connector.paths)

	def test_sync_block_headers_rejects_parent_hash_mismatch_at_block_page_fetch_batch_boundary(self):
		# Arrange:
		chain_height = BLOCK_PAGE_FETCH_CONCURRENCY * MAX_PAGE_SIZE + 1
		pages = {
			offset: [
				create_node_block(height)
				for height in range(offset + 1, min(offset + MAX_PAGE_SIZE + 1, chain_height + 1))
			]
			for offset in range(0, chain_height, MAX_PAGE_SIZE)
		}
		pages[BLOCK_PAGE_FETCH_CONCURRENCY * MAX_PAGE_SIZE] = [
			create_node_block(chain_height, previous_hash='A' * 64)
		]
		connector = FakeConnector(chain_height, pages)
		set_symbol_connector(self.puller, connector)

		# Act / Assert:
		with self.assertRaisesRegex(
			ValueError,
			f'Symbol block chain mismatch at height {chain_height}: '
			f'expected previous hash {chain_height - 1:064X}, got {"A" * 64}'
		):
			asyncio.run(self.puller.sync_block_headers())

		# Assert:
		self.assertEqual(list(range(1, chain_height)), self._fetch_block_heights(self.puller.symbol_db))
		self.assertIsNone(self.puller.symbol_db.get_sync_state())
		block_paths = [path for path in connector.paths if path.startswith('blocks?pageSize=100&offset=')]
		transaction_paths = [path for path in connector.paths if path.startswith('transactions/confirmed?')]
		statement_paths = [path for path in connector.paths if path.startswith('statements/transaction?')]
		self.assertEqual(BLOCK_PAGE_FETCH_CONCURRENCY + 1, len(block_paths))
		self.assertEqual([transaction_path(1, chain_height - 1)], transaction_paths)
		self.assertEqual([statement_path(1, chain_height - 1)], statement_paths)

	def test_sync_block_headers_keeps_previous_watermark_when_next_run_parent_hash_mismatches(self):
		# Arrange:
		first_connector = FakeConnector(1, {0: [create_node_block(1)]})

		# Act:
		self._sync_with_connector(first_connector)

		# Assert:
		first_state = self._fetch_complete_batch_state()
		self.assertEqual(1, self.puller.symbol_db.get_sync_state()['last_synced_height'])

		# Arrange:
		second_connector = FakeConnector(2, {1: [create_node_block(2, previous_hash='A' * 64)]})
		set_symbol_connector(self.puller, second_connector)

		# Act / Assert:
		with self.assertRaisesRegex(
			ValueError,
			f'Symbol block chain mismatch at height 2: expected previous hash {1:064X}, got {"A" * 64}'
		):
			asyncio.run(self.puller.sync_block_headers())

		# Assert:
		self.assertEqual(first_state, self._fetch_complete_batch_state())
		self.assertEqual([
			'chain/info',
			'blocks?pageSize=100&offset=1&orderBy=height'
		], second_connector.paths)

	def test_sync_block_headers_persists_importance_block_fields(self):
		# Arrange:
		connector = FakeConnector(1, {0: [create_node_block(
			1,
			votingEligibleAccountsCount=4,
			harvestingEligibleAccountsCount='17',
			totalVotingBalance='19000235663367',
			previousImportanceBlockHash='86' * 32
		)]})

		set_symbol_connector(self.puller, connector)

		# Act:
		asyncio.run(self.puller.sync_block_headers())

		# Assert:
		result = self._fetch_importance_block_fields(self.puller.symbol_db, 1)

		self.assertEqual(4, result[0])
		self.assertEqual(17, result[1])
		self.assertEqual(19000235663367, result[2])
		self.assertEqual(bytes.fromhex('86' * 32), bytes(result[3]))

	def test_sync_block_headers_paginates_by_offset(self):
		# Arrange:
		first_page = [create_node_block(height) for height in range(1, 101)]
		second_page = [create_node_block(101)]
		connector = FakeConnector(101, {0: first_page, 100: second_page})

		# Act:
		_, sync_state = self._sync_with_connector(connector)

		# Assert:
		self.assertIn(
			'blocks?pageSize=100&offset=0&orderBy=height',
			connector.paths
		)
		self.assertIn(
			'blocks?pageSize=100&offset=100&orderBy=height',
			connector.paths
		)
		self.assertEqual(101, sync_state['last_synced_height'])

	def test_sync_block_headers_fetches_multiple_pages_in_single_batch(self):
		# Arrange: 3 pages (offsets 0, 100, 200) within one batch
		first_page = [create_node_block(height) for height in range(1, 101)]
		second_page = [create_node_block(height) for height in range(101, 201)]
		third_page = [create_node_block(201)]
		connector = FakeConnector(
			201,
			{0: first_page, 100: second_page, 200: third_page}
		)

		# Act:
		block_heights, sync_state = self._sync_with_connector(connector)

		# Assert:
		self._assert_sync_request_counts(connector, block_page_count=3, batch_count=1)
		self.assertEqual(list(range(1, 202)), block_heights)
		self.assertEqual(201, sync_state['last_synced_height'])

	def test_sync_block_headers_splits_into_multiple_batches(self):
		# Arrange: 11 pages (offsets 0..1000) requires 2 batches when concurrency=10;
		# last page is short so the early-return path in batch 2 is exercised
		total_pages = BLOCK_PAGE_FETCH_CONCURRENCY + 1
		chain_height = total_pages * 100 - 50
		pages = {
			offset: [
				create_node_block(height)
				for height in range(
					offset + 1,
					min(offset + 101, chain_height + 1)
				)
			]
			for offset in range(0, chain_height, 100)
		}
		connector = FakeConnector(chain_height, pages)

		# Act:
		block_heights, sync_state = self._sync_with_connector(connector)

		# Assert:
		self._assert_sync_request_counts(connector, block_page_count=11, batch_count=2)
		self.assertEqual(list(range(1, chain_height + 1)), block_heights)
		self.assertEqual(chain_height, sync_state['last_synced_height'])
		self.assertEqual('healthy', sync_state['status'])

	def test_sync_block_headers_stops_at_max_height(self):
		# Arrange:
		connector = FakeConnector(
			101,
			{0: [create_node_block(height) for height in range(1, 101)]}
		)

		# Act:
		block_heights, sync_state = self._sync_with_connector(
			connector,
			max_height=2
		)

		# Assert:
		beneficiary_address_text = self._beneficiary_address_text()
		self.assertEqual([
			'chain/info',
			'network/properties',
			f'mosaics/{NATIVE_MOSAIC_ID}',
			'blocks?pageSize=100&offset=0&orderBy=height',
			transaction_path(1, 2),
			statement_path(1, 2),
			'accounts',
			f'account/{beneficiary_address_text}/multisig'
		], connector.paths)
		self.assertEqual([1, 2], block_heights)
		self.assertEqual('healthy', sync_state['status'])
		self.assertEqual(2, sync_state['chain_height'])
		self.assertEqual(2, sync_state['last_synced_height'])

	def test_sync_block_headers_caps_finalization_to_max_height(self):
		# Arrange:
		connector = FakeConnector(
			5,
			{0: [create_node_block(height) for height in range(1, 6)]},
			finalized_height=5
		)

		# Act:
		_, sync_state = self._sync_with_connector(connector, max_height=2)

		# Assert:
		self.assertEqual(2, sync_state['chain_height'])
		self.assertEqual(2, sync_state['finalized_height'])
		self.assertEqual(
			bytes.fromhex(f'{2:064X}'),
			bytes(sync_state['finalized_hash'])
		)
		self.assertIsNone(sync_state['finalized_epoch'])
		self.assertIsNone(sync_state['finalized_point'])

	def test_sync_block_headers_continues_from_existing_sync_state(self):
		# Arrange:
		connector = FakeConnector(
			4,
			{2: [create_node_block(3), create_node_block(4)]},
			{2: create_node_block(2)}
		)
		self._seed_blocks(self.puller.symbol_db, [1, 2])
		self.puller.symbol_db.upsert_sync_state(create_sync_state(
			chain_height=2,
			last_synced_height=2,
			last_synced_block_hash=bytes.fromhex(f'{2:064X}')
		))
		set_symbol_connector(self.puller, connector)

		# Act:
		asyncio.run(self.puller.sync_block_headers())

		# Assert:
		block_heights = self._fetch_block_heights(self.puller.symbol_db)
		sync_state = self.puller.symbol_db.get_sync_state()

		beneficiary_address_text = self._beneficiary_address_text()
		self.assertEqual([
			'chain/info',
			'network/properties',
			f'mosaics/{NATIVE_MOSAIC_ID}',
			'blocks/2',
			'blocks?pageSize=100&offset=2&orderBy=height',
			transaction_path(3, 4),
			statement_path(3, 4),
			'accounts',
			f'account/{beneficiary_address_text}/multisig'
		], connector.paths)
		self.assertEqual([1, 2, 3, 4], block_heights)
		self.assertEqual('healthy', sync_state['status'])
		self.assertEqual(4, sync_state['chain_height'])
		self.assertEqual(4, sync_state['last_synced_height'])
		self.assertEqual(
			bytes.fromhex(f'{4:064X}'),
			bytes(sync_state['last_synced_block_hash'])
		)

	def test_sync_block_headers_bounds_existing_sync_state_to_max_height(self):
		# Arrange:
		connector = FakeConnector(5, {}, finalized_height=5)
		self._seed_blocks(self.puller.symbol_db, range(1, 6))
		self.puller.symbol_db.upsert_sync_state(create_sync_state(
			chain_height=5,
			finalized_height=5,
			finalized_hash=bytes.fromhex(f'{5:064X}'),
			last_synced_height=5,
			last_synced_block_hash=bytes.fromhex(f'{5:064X}')
		))
		set_symbol_connector(self.puller, connector)

		# Act:
		asyncio.run(self.puller.sync_block_headers(max_height=2))

		# Assert:
		sync_state = self.puller.symbol_db.get_sync_state()

		self.assertEqual([
			'chain/info',
			'network/properties',
			f'mosaics/{NATIVE_MOSAIC_ID}'
		], connector.paths)
		self.assertEqual(2, sync_state['chain_height'])
		self.assertEqual(2, sync_state['finalized_height'])
		self.assertEqual(2, sync_state['last_synced_height'])
		self.assertEqual(
			bytes.fromhex(f'{2:064X}'),
			bytes(sync_state['finalized_hash'])
		)
		self.assertEqual(
			bytes.fromhex(f'{2:064X}'),
			bytes(sync_state['last_synced_block_hash'])
		)

	def test_sync_block_headers_rejects_missing_capped_finalization_hash(self):
		# Arrange:
		connector = FakeConnector(5, {}, finalized_height=5)
		set_symbol_connector(self.puller, connector)
		set_sync_block_pages(
			self.puller,
			AsyncMock(return_value=(None, None))
		)

		# Act / Assert:
		with self.assertRaisesRegex(
			ValueError,
			'Unable to determine finalized hash for height 2'
		):
			asyncio.run(self.puller.sync_block_headers(max_height=2))

		# Assert:
		self.assertIsNone(self.puller.symbol_db.get_sync_state())

	def test_get_receipt_rows_by_height_groups_rows_after_reading_all_pages(self):
		# Arrange:
		first_page = [
			create_amount_statement_item(1, 10),
			create_amount_statement_item(2, 20),
			*[
				create_statement_item(
					3,
					{'version': 1, 'type': ReceiptType.ADDRESS_ALIAS_RESOLUTION.value},
					f'statement-3-address-alias-{index}')
				for index in range(MAX_PAGE_SIZE - 2)
			]
		]
		connector = ResponseConnector({
			statement_path(1, 3, 1): {'data': first_page},
			statement_path(1, 3, 2): {'data': [create_amount_statement_item(2, 30)]}
		})
		set_symbol_connector(self.puller, connector)

		# Act:
		rows_by_height = asyncio.run(self.puller._get_receipt_rows_by_height(1, 3))  # pylint: disable=protected-access

		# Assert:
		self.assertEqual([
			statement_path(1, 3, 1),
			statement_path(1, 3, 2)
		], connector.paths)
		self.assertEqual([1, 2], sorted(rows_by_height.keys()))
		self.assertEqual([10], [row['amount'] for row in rows_by_height[1]])
		self.assertEqual([20, 30], [row['amount'] for row in rows_by_height[2]])

	def test_sync_block_batch_upserts_empty_heights_and_writes_previously_fetched_receipts(self):
		# Arrange:
		self._seed_blocks(self.puller.symbol_db, [5, 6, 7])
		block_rows = [
			create_block_row(create_node_block(height), 100, self.puller.symbol_facade.network)
			for height in [5, 6, 7]
		]
		receipt_rows_by_height = {6: create_receipt_rows(create_amount_statement_item(6, 600))}

		# Act:
		self.puller._sync_block_batch(block_rows, {}, receipt_rows_by_height)  # pylint: disable=protected-access

		# Assert:
		self.assertEqual([
			(6, 'inflation', 'inflation', 6, 0, '72C0212E67A08BCE', 600)
		], self._fetch_receipts(self.puller.symbol_db))
		self.assertEqual(0, self._fetch_block_reward(self.puller.symbol_db, 5))
		self.assertEqual(600, self._fetch_block_reward(self.puller.symbol_db, 6))
		self.assertEqual(0, self._fetch_block_reward(self.puller.symbol_db, 7))

	def test_sync_block_headers_rejects_malformed_statement_page_response(self):
		# Arrange:
		connector = ResponseConnector({
			'chain/info': {
				'height': '1',
				'latestFinalizedBlock': {
					'finalizationEpoch': 4,
					'finalizationPoint': 5,
					'height': '1',
					'hash': f'{1:064X}'
				}
			},
			'network/properties': create_network_properties(),
			'blocks?pageSize=100&offset=0&orderBy=height': {'data': [create_node_block(1)]},
			transaction_path(1, 1): {'data': []},
			statement_path(1, 1): {'pagination': {'pageNumber': 1}}
		})

		# Act / Assert:
		self._assert_sync_rejects_node_response(
			connector,
			ValueError,
			'Malformed Symbol statement page response'
		)

	def test_calculate_block_reward_sums_only_inflation_receipts(self):
		# Arrange:
		receipts = [
			{'receipt_type': 'inflation', 'amount': 11},
			{'receipt_type': 'harvestFee', 'amount': 100},
			{'receipt_type': 'inflation', 'amount': 22}
		]

		# Act:
		block_reward = self.puller._calculate_block_reward(receipts)  # pylint: disable=protected-access

		# Assert:
		self.assertEqual(33, block_reward)

	def test_calculate_block_reward_returns_zero_when_inflation_receipts_are_absent(self):
		# Arrange:
		receipts = [
			{'receipt_type': 'harvestFee', 'amount': 100}
		]

		# Act:
		block_reward = self.puller._calculate_block_reward(receipts)  # pylint: disable=protected-access

		# Assert:
		self.assertEqual(0, block_reward)

	def test_sync_block_headers_does_not_advance_watermark_when_receipt_range_fetch_fails(self):
		# Arrange:
		connector = ResponseConnector({
			'chain/info': {
				'height': '1',
				'latestFinalizedBlock': {
					'finalizationEpoch': 4,
					'finalizationPoint': 5,
					'height': '1',
					'hash': f'{1:064X}'
				}
			},
			'network/properties': create_network_properties(),
			'blocks?pageSize=100&offset=0&orderBy=height': {'data': [create_node_block(1)]},
			transaction_path(1, 1): {'data': []},
			statement_path(1, 1): {
				'code': 'InternalError',
				'message': 'statement range failed'
			}
		})
		set_symbol_connector(self.puller, connector)

		# Act / Assert:
		with self.assertRaisesRegex(NodeException, 'InternalError: statement range failed'):
			asyncio.run(self.puller.sync_block_headers())

		# Assert:
		self.assertEqual([], self._fetch_block_heights(self.puller.symbol_db))
		self.assertIsNone(self.puller.symbol_db.get_sync_state())

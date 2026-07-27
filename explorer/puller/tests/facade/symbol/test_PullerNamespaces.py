from symbolchain.sc import AliasAction, ReceiptType, TransactionType
from symbolchain.symbol.Network import Address

from puller.facade.SymbolPuller import MAX_PAGE_SIZE
from tests.test.SymbolNamespaceTestUtils import (
	NAMESPACE_ROOT_ID,
	NAMESPACE_SUB_ID,
	NAMESPACE_SUB_SUB_ID,
	create_namespace_item,
	fetch_namespace_state,
	seed_namespace
)
from tests.test.SymbolTestConstants import BENEFICIARY_ADDRESS

from .puller_test_utils import (
	NATIVE_MOSAIC_ID,
	FakeConnector,
	SymbolPullerTestBase,
	create_node_block,
	create_node_transaction,
	create_statement_item,
	create_sync_state,
	statement_path,
	transaction_path
)


class SymbolPullerNamespacesTest(SymbolPullerTestBase):
	COMPARISON_NAMESPACE_ID = 'B95F1F8A96159516'
	COMPARISON_MOSAIC_ID = '6BED913FA20223F8'
	COMPARISON_SUB_ID = 'F95F1F8A96159516'

	def _fetch_namespace_updated_heights(self):
		cursor = self.puller.symbol_db.connection.cursor()
		cursor.execute('SELECT namespace_id, updated_at_height FROM symbol_namespaces ORDER BY namespace_id')

		return cursor.fetchall()

	@staticmethod
	def _expected_namespace_row(
		expected,
		expected_owner_address_hex,
		expected_start_height,
		expected_raw_payload,
		observed_height
	):
		return (
			expected[0],
			expected[2],
			expected[1],
			expected[3],
			expected[4],
			expected[5],
			expected[6],
			expected_owner_address_hex,
			expected_start_height,
			expected[10],
			expected[7],
			expected[8],
			expected[9],
			expected_raw_payload,
			observed_height
		)

	def _seed_sync_state_before_height(self, height):
		previous_height = height - 1
		self._seed_blocks(self.puller.symbol_db, range(1, height))
		self.puller.symbol_db.upsert_sync_state(create_sync_state(
			chain_height=previous_height,
			finalized_height=previous_height,
			finalized_hash=bytes.fromhex(f'{previous_height:064X}'),
			last_synced_height=previous_height,
			last_synced_block_hash=bytes.fromhex(f'{previous_height:064X}')))

	@staticmethod
	def _create_namespace_sync_connector(
		transactions,
		namespace_by_id,
		namespace_names,
		statement_items=None,
		height=1
	):
		start_height = height
		return FakeConnector(
			height,
			{height - 1: [create_node_block(height)]},
			finalized_height=max(1, start_height - 1),
			transactions_by_path={transaction_path(height, height): {'data': transactions}},
			statement_pages={statement_path(height, height): {'data': statement_items or []}},
			namespace_by_id=namespace_by_id,
			namespace_names=namespace_names)

	def _assert_namespace_sync_requests(self, connector, start_height, sync_height):
		block_paths = [path for path in connector.paths if path.startswith('blocks?')]
		transaction_paths = [path for path in connector.paths if path.startswith('transactions/confirmed?')]
		statement_paths = [path for path in connector.paths if path.startswith('statements/transaction?')]
		self.assertEqual([
			f'blocks?pageSize={MAX_PAGE_SIZE}&offset={start_height - 1}&orderBy=height'
		], block_paths)
		self.assertEqual([transaction_path(start_height, sync_height)], transaction_paths)
		self.assertEqual([statement_path(start_height, sync_height)], statement_paths)

	def _fetch_blocks_sync_accounts_and_namespaces_state(self):
		cursor = self.puller.symbol_db.connection.cursor()
		state = []
		for table_name, order_by in [
			('symbol_blocks', 'height'),
			('symbol_sync_state', 'id'),
			('symbol_accounts', 'address'),
			('symbol_account_mosaics', 'address, mosaic_id'),
			('symbol_multisig', 'address')
		]:
			cursor.execute(f'SELECT * FROM {table_name} ORDER BY {order_by}')
			state.append(cursor.fetchall())

		state.extend(fetch_namespace_state(self.puller.symbol_db.connection))
		return state

	def test_sync_block_headers_removes_mosaic_alias_when_namespace_is_unlinked(self):
		# Arrange:
		target_item = create_namespace_item(alias={'type': 1, 'mosaicId': NATIVE_MOSAIC_ID})
		comparison_item = create_namespace_item(
			namespace_id=self.COMPARISON_NAMESPACE_ID,
			root_id=self.COMPARISON_NAMESPACE_ID,
			alias={'type': 1, 'mosaicId': self.COMPARISON_MOSAIC_ID})
		seed_namespace(self.puller.symbol_db, target_item, {NAMESPACE_ROOT_ID: 'root'})
		seed_namespace(self.puller.symbol_db, comparison_item, {self.COMPARISON_NAMESPACE_ID: 'other'})
		current_item = create_namespace_item(alias={'type': 0})
		connector = self._create_namespace_sync_connector(
			[create_node_transaction(
				1,
				transaction_hash='A' * 64,
				transaction_id='mosaic-alias-unlink',
				type=TransactionType.MOSAIC_ALIAS.value,
				namespaceId=NAMESPACE_ROOT_ID,
				mosaicId=NATIVE_MOSAIC_ID,
				aliasAction=AliasAction.UNLINK.value)],
			{NAMESPACE_ROOT_ID: current_item},
			{NAMESPACE_ROOT_ID: 'root'})

		# Act:
		block_heights, sync_state = self._sync_with_connector(connector)

		# Assert:
		self.assertEqual([
			self._expected_namespace_row(
				(NAMESPACE_ROOT_ID, NAMESPACE_ROOT_ID, None, 'root', 'root', 1, 'root', 'none', None, None, None),
				BENEFICIARY_ADDRESS.lower(), 1, current_item, 1),
			self._expected_namespace_row(
				(self.COMPARISON_NAMESPACE_ID, self.COMPARISON_NAMESPACE_ID, None, 'other', 'other', 1, 'root', 'mosaic',
					self.COMPARISON_MOSAIC_ID, None, None),
				BENEFICIARY_ADDRESS.lower(), 1, comparison_item, 0)
		], fetch_namespace_state(self.puller.symbol_db.connection)[0])
		self.assertEqual([
			('mosaic', self.COMPARISON_MOSAIC_ID, 'other', 0),
			('namespace', NAMESPACE_ROOT_ID, 'root', 1),
			('namespace', self.COMPARISON_NAMESPACE_ID, 'other', 0)
		], fetch_namespace_state(self.puller.symbol_db.connection)[1])
		self.assertEqual([1], block_heights)
		self.assertEqual(1, sync_state['last_synced_height'])
		self._assert_namespace_requests(connector, [NAMESPACE_ROOT_ID], [{'namespaceIds': [NAMESPACE_ROOT_ID]}])
		self._assert_namespace_sync_requests(connector, 1, 1)

	def test_sync_block_headers_replaces_mosaic_alias_with_address_alias(self):
		# Arrange:
		target_item = create_namespace_item(alias={'type': 1, 'mosaicId': NATIVE_MOSAIC_ID})
		comparison_item = create_namespace_item(
			namespace_id=self.COMPARISON_NAMESPACE_ID,
			root_id=self.COMPARISON_NAMESPACE_ID,
			alias={'type': 0})
		seed_namespace(self.puller.symbol_db, target_item, {NAMESPACE_ROOT_ID: 'root'})
		seed_namespace(self.puller.symbol_db, comparison_item, {self.COMPARISON_NAMESPACE_ID: 'other'})
		current_item = create_namespace_item(alias={'type': 2, 'address': BENEFICIARY_ADDRESS})
		connector = self._create_namespace_sync_connector(
			[
				create_node_transaction(
					1,
					transaction_hash='A' * 64,
					transaction_id='mosaic-alias-unlink',
					type=TransactionType.MOSAIC_ALIAS.value,
					namespaceId=NAMESPACE_ROOT_ID,
					mosaicId=NATIVE_MOSAIC_ID,
					aliasAction=AliasAction.UNLINK.value),
				create_node_transaction(
					1,
					transaction_hash='B' * 64,
					transaction_id='address-alias-link',
					type=TransactionType.ADDRESS_ALIAS.value,
					namespaceId=NAMESPACE_ROOT_ID,
					address=BENEFICIARY_ADDRESS,
					aliasAction=AliasAction.LINK.value)
			],
			{NAMESPACE_ROOT_ID: current_item},
			{NAMESPACE_ROOT_ID: 'root'})

		# Act:
		block_heights, sync_state = self._sync_with_connector(connector)

		# Assert:
		self.assertEqual([
			self._expected_namespace_row(
				(NAMESPACE_ROOT_ID, NAMESPACE_ROOT_ID, None, 'root', 'root', 1, 'root', 'address', None,
					BENEFICIARY_ADDRESS.lower(), None),
				BENEFICIARY_ADDRESS.lower(), 1, current_item, 1),
			self._expected_namespace_row(
				(self.COMPARISON_NAMESPACE_ID, self.COMPARISON_NAMESPACE_ID, None, 'other', 'other', 1, 'root', 'none', None, None, None),
				BENEFICIARY_ADDRESS.lower(), 1, comparison_item, 0)
		], fetch_namespace_state(self.puller.symbol_db.connection)[0])
		self.assertEqual([
			('namespace', NAMESPACE_ROOT_ID, 'root', 1),
			('namespace', self.COMPARISON_NAMESPACE_ID, 'other', 0),
			('account', str(Address.from_decoded_address_hex_string(BENEFICIARY_ADDRESS)), 'root', 1)
		], fetch_namespace_state(self.puller.symbol_db.connection)[1])
		self.assertEqual([1], block_heights)
		self.assertEqual(1, sync_state['last_synced_height'])
		self._assert_namespace_requests(connector, [NAMESPACE_ROOT_ID], [{'namespaceIds': [NAMESPACE_ROOT_ID]}])
		self._assert_namespace_sync_requests(connector, 1, 1)

	def test_sync_block_headers_refreshes_expired_namespace_tree_during_grace_period(self):
		# Arrange:
		expiry_height = 5
		root_item = create_namespace_item(alias={'type': 0}, end_height=str(expiry_height))
		child_item = create_namespace_item(
			namespace_id=NAMESPACE_SUB_ID, root_id=NAMESPACE_ROOT_ID, parent_id=NAMESPACE_ROOT_ID,
			level_ids=[NAMESPACE_ROOT_ID, NAMESPACE_SUB_ID], alias={'type': 1, 'mosaicId': NATIVE_MOSAIC_ID},
			end_height=str(expiry_height))
		grandchild_item = create_namespace_item(
			namespace_id=NAMESPACE_SUB_SUB_ID, root_id=NAMESPACE_ROOT_ID, parent_id=NAMESPACE_SUB_ID,
			level_ids=[NAMESPACE_ROOT_ID, NAMESPACE_SUB_ID, NAMESPACE_SUB_SUB_ID],
			alias={'type': 2, 'address': BENEFICIARY_ADDRESS}, end_height=str(expiry_height))
		comparison_item = create_namespace_item(
			namespace_id=self.COMPARISON_NAMESPACE_ID, root_id=self.COMPARISON_NAMESPACE_ID,
			alias={'type': 1, 'mosaicId': self.COMPARISON_MOSAIC_ID})
		seed_namespace(self.puller.symbol_db, root_item, {NAMESPACE_ROOT_ID: 'root'}, expiry_height - 1)
		seed_namespace(self.puller.symbol_db, child_item, {NAMESPACE_ROOT_ID: 'root', NAMESPACE_SUB_ID: 'child'}, expiry_height - 1)
		seed_namespace(
			self.puller.symbol_db,
			grandchild_item,
			{NAMESPACE_ROOT_ID: 'root', NAMESPACE_SUB_ID: 'child', NAMESPACE_SUB_SUB_ID: 'grandchild'},
			expiry_height - 1)
		seed_namespace(self.puller.symbol_db, comparison_item, {self.COMPARISON_NAMESPACE_ID: 'other'}, expiry_height - 1)
		for item in (root_item, child_item, grandchild_item):
			item['meta']['active'] = False
		connector = self._create_namespace_sync_connector(
			[],
			{NAMESPACE_ROOT_ID: root_item, NAMESPACE_SUB_ID: child_item, NAMESPACE_SUB_SUB_ID: grandchild_item},
			{NAMESPACE_ROOT_ID: 'root', NAMESPACE_SUB_ID: 'child', NAMESPACE_SUB_SUB_ID: 'grandchild'},
			[create_statement_item(expiry_height, 10, ReceiptType.NAMESPACE_EXPIRED.value, artifactId=NAMESPACE_ROOT_ID)],
			height=expiry_height)
		self._seed_sync_state_before_height(expiry_height)

		# Act:
		block_heights, sync_state = self._sync_with_connector(connector)

		# Assert:
		namespace_rows, alias_rows = fetch_namespace_state(self.puller.symbol_db.connection)
		self.assertEqual([
			self._expected_namespace_row(
				(NAMESPACE_ROOT_ID, NAMESPACE_ROOT_ID, None, 'root', 'root', 1, 'root', 'none', None, None, expiry_height),
				BENEFICIARY_ADDRESS.lower(), 1, root_item, expiry_height),
			self._expected_namespace_row(
				(self.COMPARISON_NAMESPACE_ID, self.COMPARISON_NAMESPACE_ID, None, 'other', 'other', 1, 'root', 'mosaic',
					self.COMPARISON_MOSAIC_ID, None, None),
				BENEFICIARY_ADDRESS.lower(), 1, comparison_item, expiry_height - 1),
			self._expected_namespace_row(
				(NAMESPACE_SUB_SUB_ID, NAMESPACE_ROOT_ID, NAMESPACE_SUB_ID, 'grandchild', 'root.child.grandchild', 3, 'child',
					'address', None, BENEFICIARY_ADDRESS.lower(), expiry_height),
				BENEFICIARY_ADDRESS.lower(), 1, grandchild_item, expiry_height),
			self._expected_namespace_row(
				(NAMESPACE_SUB_ID, NAMESPACE_ROOT_ID, NAMESPACE_ROOT_ID, 'child', 'root.child', 2, 'child', 'mosaic',
					NATIVE_MOSAIC_ID, None, expiry_height),
				BENEFICIARY_ADDRESS.lower(), 1, child_item, expiry_height)
		], namespace_rows)
		self.assertEqual([
			('mosaic', self.COMPARISON_MOSAIC_ID, 'other', expiry_height - 1),
			('mosaic', NATIVE_MOSAIC_ID, 'root.child', expiry_height),
			('namespace', NAMESPACE_ROOT_ID, 'root', expiry_height),
			('namespace', self.COMPARISON_NAMESPACE_ID, 'other', expiry_height - 1),
			('namespace', NAMESPACE_SUB_SUB_ID, 'root.child.grandchild', expiry_height),
			('namespace', NAMESPACE_SUB_ID, 'root.child', expiry_height),
			('account', str(Address.from_decoded_address_hex_string(BENEFICIARY_ADDRESS)), 'root.child.grandchild', expiry_height)
		], alias_rows)
		self.assertEqual(list(range(1, expiry_height + 1)), block_heights)
		self.assertEqual(expiry_height, sync_state['last_synced_height'])
		self._assert_namespace_requests(
			connector, [NAMESPACE_ROOT_ID, NAMESPACE_SUB_ID, NAMESPACE_SUB_SUB_ID],
			[{'namespaceIds': [NAMESPACE_ROOT_ID, NAMESPACE_SUB_ID, NAMESPACE_SUB_SUB_ID]}])
		self._assert_namespace_sync_requests(connector, expiry_height, expiry_height)

	def test_sync_block_headers_deletes_namespace_and_aliases_when_namespace_deleted_receipt_is_observed(self):
		# Arrange:
		expiry_height = 5
		deletion_height = 6
		root_item = create_namespace_item(alias={'type': 1, 'mosaicId': NATIVE_MOSAIC_ID}, end_height=str(expiry_height))
		child_item = create_namespace_item(
			namespace_id=NAMESPACE_SUB_ID, root_id=NAMESPACE_ROOT_ID, parent_id=NAMESPACE_ROOT_ID,
			level_ids=[NAMESPACE_ROOT_ID, NAMESPACE_SUB_ID], alias={'type': 2, 'address': BENEFICIARY_ADDRESS},
			end_height=str(expiry_height))
		grandchild_item = create_namespace_item(
			namespace_id=NAMESPACE_SUB_SUB_ID, root_id=NAMESPACE_ROOT_ID, parent_id=NAMESPACE_SUB_ID,
			level_ids=[NAMESPACE_ROOT_ID, NAMESPACE_SUB_ID, NAMESPACE_SUB_SUB_ID], alias={'type': 0},
			end_height=str(expiry_height))
		comparison_item = create_namespace_item(
			namespace_id=self.COMPARISON_NAMESPACE_ID, root_id=self.COMPARISON_NAMESPACE_ID,
			alias={'type': 1, 'mosaicId': self.COMPARISON_MOSAIC_ID})
		seed_namespace(self.puller.symbol_db, root_item, {NAMESPACE_ROOT_ID: 'root'}, deletion_height - 2)
		seed_namespace(self.puller.symbol_db, child_item, {NAMESPACE_ROOT_ID: 'root', NAMESPACE_SUB_ID: 'child'}, deletion_height - 2)
		seed_namespace(
			self.puller.symbol_db,
			grandchild_item,
			{NAMESPACE_ROOT_ID: 'root', NAMESPACE_SUB_ID: 'child', NAMESPACE_SUB_SUB_ID: 'grandchild'},
			deletion_height - 2)
		seed_namespace(self.puller.symbol_db, comparison_item, {self.COMPARISON_NAMESPACE_ID: 'other'}, deletion_height - 2)
		connector = self._create_namespace_sync_connector(
			[], {}, {},
			[create_statement_item(deletion_height, 10, ReceiptType.NAMESPACE_DELETED.value, artifactId=NAMESPACE_ROOT_ID)],
			height=deletion_height)
		self._seed_sync_state_before_height(deletion_height)

		# Act:
		block_heights, sync_state = self._sync_with_connector(connector)

		# Assert:
		namespace_rows, alias_rows = fetch_namespace_state(self.puller.symbol_db.connection)
		self.assertEqual([self._expected_namespace_row(
			(self.COMPARISON_NAMESPACE_ID, self.COMPARISON_NAMESPACE_ID, None, 'other', 'other', 1, 'root', 'mosaic',
				self.COMPARISON_MOSAIC_ID, None, None),
			BENEFICIARY_ADDRESS.lower(), 1, comparison_item, deletion_height - 2)], namespace_rows)
		self.assertEqual([
			('mosaic', self.COMPARISON_MOSAIC_ID, 'other', deletion_height - 2),
			('namespace', self.COMPARISON_NAMESPACE_ID, 'other', deletion_height - 2)
		], alias_rows)
		self.assertEqual(list(range(1, deletion_height + 1)), block_heights)
		self.assertEqual(deletion_height, sync_state['last_synced_height'])
		self._assert_namespace_requests(
			connector, [NAMESPACE_ROOT_ID, NAMESPACE_SUB_ID, NAMESPACE_SUB_SUB_ID], [])
		self._assert_namespace_sync_requests(connector, deletion_height, deletion_height)

	def test_sync_block_headers_extends_namespace_end_height_when_renewed_during_grace_period(self):
		# Arrange:
		expiry_height = 5
		renewal_height = 6
		root_item = create_namespace_item(alias={'type': 0}, end_height=str(expiry_height))
		child_item = create_namespace_item(
			namespace_id=NAMESPACE_SUB_ID, root_id=NAMESPACE_ROOT_ID, parent_id=NAMESPACE_ROOT_ID,
			level_ids=[NAMESPACE_ROOT_ID, NAMESPACE_SUB_ID], alias={'type': 0}, end_height=str(expiry_height))
		grandchild_item = create_namespace_item(
			namespace_id=NAMESPACE_SUB_SUB_ID, root_id=NAMESPACE_ROOT_ID, parent_id=NAMESPACE_SUB_ID,
			level_ids=[NAMESPACE_ROOT_ID, NAMESPACE_SUB_ID, NAMESPACE_SUB_SUB_ID], alias={'type': 0},
			end_height=str(expiry_height))
		comparison_item = create_namespace_item(
			namespace_id=self.COMPARISON_NAMESPACE_ID, root_id=self.COMPARISON_NAMESPACE_ID, alias={'type': 0})
		seed_namespace(self.puller.symbol_db, root_item, {NAMESPACE_ROOT_ID: 'root'}, expiry_height - 1)
		seed_namespace(self.puller.symbol_db, child_item, {NAMESPACE_ROOT_ID: 'root', NAMESPACE_SUB_ID: 'child'}, expiry_height - 1)
		seed_namespace(
			self.puller.symbol_db,
			grandchild_item,
			{NAMESPACE_ROOT_ID: 'root', NAMESPACE_SUB_ID: 'child', NAMESPACE_SUB_SUB_ID: 'grandchild'},
			expiry_height - 1)
		seed_namespace(self.puller.symbol_db, comparison_item, {self.COMPARISON_NAMESPACE_ID: 'other'}, expiry_height - 1)
		renewed_items = {
			NAMESPACE_ROOT_ID: create_namespace_item(alias={'type': 0}, end_height='50'),
			NAMESPACE_SUB_ID: create_namespace_item(
				namespace_id=NAMESPACE_SUB_ID, root_id=NAMESPACE_ROOT_ID, parent_id=NAMESPACE_ROOT_ID,
				level_ids=[NAMESPACE_ROOT_ID, NAMESPACE_SUB_ID], alias={'type': 1, 'mosaicId': NATIVE_MOSAIC_ID}, end_height='50'),
			NAMESPACE_SUB_SUB_ID: create_namespace_item(
				namespace_id=NAMESPACE_SUB_SUB_ID, root_id=NAMESPACE_ROOT_ID, parent_id=NAMESPACE_SUB_ID,
				level_ids=[NAMESPACE_ROOT_ID, NAMESPACE_SUB_ID, NAMESPACE_SUB_SUB_ID], alias={'type': 0}, end_height='50')
		}
		connector = self._create_namespace_sync_connector(
			[create_node_transaction(
				renewal_height,
				transaction_hash='A' * 64,
				transaction_id='namespace-renewal',
				type=TransactionType.NAMESPACE_REGISTRATION.value,
				id=NAMESPACE_ROOT_ID,
				name='root',
				registrationType=0)],
			renewed_items,
			{NAMESPACE_ROOT_ID: 'root', NAMESPACE_SUB_ID: 'child', NAMESPACE_SUB_SUB_ID: 'grandchild'},
			height=renewal_height)
		self._seed_sync_state_before_height(renewal_height)

		# Act:
		block_heights, sync_state = self._sync_with_connector(connector)

		# Assert:
		namespace_rows, alias_rows = fetch_namespace_state(self.puller.symbol_db.connection)
		self.assertEqual([
			self._expected_namespace_row(
				(NAMESPACE_ROOT_ID, NAMESPACE_ROOT_ID, None, 'root', 'root', 1, 'root', 'none', None, None, 50),
				BENEFICIARY_ADDRESS.lower(), 1, renewed_items[NAMESPACE_ROOT_ID], renewal_height),
			self._expected_namespace_row(
				(self.COMPARISON_NAMESPACE_ID, self.COMPARISON_NAMESPACE_ID, None, 'other', 'other', 1, 'root', 'none', None, None, None),
				BENEFICIARY_ADDRESS.lower(), 1, comparison_item, expiry_height - 1),
			self._expected_namespace_row(
				(NAMESPACE_SUB_SUB_ID, NAMESPACE_ROOT_ID, NAMESPACE_SUB_ID, 'grandchild', 'root.child.grandchild', 3, 'child',
					'none', None, None, 50),
				BENEFICIARY_ADDRESS.lower(), 1, renewed_items[NAMESPACE_SUB_SUB_ID], renewal_height),
			self._expected_namespace_row(
				(NAMESPACE_SUB_ID, NAMESPACE_ROOT_ID, NAMESPACE_ROOT_ID, 'child', 'root.child', 2, 'child', 'mosaic',
					NATIVE_MOSAIC_ID, None, 50),
				BENEFICIARY_ADDRESS.lower(), 1, renewed_items[NAMESPACE_SUB_ID], renewal_height)
		], namespace_rows)
		self.assertEqual([
			('mosaic', NATIVE_MOSAIC_ID, 'root.child', renewal_height),
			('namespace', NAMESPACE_ROOT_ID, 'root', renewal_height),
			('namespace', self.COMPARISON_NAMESPACE_ID, 'other', expiry_height - 1),
			('namespace', NAMESPACE_SUB_SUB_ID, 'root.child.grandchild', renewal_height),
			('namespace', NAMESPACE_SUB_ID, 'root.child', renewal_height)
		], alias_rows)
		self.assertEqual(list(range(1, renewal_height + 1)), block_heights)
		self.assertEqual(renewal_height, sync_state['last_synced_height'])
		self._assert_namespace_requests(
			connector, [NAMESPACE_ROOT_ID, NAMESPACE_SUB_ID, NAMESPACE_SUB_SUB_ID],
			[{'namespaceIds': [NAMESPACE_ROOT_ID, NAMESPACE_SUB_ID, NAMESPACE_SUB_SUB_ID]}])
		self._assert_namespace_sync_requests(connector, renewal_height, renewal_height)

	def test_sync_block_headers_fetches_each_known_tree_namespace_once_when_root_and_child_are_directly_dirty(self):
		# Arrange:
		root_item = create_namespace_item()
		child_item = create_namespace_item(
			namespace_id=NAMESPACE_SUB_ID, root_id=NAMESPACE_ROOT_ID, parent_id=NAMESPACE_ROOT_ID,
			level_ids=[NAMESPACE_ROOT_ID, NAMESPACE_SUB_ID], alias={'type': 1, 'mosaicId': NATIVE_MOSAIC_ID})
		grandchild_item = create_namespace_item(
			namespace_id=NAMESPACE_SUB_SUB_ID, root_id=NAMESPACE_ROOT_ID, parent_id=NAMESPACE_SUB_ID,
			level_ids=[NAMESPACE_ROOT_ID, NAMESPACE_SUB_ID, NAMESPACE_SUB_SUB_ID])
		seed_namespace(self.puller.symbol_db, root_item, {NAMESPACE_ROOT_ID: 'root'})
		seed_namespace(self.puller.symbol_db, child_item, {NAMESPACE_ROOT_ID: 'root', NAMESPACE_SUB_ID: 'child'})
		seed_namespace(
			self.puller.symbol_db,
			grandchild_item,
			{NAMESPACE_ROOT_ID: 'root', NAMESPACE_SUB_ID: 'child', NAMESPACE_SUB_SUB_ID: 'grandchild'})
		connector = self._create_namespace_sync_connector(
			[
				create_node_transaction(
					1,
					transaction_hash='A' * 64,
					transaction_id='root-registration',
					type=TransactionType.NAMESPACE_REGISTRATION.value,
					id=NAMESPACE_ROOT_ID),
				create_node_transaction(
					1,
					transaction_hash='B' * 64,
					transaction_id='child-alias',
					type=TransactionType.MOSAIC_ALIAS.value,
					namespaceId=NAMESPACE_SUB_ID,
					mosaicId=NATIVE_MOSAIC_ID,
					aliasAction=AliasAction.LINK.value)
			],
			{NAMESPACE_ROOT_ID: root_item, NAMESPACE_SUB_ID: child_item, NAMESPACE_SUB_SUB_ID: grandchild_item},
			{NAMESPACE_ROOT_ID: 'root', NAMESPACE_SUB_ID: 'child', NAMESPACE_SUB_SUB_ID: 'grandchild'})

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		self._assert_namespace_requests(
			connector, [NAMESPACE_ROOT_ID, NAMESPACE_SUB_ID, NAMESPACE_SUB_SUB_ID],
			[{'namespaceIds': [NAMESPACE_ROOT_ID, NAMESPACE_SUB_ID, NAMESPACE_SUB_SUB_ID]}])
		self._assert_namespace_sync_requests(connector, 1, 1)

	def test_sync_block_headers_keeps_direct_child_before_root_and_appends_grandchild_when_root_expands(self):
		# Arrange:
		# The child alias is encountered before root registration, so direct dirty ids are [child, root].
		# Root expansion rediscovers child and discovers grandchild; first-seen dedup keeps direct order and appends only grandchild.
		root_item = create_namespace_item()
		child_item = create_namespace_item(
			namespace_id=NAMESPACE_SUB_ID, root_id=NAMESPACE_ROOT_ID, parent_id=NAMESPACE_ROOT_ID,
			level_ids=[NAMESPACE_ROOT_ID, NAMESPACE_SUB_ID], alias={'type': 1, 'mosaicId': NATIVE_MOSAIC_ID})
		grandchild_item = create_namespace_item(
			namespace_id=NAMESPACE_SUB_SUB_ID, root_id=NAMESPACE_ROOT_ID, parent_id=NAMESPACE_SUB_ID,
			level_ids=[NAMESPACE_ROOT_ID, NAMESPACE_SUB_ID, NAMESPACE_SUB_SUB_ID])
		seed_namespace(self.puller.symbol_db, root_item, {NAMESPACE_ROOT_ID: 'root'})
		seed_namespace(self.puller.symbol_db, child_item, {NAMESPACE_ROOT_ID: 'root', NAMESPACE_SUB_ID: 'child'})
		seed_namespace(
			self.puller.symbol_db,
			grandchild_item,
			{NAMESPACE_ROOT_ID: 'root', NAMESPACE_SUB_ID: 'child', NAMESPACE_SUB_SUB_ID: 'grandchild'})
		connector = self._create_namespace_sync_connector(
			[
				create_node_transaction(
					1,
					transaction_hash='A' * 64,
					transaction_id='child-alias',
					type=TransactionType.MOSAIC_ALIAS.value,
					namespaceId=NAMESPACE_SUB_ID,
					mosaicId=NATIVE_MOSAIC_ID,
					aliasAction=AliasAction.LINK.value),
				create_node_transaction(
					1,
					transaction_hash='B' * 64,
					transaction_id='root-registration',
					type=TransactionType.NAMESPACE_REGISTRATION.value,
					id=NAMESPACE_ROOT_ID)
			],
			{NAMESPACE_SUB_ID: child_item, NAMESPACE_ROOT_ID: root_item, NAMESPACE_SUB_SUB_ID: grandchild_item},
			{NAMESPACE_ROOT_ID: 'root', NAMESPACE_SUB_ID: 'child', NAMESPACE_SUB_SUB_ID: 'grandchild'})

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		self._assert_namespace_requests(
			connector, [NAMESPACE_SUB_ID, NAMESPACE_ROOT_ID, NAMESPACE_SUB_SUB_ID],
			[{'namespaceIds': [NAMESPACE_ROOT_ID, NAMESPACE_SUB_ID, NAMESPACE_SUB_SUB_ID]}])
		self._assert_namespace_sync_requests(connector, 1, 1)

	def test_sync_block_headers_does_not_expand_parent_or_siblings_when_child_is_directly_dirty(self):
		# Arrange:
		root_item = create_namespace_item()
		child_item = create_namespace_item(
			namespace_id=NAMESPACE_SUB_ID, root_id=NAMESPACE_ROOT_ID, parent_id=NAMESPACE_ROOT_ID,
			level_ids=[NAMESPACE_ROOT_ID, NAMESPACE_SUB_ID])
		grandchild_item = create_namespace_item(
			namespace_id=NAMESPACE_SUB_SUB_ID, root_id=NAMESPACE_ROOT_ID, parent_id=NAMESPACE_SUB_ID,
			level_ids=[NAMESPACE_ROOT_ID, NAMESPACE_SUB_ID, NAMESPACE_SUB_SUB_ID])
		comparison_item = create_namespace_item(
			namespace_id=self.COMPARISON_NAMESPACE_ID, root_id=self.COMPARISON_NAMESPACE_ID)
		seed_namespace(self.puller.symbol_db, root_item, {NAMESPACE_ROOT_ID: 'root'})
		seed_namespace(self.puller.symbol_db, child_item, {NAMESPACE_ROOT_ID: 'root', NAMESPACE_SUB_ID: 'child'})
		seed_namespace(
			self.puller.symbol_db,
			grandchild_item,
			{NAMESPACE_ROOT_ID: 'root', NAMESPACE_SUB_ID: 'child', NAMESPACE_SUB_SUB_ID: 'grandchild'})
		seed_namespace(self.puller.symbol_db, comparison_item, {self.COMPARISON_NAMESPACE_ID: 'other'})
		connector = self._create_namespace_sync_connector(
			[create_node_transaction(
				1,
				transaction_hash='A' * 64,
				transaction_id='child-alias',
				type=TransactionType.MOSAIC_ALIAS.value,
				namespaceId=NAMESPACE_SUB_ID,
				mosaicId=NATIVE_MOSAIC_ID,
				aliasAction=AliasAction.LINK.value)],
			{NAMESPACE_SUB_ID: child_item},
			{NAMESPACE_ROOT_ID: 'root', NAMESPACE_SUB_ID: 'child'})

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		self._assert_namespace_requests(
			connector, [NAMESPACE_SUB_ID],
			[{'namespaceIds': [NAMESPACE_ROOT_ID, NAMESPACE_SUB_ID]}])
		self._assert_namespace_sync_requests(connector, 1, 1)
		self.assertEqual([
			(NAMESPACE_ROOT_ID, 0),
			(self.COMPARISON_NAMESPACE_ID, 0),
			(NAMESPACE_SUB_SUB_ID, 0),
			(NAMESPACE_SUB_ID, 1)
		], self._fetch_namespace_updated_heights())

	def test_sync_block_headers_leaves_blocks_sync_accounts_and_namespaces_unchanged_when_descendant_fetch_fails(self):
		# Arrange:
		self._seed_blocks(self.puller.symbol_db, [1])
		self.puller.symbol_db.upsert_sync_state(create_sync_state(
			chain_height=1,
			finalized_height=1,
			finalized_hash=bytes.fromhex(f'{1:064X}'),
			last_synced_height=1,
			last_synced_block_hash=bytes.fromhex(f'{1:064X}')))
		seed_namespace(self.puller.symbol_db, create_namespace_item(), {NAMESPACE_ROOT_ID: 'root'})
		seed_namespace(
			self.puller.symbol_db,
			create_namespace_item(
				namespace_id=NAMESPACE_SUB_ID, root_id=NAMESPACE_ROOT_ID, parent_id=NAMESPACE_ROOT_ID,
				level_ids=[NAMESPACE_ROOT_ID, NAMESPACE_SUB_ID]),
			{NAMESPACE_ROOT_ID: 'root', NAMESPACE_SUB_ID: 'child'})
		before_state = self._fetch_blocks_sync_accounts_and_namespaces_state()
		connector = FakeConnector(
			2,
			{1: [create_node_block(2)]},
			{1: create_node_block(1)},
			transactions_by_path={transaction_path(2, 2): {'data': [create_node_transaction(
				2,
				type=TransactionType.NAMESPACE_REGISTRATION.value,
				id=NAMESPACE_ROOT_ID)]}},
			namespace_by_id={
				NAMESPACE_ROOT_ID: create_namespace_item(),
				NAMESPACE_SUB_ID: RuntimeError('descendant namespace fetch failed')})

		# Act:
		with self.assertRaisesRegex(RuntimeError, 'descendant namespace fetch failed'):
			self._sync_with_connector(connector)

		# Assert:
		self.assertEqual(before_state, self._fetch_blocks_sync_accounts_and_namespaces_state())
		self.assertEqual([
			f'namespaces/{NAMESPACE_ROOT_ID}',
			f'namespaces/{NAMESPACE_SUB_ID}'
		], [path for path in connector.paths if path.startswith('namespaces/') and path != 'namespaces/names'])

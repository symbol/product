import asyncio
from unittest.mock import AsyncMock

from symbolchain.sc import ReceiptType
from symbollightapi.model.Exceptions import NodeException

from puller.facade.SymbolPuller import BLOCK_PAGE_FETCH_CONCURRENCY, STATEMENT_PAGE_SIZE

from .puller_test_utils import (
	FakeConnector,
	ResponseConnector,
	SymbolPullerTestBase,
	create_node_block,
	create_statement_item,
	create_sync_state,
	set_symbol_connector,
	set_sync_block_pages,
	statement_path,
	transaction_path
)


class SymbolPullerSyncTest(SymbolPullerTestBase):

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
		self.assertEqual([
			'chain/info',
			'network/properties',
			'blocks?pageSize=100&offset=0&orderBy=height',
			transaction_path(1, 2),
			statement_path(1, 2)
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
		block_paths = [path for path in connector.paths if path.startswith('blocks?')]
		transaction_paths = [path for path in connector.paths if path.startswith('transactions/confirmed?')]
		self.assertEqual([
			'blocks?pageSize=100&offset=0&orderBy=height',
			'blocks?pageSize=100&offset=100&orderBy=height',
			'blocks?pageSize=100&offset=200&orderBy=height'
		], block_paths)
		self.assertEqual(1, len(transaction_paths))
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
		block_paths = [path for path in connector.paths if path.startswith('blocks?')]
		transaction_paths = [path for path in connector.paths if path.startswith('transactions/confirmed?')]
		self.assertEqual(11, len(block_paths))
		self.assertEqual(2, len(transaction_paths))
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
		self.assertEqual([
			'chain/info',
			'network/properties',
			'blocks?pageSize=100&offset=0&orderBy=height',
			transaction_path(1, 2),
			statement_path(1, 2)
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

		self.assertEqual([
			'chain/info',
			'network/properties',
			'blocks/2',
			'blocks?pageSize=100&offset=2&orderBy=height',
			transaction_path(3, 4),
			statement_path(3, 4)
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
			'network/properties'
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
			create_statement_item(1, 10),
			create_statement_item(2, 20),
			*[
				create_statement_item(3, index, ReceiptType.ADDRESS_ALIAS_RESOLUTION.value)
				for index in range(STATEMENT_PAGE_SIZE - 2)
			]
		]
		connector = ResponseConnector({
			statement_path(1, 3, 1): {'data': first_page},
			statement_path(1, 3, 2): {'data': [create_statement_item(2, 30)]}
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

	def test_sync_receipts_for_batch_upserts_empty_heights_and_queries_batch_range(self):
		# Arrange:
		connector = ResponseConnector({
			statement_path(5, 7): {'data': [create_statement_item(6, 600)]}
		})
		self._seed_blocks(self.puller.symbol_db, [5, 6, 7])
		set_symbol_connector(self.puller, connector)
		block_rows = [
			{'height': 5},
			{'height': 6},
			{'height': 7}
		]

		# Act:
		asyncio.run(self.puller._sync_receipts_for_batch(block_rows))  # pylint: disable=protected-access

		# Assert:
		self.assertEqual([statement_path(5, 7)], connector.paths)
		self.assertEqual([
			(6, ReceiptType.INFLATION.value, 'inflation', 6, 0, '72C0212E67A08BCE', 600)
		], self._fetch_receipts(self.puller.symbol_db))
		self.assertEqual(0, self._fetch_block_reward(self.puller.symbol_db, 5))
		self.assertEqual(600, self._fetch_block_reward(self.puller.symbol_db, 6))
		self.assertEqual(0, self._fetch_block_reward(self.puller.symbol_db, 7))

	def test_calculate_block_reward_sums_only_inflation_receipts(self):
		# Arrange:
		receipts = [
			{'receipt_type': ReceiptType.INFLATION.value, 'amount': 11},
			{'receipt_type': ReceiptType.HARVEST_FEE.value, 'amount': 100},
			{'receipt_type': ReceiptType.INFLATION.value, 'amount': 22}
		]

		# Act:
		block_reward = self.puller._calculate_block_reward(receipts)  # pylint: disable=protected-access

		# Assert:
		self.assertEqual(33, block_reward)

	def test_calculate_block_reward_returns_zero_when_inflation_receipts_are_absent(self):
		# Arrange:
		receipts = [
			{'receipt_type': ReceiptType.HARVEST_FEE.value, 'amount': 100}
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
			'network/properties': {'network': {'epochAdjustment': '100s'}},
			'blocks?pageSize=100&offset=0&orderBy=height': {'data': [create_node_block(1)]},
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
		self.assertIsNone(self.puller.symbol_db.get_sync_state())

import asyncio
from unittest.mock import AsyncMock

from puller.facade.SymbolPuller import BLOCK_PAGE_FETCH_CONCURRENCY

from .puller_test_utils import (
	FakeConnector,
	_create_node_block,
	_create_sync_state,
	_set_symbol_connector,
	_set_sync_block_pages,
	_SymbolPullerTestBase
)


class SymbolPullerSyncTest(_SymbolPullerTestBase):

	def test_sync_block_headers_pulls_chain_info_network_properties_and_blocks(
		self
	):
		# Arrange:
		connector = FakeConnector(
			2,
			{0: [_create_node_block(1), _create_node_block(2)]}
		)

		# Act:
		self._sync_with_connector(connector)

		# Assert:
		self.assertEqual([
			'chain/info',
			'network/properties',
			'blocks?pageSize=100&offset=0&orderBy=height'
		], connector.paths)

	def test_sync_block_headers_persists_synced_block_watermark(self):
		# Arrange:
		connector = FakeConnector(
			2,
			{0: [_create_node_block(1), _create_node_block(2)]}
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
		connector = FakeConnector(1, {0: [_create_node_block(
			1,
			votingEligibleAccountsCount=4,
			harvestingEligibleAccountsCount='17',
			totalVotingBalance='19000235663367',
			previousImportanceBlockHash='86' * 32
		)]})

		self.puller.symbol_db.create_tables()
		_set_symbol_connector(self.puller, connector)

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
		first_page = [_create_node_block(height) for height in range(1, 101)]
		second_page = [_create_node_block(101)]
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
		first_page = [_create_node_block(height) for height in range(1, 101)]
		second_page = [_create_node_block(height) for height in range(101, 201)]
		third_page = [_create_node_block(201)]
		connector = FakeConnector(
			201,
			{0: first_page, 100: second_page, 200: third_page}
		)

		# Act:
		block_heights, sync_state = self._sync_with_connector(connector)

		# Assert:
		self.assertIn(
			'blocks?pageSize=100&offset=0&orderBy=height',
			connector.paths
		)
		self.assertIn(
			'blocks?pageSize=100&offset=100&orderBy=height',
			connector.paths
		)
		self.assertIn(
			'blocks?pageSize=100&offset=200&orderBy=height',
			connector.paths
		)
		self.assertEqual(list(range(1, 202)), block_heights)
		self.assertEqual(201, sync_state['last_synced_height'])

	def test_sync_block_headers_splits_into_multiple_batches(self):
		# Arrange: 11 pages (offsets 0..1000) requires 2 batches when concurrency=10;
		# last page is short so the early-return path in batch 2 is exercised
		total_pages = BLOCK_PAGE_FETCH_CONCURRENCY + 1
		chain_height = total_pages * 100 - 50
		pages = {
			offset: [
				_create_node_block(height)
				for height in range(offset + 1, min(offset + 101, chain_height + 1))
			]
			for offset in range(0, chain_height, 100)
		}
		connector = FakeConnector(chain_height, pages)

		# Act:
		block_heights, sync_state = self._sync_with_connector(connector)

		# Assert:
		self.assertEqual(list(range(1, chain_height + 1)), block_heights)
		self.assertEqual(chain_height, sync_state['last_synced_height'])
		self.assertEqual('healthy', sync_state['status'])

	def test_sync_block_headers_stops_at_max_height(self):
		# Arrange:
		connector = FakeConnector(
			101,
			{0: [_create_node_block(height) for height in range(1, 101)]}
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
			'blocks?pageSize=100&offset=0&orderBy=height'
		], connector.paths)
		self.assertEqual([1, 2], block_heights)
		self.assertEqual('healthy', sync_state['status'])
		self.assertEqual(2, sync_state['chain_height'])
		self.assertEqual(2, sync_state['last_synced_height'])

	def test_sync_block_headers_caps_finalization_to_max_height(self):
		# Arrange:
		connector = FakeConnector(
			5,
			{0: [_create_node_block(height) for height in range(1, 6)]},
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
			{2: [_create_node_block(3), _create_node_block(4)]},
			{2: _create_node_block(2)}
		)
		self.puller.symbol_db.create_tables()
		self._seed_blocks(self.puller.symbol_db, [1, 2])
		self.puller.symbol_db.upsert_sync_state(_create_sync_state(
			chain_height=2,
			last_synced_height=2,
			last_synced_block_hash=bytes.fromhex(f'{2:064X}')
		))
		_set_symbol_connector(self.puller, connector)

		# Act:
		asyncio.run(self.puller.sync_block_headers())

		# Assert:
		block_heights = self._fetch_block_heights(self.puller.symbol_db)
		sync_state = self.puller.symbol_db.get_sync_state()

		self.assertEqual([
			'chain/info',
			'network/properties',
			'blocks/2',
			'blocks?pageSize=100&offset=2&orderBy=height'
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
		self.puller.symbol_db.create_tables()
		self._seed_blocks(self.puller.symbol_db, range(1, 6))
		self.puller.symbol_db.upsert_sync_state(_create_sync_state(
			chain_height=5,
			finalized_height=5,
			finalized_hash=bytes.fromhex(f'{5:064X}'),
			last_synced_height=5,
			last_synced_block_hash=bytes.fromhex(f'{5:064X}')
		))
		_set_symbol_connector(self.puller, connector)

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
		self.puller.symbol_db.create_tables()
		_set_symbol_connector(self.puller, connector)
		_set_sync_block_pages(
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

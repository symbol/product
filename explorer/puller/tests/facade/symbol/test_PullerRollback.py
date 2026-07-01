import asyncio

from puller.facade.SymbolPuller import SymbolRollbackError

from .puller_test_utils import FakeConnector, _create_node_block, _create_sync_state, _set_symbol_connector, _SymbolPullerTestBase


class SymbolPullerRollbackTest(_SymbolPullerTestBase):

	def test_sync_block_headers_repairs_shallow_unfinalized_rollback(self):
		# Arrange:
		connector = FakeConnector(
			3,
			{1: [_create_node_block(2), _create_node_block(3)]},
			{2: _create_node_block(2)}
		)
		self.puller.symbol_db.create_tables()
		self._seed_blocks(
			self.puller.symbol_db,
			[1, 2, 3],
			{2: b'local mismatch'.hex()}
		)
		self.puller.symbol_db.upsert_sync_state(_create_sync_state())
		_set_symbol_connector(self.puller, connector)

		# Act:
		asyncio.run(self.puller.sync_block_headers())

		# Assert:
		block_heights = self._fetch_block_heights(self.puller.symbol_db)
		block_hash = self._fetch_block_hash(self.puller.symbol_db, 2)
		sync_state = self.puller.symbol_db.get_sync_state()

		self.assertEqual([1, 2, 3], block_heights)
		self.assertEqual(
			bytes.fromhex(f'{2:064X}'),
			block_hash
		)
		self.assertEqual('healthy', sync_state['status'])
		self.assertEqual(3, sync_state['last_synced_height'])

	def test_sync_block_headers_marks_deep_finalized_mismatch_unhealthy(self):
		# Arrange:
		connector = FakeConnector(3, {})
		self.puller.symbol_db.create_tables()
		self._seed_blocks(self.puller.symbol_db, [1], {1: b'local mismatch'.hex()})
		self.puller.symbol_db.upsert_sync_state(_create_sync_state(
			finalized_hash=b'old finalized'
		))
		_set_symbol_connector(self.puller, connector)

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
		self.puller.symbol_db.create_tables()
		self.puller.symbol_db.upsert_sync_state(_create_sync_state())
		_set_symbol_connector(self.puller, connector)

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
			{2: _create_node_block(2), 3: _create_node_block(3)},
			finalized_height=3
		)
		self.puller.symbol_db.create_tables()
		self._seed_blocks(self.puller.symbol_db, [1, 2, 3])
		self.puller.symbol_db.upsert_sync_state(_create_sync_state(
			finalized_height=3,
			finalized_hash=bytes.fromhex(f'{3:064X}')
		))
		_set_symbol_connector(self.puller, connector)

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
			{2: _create_node_block(2), 3: _create_node_block(3)}
		)
		self.puller.symbol_db.create_tables()
		self._seed_blocks(self.puller.symbol_db, [1, 2, 3])
		self.puller.symbol_db.upsert_sync_state(_create_sync_state())
		_set_symbol_connector(self.puller, connector)

		# Act:
		asyncio.run(self.puller.sync_block_headers())

		# Assert:
		block_heights = self._fetch_block_heights(self.puller.symbol_db)
		sync_state = self.puller.symbol_db.get_sync_state()

		self.assertEqual([1, 2, 3], block_heights)
		self.assertEqual(3, sync_state['last_synced_height'])
		self.assertEqual(
			['chain/info', 'network/properties', 'blocks/2', 'blocks/3'],
			connector.paths
		)

	def test_sync_block_headers_repairs_missing_unfinalized_block_hash(self):
		# Arrange:
		connector = FakeConnector(
			3,
			{2: [_create_node_block(3)]},
			{2: _create_node_block(2)}
		)
		self.puller.symbol_db.create_tables()
		self._seed_blocks(self.puller.symbol_db, [1, 2])
		self.puller.symbol_db.upsert_sync_state(_create_sync_state())
		_set_symbol_connector(self.puller, connector)

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
			{1: [_create_node_block(2), _create_node_block(3)]}
		)
		self.puller.symbol_db.create_tables()
		self._seed_blocks(self.puller.symbol_db, [1, 3])
		self.puller.symbol_db.upsert_sync_state(_create_sync_state())
		_set_symbol_connector(self.puller, connector)

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
		connector = FakeConnector(1, {0: [_create_node_block(2)]})

		# Act / Assert:
		self._assert_sync_rejects_node_response(
			connector,
			ValueError,
			'Symbol block page at offset 0 does not contain blocks at or '
			'below chain height 1'
		)

	def test_sync_block_headers_rejects_unexpected_height_sequence(self):
		# Arrange:
		connector = FakeConnector(2, {0: [_create_node_block(2)]})
		self.puller.symbol_db.create_tables()
		_set_symbol_connector(self.puller, connector)

		# Act / Assert:
		with self.assertRaisesRegex(
			ValueError,
			'Unexpected Symbol block height 2; expected 1'
		):
			asyncio.run(self.puller.sync_block_headers())

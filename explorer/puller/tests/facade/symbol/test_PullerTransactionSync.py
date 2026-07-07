import asyncio

from puller.facade.SymbolPuller import MAX_PAGE_SIZE

from .puller_test_utils import (
	FakeConnector,
	SymbolPullerTestBase,
	create_embedded_node_transaction,
	create_node_block,
	create_node_transaction,
	create_sync_state,
	set_symbol_connector,
	transaction_path
)


class FakeTransactionDatabase:
	def __init__(self):
		self.calls = []

	def __exit__(self, *_):
		return None

	def upsert_transactions_for_height(self, height, transaction_rows):
		self.calls.append((height, transaction_rows))


class SymbolPullerTransactionSyncTest(SymbolPullerTestBase):

	def test_get_transaction_rows_by_height_stops_after_short_page(self):
		# Arrange:
		connector = FakeConnector(1, {}, transactions_by_path={
			transaction_path(1, 1): {
				'data': [create_node_transaction(1)]
			}
		})
		set_symbol_connector(self.puller, connector)

		# Act:
		rows_by_height = asyncio.run(self.puller._get_transaction_rows_by_height(1, 1, 100))  # pylint: disable=protected-access

		# Assert:
		self.assertEqual([transaction_path(1, 1)], connector.paths)
		self.assertEqual([1], list(rows_by_height.keys()))
		self.assertEqual(1, len(rows_by_height[1]))

	def test_get_transaction_rows_by_height_rejects_malformed_page_response(self):
		# Arrange:
		connector = FakeConnector(1, {}, transactions_by_path={
			transaction_path(1, 1): {
				'pagination': {'pageNumber': 1}
			}
		})
		set_symbol_connector(self.puller, connector)

		# Act + Assert:
		with self.assertRaisesRegex(ValueError, 'Malformed Symbol transaction page response'):
			asyncio.run(self.puller._get_transaction_rows_by_height(1, 1, 100))  # pylint: disable=protected-access

	def test_get_transaction_rows_by_height_continues_after_full_page(self):
		# Arrange:
		first_page = [
			create_node_transaction(1, transaction_hash=f'{index:064X}', transaction_id=f'transaction-{index}')
			for index in range(MAX_PAGE_SIZE)
		]
		connector = FakeConnector(1, {}, transactions_by_path={
			transaction_path(1, 1): {'data': first_page},
			transaction_path(1, 1, 2): {'data': [create_node_transaction(1, transaction_hash='F' * 64, transaction_id='last')]}
		})
		set_symbol_connector(self.puller, connector)

		# Act:
		rows_by_height = asyncio.run(self.puller._get_transaction_rows_by_height(1, 1, 100))  # pylint: disable=protected-access

		# Assert:
		self.assertEqual([
			transaction_path(1, 1),
			transaction_path(1, 1, 2)
		], connector.paths)
		self.assertEqual(MAX_PAGE_SIZE + 1, len(rows_by_height[1]))

	def test_get_transaction_rows_by_height_groups_rows_across_page_boundaries(self):
		# Arrange:
		aggregate_hash = 'A' * 64
		first_page = [
			create_node_transaction(1, transaction_hash=f'{index:064X}', transaction_id=f'height-1-{index}')
			for index in range(MAX_PAGE_SIZE - 1)
		]
		first_page.append(create_node_transaction(
			2,
			transaction_hash=aggregate_hash,
			transaction_id='aggregate',
			type=16705,
			transactionsHash='9' * 64,
			cosignatures=[]
		))
		second_page = [
			create_embedded_node_transaction(2, aggregate_hash, 0, 'embedded'),
			create_node_transaction(3, transaction_hash='C' * 64, transaction_id='height-3')
		]
		connector = FakeConnector(3, {}, transactions_by_path={
			transaction_path(1, 3): {'data': first_page},
			transaction_path(1, 3, 2): {'data': second_page}
		})
		set_symbol_connector(self.puller, connector)

		# Act:
		rows_by_height = asyncio.run(self.puller._get_transaction_rows_by_height(1, 3, 100))  # pylint: disable=protected-access

		# Assert:
		self.assertEqual([1, 2, 3], sorted(rows_by_height.keys()))
		self.assertEqual(MAX_PAGE_SIZE - 1, len(rows_by_height[1]))
		self.assertEqual([
			(bytes.fromhex('A' * 64), None, None),
			(None, bytes.fromhex('A' * 64), 0)
		], [(row['hash'], row['aggregate_hash'], row['embedded_index']) for row in rows_by_height[2]])
		self.assertEqual([
			(bytes.fromhex('C' * 64), None, None)
		], [(row['hash'], row['aggregate_hash'], row['embedded_index']) for row in rows_by_height[3]])

	def test_sync_transactions_for_batch_writes_empty_rows_for_heights_without_transactions(self):
		# Arrange:
		connector = FakeConnector(3, {}, transactions_by_path={
			transaction_path(1, 3): {
				'data': [create_node_transaction(1), create_node_transaction(3, transaction_hash='C' * 64, transaction_id='height-3')]
			}
		})
		transaction_database = FakeTransactionDatabase()
		self.puller.symbol_db = transaction_database
		set_symbol_connector(self.puller, connector)
		block_rows = [{'height': 1}, {'height': 2}, {'height': 3}]

		# Act:
		asyncio.run(self.puller._sync_transactions_for_batch(block_rows, 100))  # pylint: disable=protected-access

		# Assert:
		self.assertEqual([
			(1, [bytes.fromhex(f'{1:064X}')]),
			(2, []),
			(3, [bytes.fromhex('C' * 64)])
		], [
			(height, [row['hash'] for row in transaction_rows])
			for height, transaction_rows in transaction_database.calls
		])

	def test_sync_transactions_for_batch_queries_exact_batch_range(self):
		# Arrange:
		connector = FakeConnector(12, {}, transactions_by_path={
			transaction_path(10, 12): {'data': []}
		})
		self.puller.symbol_db = FakeTransactionDatabase()
		set_symbol_connector(self.puller, connector)
		block_rows = [{'height': 10}, {'height': 11}, {'height': 12}]

		# Act:
		asyncio.run(self.puller._sync_transactions_for_batch(block_rows, 100))  # pylint: disable=protected-access

		# Assert:
		self.assertEqual([transaction_path(10, 12)], connector.paths)

	def test_sync_block_headers_keeps_existing_watermark_when_transaction_fetch_fails(self):
		# Arrange:
		connector = FakeConnector(
			2,
			{1: [create_node_block(2)]},
			{1: create_node_block(1)},
			transactions_by_path={
				transaction_path(2, 2): ValueError('transaction fetch failed')
			}
		)
		self._seed_blocks(self.puller.symbol_db, [1])
		self.puller.symbol_db.upsert_sync_state(create_sync_state(
			chain_height=1,
			last_synced_height=1,
			last_synced_block_hash=bytes.fromhex(f'{1:064X}')
		))
		set_symbol_connector(self.puller, connector)

		# Act + Assert:
		with self.assertRaisesRegex(ValueError, 'transaction fetch failed'):
			asyncio.run(self.puller.sync_block_headers())

		# Assert:
		sync_state = self.puller.symbol_db.get_sync_state()

		self.assertEqual(1, sync_state['last_synced_height'])
		self.assertEqual(bytes.fromhex(f'{1:064X}'), bytes(sync_state['last_synced_block_hash']))

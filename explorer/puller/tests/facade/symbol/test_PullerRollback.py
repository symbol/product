# pylint: disable=duplicate-code
import asyncio

from puller.facade.SymbolPuller import SymbolRollbackError

from ...test.SymbolTestConstants import RECIPIENT_ADDRESS, SIGNER_ADDRESS
from ...test.SymbolTransactionTestUtils import create_transaction_entry
from .puller_test_utils import (
	FakeConnector,
	SymbolPullerTestBase,
	create_node_block,
	create_node_transaction,
	create_statement_item,
	create_sync_state,
	set_symbol_connector,
	statement_path,
	transaction_path
)


class SymbolPullerRollbackTest(SymbolPullerTestBase):
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
						create_statement_item(2, 222),
						create_statement_item(3, 333)
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
			('E74B99BA41F4AFEE', 2000, 'transfer')
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
			['chain/info', 'network/properties', 'blocks/2', 'blocks/3'],
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

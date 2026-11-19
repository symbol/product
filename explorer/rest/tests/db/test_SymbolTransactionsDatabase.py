from contextlib import contextmanager
from unittest import TestCase
from unittest.mock import Mock

from common.symbol.NativeMosaic import NativeMosaicInfo
from psycopg2 import Error as PsycopgError
from symbolchain.sc import TransactionType

from rest.db.SymbolDatabase import SymbolDatabase, SymbolMosaicAliasNotFound, TransactionQuery
from rest.db.SymbolDatabaseCommon import SymbolDataUnavailable
from rest.model.symbol.TransactionView import TransactionViewRecord

from ..test.SymbolBlockTestUtils import create_symbol_block, create_symbol_sync_state
from ..test.SymbolDatabaseTestUtils import (
	PausingAfterSyncStateReadSymbolDatabase,
	create_safe_repairing_sync_state,
	group_records_by_height,
	read_during_database_snapshot,
	symbol_test_database
)
from ..test.SymbolMosaicTestUtils import create_symbol_mosaic
from ..test.SymbolTransactionTestUtils import RECIPIENT_ADDRESS as TRANSACTION_RECIPIENT_ADDRESS
from ..test.SymbolTransactionTestUtils import SIGNER_ADDRESS as TRANSACTION_SIGNER_ADDRESS
from ..test.SymbolTransactionTestUtils import (
	SIGNER_PUBLIC_KEY,
	create_symbol_mosaic_transfer,
	create_symbol_namespace,
	create_symbol_transaction
)

NATIVE_MOSAIC_INFO = NativeMosaicInfo('72C0212E67A08BCE', 6)


class SymbolDatabaseTransactionsTest(TestCase):  # pylint: disable=too-many-public-methods, too-many-lines
	def test_returns_complete_embedded_transactions(self):
		# Arrange:
		mosaic_id = '1234567890ABCDEF'
		aggregate_hash = bytes.fromhex('AA' * 32)
		transactions = [
			create_symbol_transaction(1, 10, type=TransactionType.AGGREGATE_COMPLETE.value, hash=aggregate_hash),
			create_symbol_transaction(
				1, 1, is_embedded=True, aggregate_hash=aggregate_hash,
				mosaic_rows=[{'mosaic_id': mosaic_id, 'amount': 100, 'role': 'transfer', 'position': 0}]),
			create_symbol_transaction(
				1, 0, is_embedded=True, aggregate_hash=aggregate_hash,
				mosaic_rows=[{'mosaic_id': mosaic_id, 'amount': 200, 'role': 'transfer', 'position': 0}]),
		]
		# Act:
		results = _query_symbol_transactions(
			transactions, create_symbol_sync_state(last_synced_height=1, finalized_height=1),
			TransactionQuery(transaction_types=(TransactionType.AGGREGATE_COMPLETE.value,)),
			[create_symbol_mosaic(mosaic_id, 2)])

		# Assert:
		self.assertEqual(1, len(results))
		result = results[0]
		self.assertIsInstance(result, TransactionViewRecord)
		self.assertEqual('AA' * 32, result.transaction_hash)
		children = result.embedded_transactions
		self.assertEqual([0, 1], [transaction.embedded_index for transaction in children])
		self.assertTrue(all(isinstance(child, TransactionViewRecord) for child in children))
		self.assertEqual([((mosaic_id, 200, 2, None),), ((mosaic_id, 100, 2, None),)], [transaction.mosaics for transaction in children])

	def test_returns_selected_transfer_mosaics_in_position_order(self):
		# Arrange:
		first_mosaic_id = '1234567890ABCDEF'
		second_mosaic_id = '234567890ABCDEF1'
		transactions = [
			create_symbol_transaction(1, 1, mosaic_rows=[
				{'mosaic_id': second_mosaic_id, 'amount': 200, 'role': 'transfer', 'position': 1},
				{'mosaic_id': first_mosaic_id, 'amount': 100, 'role': 'transfer', 'position': 0},
				{'mosaic_id': '34567890ABCDEF12', 'amount': 300, 'role': 'hash_lock', 'position': 2},
				{'mosaic_id': '4567890ABCDEF123', 'amount': 400, 'role': 'metadata_target', 'position': 3},
			]),
			create_symbol_transaction(1, 2),
			create_symbol_mosaic_transfer(1, 3, '567890ABCDEF1234', 500),
		]
		sync_state = create_symbol_sync_state(last_synced_height=1, finalized_height=1)

		with _transaction_mosaic_database(transactions, [
			create_symbol_mosaic(first_mosaic_id, 2),
			create_symbol_mosaic(second_mosaic_id, 3),
		]) as (database, cursor, transaction_ids):
			selected_id, empty_id, _ = transaction_ids
			cursor.execute(
				'UPDATE symbol_mosaics SET alias_names = %s::jsonb WHERE mosaic_id = %s',
				('["alpha", "beta"]', first_mosaic_id))

			# Act:
			mosaics_map = database._fetch_transaction_mosaics(  # pylint: disable=protected-access
				cursor, [selected_id, empty_id], sync_state)

		# Assert:
		self.assertEqual({selected_id: [(first_mosaic_id, 100, 2, 'alpha'), (second_mosaic_id, 200, 3, None)], empty_id: []}, mosaics_map)

	def test_raises_when_selected_mosaic_metadata_is_unsafe(self):
		# Arrange:
		transactions = [create_symbol_mosaic_transfer(1, 1, '1234567890ABCDEF', 100)]
		with _transaction_mosaic_database(transactions) as (database, cursor, transaction_ids):
			for status in ('healthy', 'repairing'):
				with self.subTest(status=status):
					sync_state = create_symbol_sync_state(
						last_synced_height=1, finalized_height=1, status=status,
						dirty_state_from_height=2 if status == 'healthy' else None)

					# Act + Assert:
					with self.assertRaisesRegex(SymbolDataUnavailable, 'mosaic display depends on current state'):
						database._fetch_transaction_mosaics(cursor, transaction_ids, sync_state)  # pylint: disable=protected-access

	def test_returns_empty_list_without_aggregate_hashes(self):
		# Arrange:
		cursor = Mock()

		# Act:
		result = SymbolDatabase._fetch_embedded_transactions(cursor, [])  # pylint: disable=protected-access

		# Assert:
		self.assertEqual([], result)
		cursor.execute.assert_not_called()

	def test_uses_configured_native_divisibility_instead_of_saved_metadata(self):
		for saved_divisibility in (3, None):
			with self.subTest(saved_divisibility=saved_divisibility):
				# Arrange:
				transactions = [create_symbol_mosaic_transfer(1, 1, NATIVE_MOSAIC_INFO.id, 12345678)]
				mosaics = [create_symbol_mosaic(NATIVE_MOSAIC_INFO.id, saved_divisibility)] if saved_divisibility is not None else []
				with _transaction_mosaic_database(transactions, mosaics, NATIVE_MOSAIC_INFO) as (database, cursor, transaction_ids):
					# Act:
					result = database._fetch_transaction_mosaics(  # pylint: disable=protected-access
						cursor, transaction_ids, create_symbol_sync_state(last_synced_height=1, finalized_height=1))

				# Assert:
				self.assertEqual({transaction_ids[0]: [(NATIVE_MOSAIC_INFO.id, 12345678, NATIVE_MOSAIC_INFO.divisibility, None)]}, result)

	def test_returns_native_mosaic_without_current_metadata_during_repair(self):
		# Arrange:
		transactions = [create_symbol_mosaic_transfer(1, 1, NATIVE_MOSAIC_INFO.id, 1000000)]
		with _transaction_mosaic_database(transactions, native_mosaic_info=NATIVE_MOSAIC_INFO) as (database, cursor, transaction_ids):
			# Act:
			result = database._fetch_transaction_mosaics(  # pylint: disable=protected-access
				cursor, transaction_ids, create_safe_repairing_sync_state())

		# Assert:
		self.assertEqual({transaction_ids[0]: [(NATIVE_MOSAIC_INFO.id, 1000000, 6, None)]}, result)

	def test_returns_selected_parent_children_in_index_order(self):
		# Arrange:
		parent_hash = bytes.fromhex('AA' * 32)
		transactions = [
			create_symbol_transaction(4, 10, type=TransactionType.AGGREGATE_COMPLETE.value, hash=parent_hash),
			create_symbol_transaction(4, 1, is_embedded=True, aggregate_hash=parent_hash),
			create_symbol_transaction(4, 0, is_embedded=True, aggregate_hash=parent_hash),
			create_symbol_transaction(4, 0, is_embedded=True, aggregate_hash=bytes.fromhex('BB' * 32)),
		]
		with symbol_test_database(blocks=[create_symbol_block(4)]) as (_, database):
			database.upsert_transactions_for_height(4, transactions)
			with database.connection.cursor() as cursor:
				# Act:
				result = SymbolDatabase._fetch_embedded_transactions(cursor, [parent_hash])  # pylint: disable=protected-access

		# Assert:
		self.assertEqual([(parent_hash, 0, 4), (parent_hash, 1, 4)], [(bytes(row[3]), row[4], row[5]) for row in result])

	def test_get_transactions_orders_rows_by_height_and_id(self):
		# Arrange:
		transactions = [
			create_symbol_transaction(1, 1),
			create_symbol_transaction(2, 2),
			create_symbol_transaction(2, 3)
		]

		# Act:
		result = _query_symbol_transactions(
			transactions,
			create_symbol_sync_state(last_synced_height=2, finalized_height=1),
			TransactionQuery(limit=10))

		# Assert:
		self.assertEqual([
			(2, (3).to_bytes(32, 'big').hex().upper()),
			(2, (2).to_bytes(32, 'big').hex().upper()),
			(1, (1).to_bytes(32, 'big').hex().upper())
		], [(transaction.height, transaction.transaction_hash) for transaction in result])

	def test_get_transactions_hides_rows_above_watermark(self):
		# Arrange:
		transactions = [create_symbol_transaction(2, 1), create_symbol_transaction(3, 2)]

		# Act:
		result = _query_symbol_transactions(
			transactions,
			create_symbol_sync_state(last_synced_height=2, finalized_height=1),
			TransactionQuery(limit=10))

		# Assert:
		self.assertEqual([(2, (1).to_bytes(32, 'big').hex().upper())], [
			(transaction.height, transaction.transaction_hash) for transaction in result])

	def test_get_transactions_applies_limit_to_the_ordered_page(self):
		# Arrange:
		transactions = [create_symbol_transaction(4, number) for number in (1, 2, 3)]

		# Act:
		result = _query_symbol_transactions(
			transactions,
			create_symbol_sync_state(last_synced_height=4, finalized_height=3),
			TransactionQuery(limit=1))

		# Assert:
		self.assertEqual([
			((3).to_bytes(32, 'big').hex().upper(), TransactionType.TRANSFER.value, None),
		], [
			(transaction.transaction_hash, transaction.transaction_type.value, transaction.embedded_index)
			for transaction in result])

	def test_get_transactions_applies_offset_after_filtering_above_watermark_rows(self):
		# Arrange:
		transactions = [create_symbol_transaction(4, 1), create_symbol_transaction(4, 2), create_symbol_transaction(5, 3)]

		# Act:
		result = _query_symbol_transactions(
			transactions,
			create_symbol_sync_state(last_synced_height=4, finalized_height=3),
			TransactionQuery(limit=1, offset=1))

		# Assert:
		self.assertEqual([
			((1).to_bytes(32, 'big').hex().upper(), TransactionType.TRANSFER.value, None),
		], [
			(transaction.transaction_hash, transaction.transaction_type.value, transaction.embedded_index)
			for transaction in result])

	def test_get_transactions_returns_empty_for_height_above_clean_watermark(self):
		# Arrange + Act:
		result = _query_symbol_transactions(
			[create_symbol_transaction(4, 1)],
			create_symbol_sync_state(last_synced_height=4, finalized_height=3),
			TransactionQuery(height=5))

		# Assert:
		self.assertEqual([], result)

	def test_get_transactions_matches_any_requested_type(self):
		# Arrange:
		mosaic_id = '1234567890ABCDEF'
		transactions = [
			create_symbol_transaction(
				4,
				1,
				mosaic_rows=[{'mosaic_id': mosaic_id, 'amount': 12345, 'role': 'transfer', 'position': 0}]),
			create_symbol_transaction(
				4,
				2,
				type=TransactionType.AGGREGATE_COMPLETE.value,
				hash=bytes.fromhex('AA' * 32)),
			create_symbol_transaction(4, 3, type=TransactionType.MOSAIC_METADATA.value)
		]

		# Act:
		result = _query_symbol_transactions(
			transactions,
			create_symbol_sync_state(last_synced_height=4, finalized_height=3),
			TransactionQuery(transaction_types=(TransactionType.TRANSFER.value, TransactionType.AGGREGATE_COMPLETE.value)),
			[create_symbol_mosaic(mosaic_id, 2)])

		# Assert:
		self.assertEqual([
			('AA' * 32, TransactionType.AGGREGATE_COMPLETE.value, None),
			((1).to_bytes(32, 'big').hex().upper(), TransactionType.TRANSFER.value, None),
		], [
			(transaction.transaction_hash, transaction.transaction_type.value, transaction.embedded_index)
			for transaction in result])

	def test_get_transactions_combines_type_signer_and_recipient_filters_with_and(self):
		# Arrange:
		other_public_key = bytes.fromhex('02' * 32)
		other_recipient = bytes.fromhex('03' * 24)
		transactions = [
			create_symbol_transaction(4, 1),
			create_symbol_transaction(4, 2, signer_public_key=other_public_key),
			create_symbol_transaction(4, 3, recipient_address=other_recipient),
			create_symbol_transaction(4, 4, type=TransactionType.MOSAIC_METADATA.value)
		]

		# Act:
		result = _query_symbol_transactions(
			transactions,
			create_symbol_sync_state(last_synced_height=4, finalized_height=3),
			TransactionQuery(
				transaction_types=(TransactionType.TRANSFER.value,),
				signer_public_key=SIGNER_PUBLIC_KEY,
				recipient_address=TRANSACTION_RECIPIENT_ADDRESS))

		# Assert:
		self.assertEqual([
			((1).to_bytes(32, 'big').hex().upper(), TransactionType.TRANSFER.value, None),
		], [
			(transaction.transaction_hash, transaction.transaction_type.value, transaction.embedded_index)
			for transaction in result])

	def test_get_transactions_sender_address_matches_only_signer_column(self):
		# Arrange:
		sender_address = bytes.fromhex('03' * 24)
		transactions = [
			create_symbol_transaction(
				4, 1, signer_address=sender_address,
				address_rows=[{'address': sender_address, 'role': 'signer'}]),
			create_symbol_transaction(
				4, 2, recipient_address=sender_address,
				address_rows=[
					{'address': TRANSACTION_SIGNER_ADDRESS, 'role': 'signer'},
					{'address': sender_address, 'role': 'recipient'}]),
			create_symbol_transaction(
				4, 3,
				address_rows=[
					{'address': TRANSACTION_SIGNER_ADDRESS, 'role': 'signer'},
					{'address': sender_address, 'role': 'cosignatory'}]),
			create_symbol_transaction(
				4, 4, target_address=sender_address,
				address_rows=[
					{'address': TRANSACTION_SIGNER_ADDRESS, 'role': 'signer'},
					{'address': sender_address, 'role': 'target'}])
		]

		# Act:
		result = _query_symbol_transactions(
			transactions,
			create_symbol_sync_state(last_synced_height=4, finalized_height=3),
			TransactionQuery(sender_address=sender_address))

		# Assert:
		self.assertEqual([1], [bytes.fromhex(transaction.transaction_hash)[-1] for transaction in result])

	def test_get_transactions_combines_sender_address_signer_public_key_and_recipient_with_and(self):
		# Arrange:
		sender_address = bytes.fromhex('03' * 24)
		other_sender_address = bytes.fromhex('04' * 24)
		recipient_address = bytes.fromhex('05' * 24)
		other_recipient_address = bytes.fromhex('06' * 24)
		other_public_key = bytes.fromhex('02' * 32)
		transactions = [
			create_symbol_transaction(
				4, 1, signer_address=sender_address, recipient_address=recipient_address,
				address_rows=[
					{'address': sender_address, 'role': 'signer'},
					{'address': recipient_address, 'role': 'recipient'}]),
			create_symbol_transaction(
				4, 2, signer_address=sender_address, signer_public_key=other_public_key,
				recipient_address=recipient_address,
				address_rows=[
					{'address': sender_address, 'role': 'signer'},
					{'address': recipient_address, 'role': 'recipient'}]),
			create_symbol_transaction(
				4, 3, signer_address=sender_address, recipient_address=other_recipient_address,
				address_rows=[
					{'address': sender_address, 'role': 'signer'},
					{'address': other_recipient_address, 'role': 'recipient'}]),
			create_symbol_transaction(
				4, 4, signer_address=other_sender_address, recipient_address=recipient_address,
				address_rows=[
					{'address': other_sender_address, 'role': 'signer'},
					{'address': recipient_address, 'role': 'recipient'}])
		]

		# Act:
		result = _query_symbol_transactions(
			transactions,
			create_symbol_sync_state(last_synced_height=4, finalized_height=3),
			TransactionQuery(
				sender_address=sender_address,
				signer_public_key=SIGNER_PUBLIC_KEY,
				recipient_address=recipient_address))

		# Assert:
		self.assertEqual([1], [bytes.fromhex(transaction.transaction_hash)[-1] for transaction in result])

	def test_get_transactions_combines_sender_address_height_type_and_mosaic_filters_with_and(self):
		# Arrange:
		sender_address = bytes.fromhex('03' * 24)
		other_sender_address = bytes.fromhex('04' * 24)
		mosaic_id = '1234567890ABCDEF'
		other_mosaic_id = '234567890ABCDEF0'
		transactions = [
			create_symbol_transaction(
				4, 1, signer_address=sender_address,
				mosaic_rows=[{'mosaic_id': mosaic_id, 'amount': 1, 'role': 'transfer', 'position': 0}]),
			create_symbol_transaction(
				3, 2, signer_address=sender_address,
				mosaic_rows=[{'mosaic_id': mosaic_id, 'amount': 1, 'role': 'transfer', 'position': 0}]),
			create_symbol_transaction(
				4, 3, signer_address=sender_address, type=TransactionType.AGGREGATE_COMPLETE.value,
				hash=bytes.fromhex('AA' * 32),
				mosaic_rows=[{'mosaic_id': mosaic_id, 'amount': 1, 'role': 'transfer', 'position': 0}]),
			create_symbol_transaction(
				4, 4, signer_address=sender_address,
				mosaic_rows=[{'mosaic_id': other_mosaic_id, 'amount': 1, 'role': 'transfer', 'position': 0}]),
			create_symbol_transaction(
				4, 5, signer_address=other_sender_address,
				mosaic_rows=[{'mosaic_id': mosaic_id, 'amount': 1, 'role': 'transfer', 'position': 0}])
		]

		# Act:
		result = _query_symbol_transactions(
			transactions,
			create_symbol_sync_state(last_synced_height=4, finalized_height=3),
			TransactionQuery(
				sender_address=sender_address,
				height=4,
				transaction_types=(TransactionType.TRANSFER.value,),
				transfer_mosaic_id=mosaic_id),
			[create_symbol_mosaic(mosaic_id, 2), create_symbol_mosaic(other_mosaic_id, 2)])

		# Assert:
		self.assertEqual([1], [bytes.fromhex(transaction.transaction_hash)[-1] for transaction in result])

	def test_get_transactions_sender_address_does_not_promote_child_to_parent(self):
		# Arrange:
		sender_address = bytes.fromhex('03' * 24)
		parent_hash = bytes.fromhex('AA' * 32)
		parent = create_symbol_transaction(
			4, 1, type=TransactionType.AGGREGATE_COMPLETE.value, hash=parent_hash)
		child = create_symbol_transaction(
			4,
			0,
			is_embedded=True,
			signer_address=sender_address,
			aggregate_hash=parent_hash,
			address_rows=[{'address': sender_address, 'role': 'signer'}])
		transactions = [parent, child]

		# Act:
		result = _query_symbol_transactions(
			transactions,
			create_symbol_sync_state(last_synced_height=4, finalized_height=3),
			TransactionQuery(sender_address=sender_address))

		# Assert:
		self.assertEqual([], result)

	def test_get_transactions_sender_address_filters_before_pagination_and_hides_above_watermark(self):
		# Arrange:
		sender_address = bytes.fromhex('03' * 24)
		other_sender_address = bytes.fromhex('04' * 24)
		transactions = [
			create_symbol_transaction(4, 1, signer_address=sender_address),
			create_symbol_transaction(4, 2, signer_address=sender_address),
			create_symbol_transaction(4, 3, signer_address=other_sender_address),
			create_symbol_transaction(4, 4, signer_address=sender_address),
			create_symbol_transaction(5, 5, signer_address=sender_address),
			create_symbol_transaction(3, 6, signer_address=sender_address)
		]

		# Act:
		result = _query_symbol_transactions(
			transactions,
			create_symbol_sync_state(last_synced_height=4, finalized_height=3),
			TransactionQuery(sender_address=sender_address, limit=3, offset=1))

		# Assert:
		self.assertEqual(
			[(2, 4), (1, 4), (6, 3)],
			[(bytes.fromhex(transaction.transaction_hash)[-1], transaction.height) for transaction in result])

	def test_get_transactions_returns_embedded_rows_only_inside_their_parent(self):
		# Arrange:
		parent_hash = bytes.fromhex('AA' * 32)
		transactions = [
			create_symbol_transaction(
				4,
				10,
				type=TransactionType.AGGREGATE_COMPLETE.value,
				hash=parent_hash),
			create_symbol_transaction(4, 0, is_embedded=True, aggregate_hash=parent_hash),
			create_symbol_transaction(4, 1, is_embedded=True, aggregate_hash=parent_hash)
		]

		# Act:
		result = _query_symbol_transactions(
			transactions,
			create_symbol_sync_state(last_synced_height=4, finalized_height=3),
			TransactionQuery())

		# Assert:
		self.assertEqual([
			(TransactionType.AGGREGATE_COMPLETE.value, parent_hash.hex().upper(), None, None)
		], [
			(
				transaction.transaction_type.value,
				transaction.transaction_hash,
				transaction.aggregate_hash,
				transaction.embedded_index)
			for transaction in result])

		children = result[0].embedded_transactions
		self.assertEqual([0, 1], [child.embedded_index for child in children])

	def test_get_transactions_requires_address_and_transfer_mosaic_on_the_same_transaction_row(self):
		# Arrange:
		participant_address = bytes.fromhex('04' * 24)
		transfer_mosaic_id = '1234567890ABCDEF'
		other_mosaic_id = 'FEDCBA9876543210'
		both_filters = create_symbol_transaction(
			4,
			1,
			address_rows=[{'address': participant_address, 'role': 'cosignatory'}],
			mosaic_rows=[{'mosaic_id': transfer_mosaic_id, 'amount': 10, 'role': 'transfer', 'position': 0}])
		address_only = create_symbol_transaction(
			4,
			2,
			address_rows=[{'address': participant_address, 'role': 'target'}],
			mosaic_rows=[{'mosaic_id': other_mosaic_id, 'amount': 20, 'role': 'transfer', 'position': 0}])
		mosaic_only = create_symbol_transaction(
			4,
			3,
			mosaic_rows=[{'mosaic_id': transfer_mosaic_id, 'amount': 30, 'role': 'transfer', 'position': 0}])
		parent = create_symbol_transaction(
			4,
			10,
			type=TransactionType.AGGREGATE_COMPLETE.value,
			hash=bytes.fromhex('AA' * 32),
			address_rows=[{'address': participant_address, 'role': 'target'}])
		child = create_symbol_transaction(
			4,
			0,
			is_embedded=True,
			mosaic_rows=[{'mosaic_id': transfer_mosaic_id, 'amount': 40, 'role': 'transfer', 'position': 0}])

		# Act: The parent and child are decoys whose address and Mosaic only match across different rows.
		result = _query_symbol_transactions(
			[both_filters, address_only, mosaic_only, parent, child],
			create_symbol_sync_state(last_synced_height=4, finalized_height=3),
			TransactionQuery(
				address=participant_address,
				transfer_mosaic_id=transfer_mosaic_id),
			[create_symbol_mosaic(transfer_mosaic_id, 2), create_symbol_mosaic(other_mosaic_id, 0)])

		# Assert:
		self.assertEqual([(False, (1).to_bytes(32, 'big').hex().upper(), None, None)], [
			((transaction.aggregate_hash is not None), transaction.transaction_hash,
				transaction.aggregate_hash, transaction.embedded_index)
			for transaction in result])
		self.assertEqual([[(transfer_mosaic_id, 10, 2, None)]], [list(transaction.mosaics) for transaction in result])

	def test_get_transactions_address_matches_participant_roles_without_duplicates_or_embedded_rows(self):
		# Arrange:
		participant_address = bytes.fromhex('04' * 24)
		parent = create_symbol_transaction(4, 10, type=TransactionType.AGGREGATE_COMPLETE.value)
		parent['hash'] = bytes.fromhex('AA' * 32)
		participant = create_symbol_transaction(
			4,
			2,
			address_rows=[
				{'address': participant_address, 'role': 'cosignatory'},
				{'address': participant_address, 'role': 'target'}
			])
		child1 = create_symbol_transaction(
			4,
			1,
			is_embedded=True,
			address_rows=[{'address': participant_address, 'role': 'cosignatory'}])

		# Act:
		result = _query_symbol_transactions(
			[parent, participant, child1],
			create_symbol_sync_state(last_synced_height=4, finalized_height=3),
			TransactionQuery(address=participant_address))

		# Assert:
		self.assertEqual([(2).to_bytes(32, 'big').hex().upper()], [transaction.transaction_hash for transaction in result])

	def test_get_transactions_transfer_mosaic_search_excludes_metadata_target_and_uses_saved_resolution(self):
		# Arrange:
		resolved_mosaic_id = '1234567890ABCDEF'
		unresolved_alias_id = '8000000000000001'
		transfer = create_symbol_transaction(
			4,
			1,
			mosaic_rows=[{'mosaic_id': resolved_mosaic_id, 'amount': 12345, 'role': 'transfer', 'position': 0}],
			raw_payload={'mosaics': [{'id': unresolved_alias_id, 'amount': '12345'}]})
		metadata_target = create_symbol_transaction(
			4,
			2,
			type=TransactionType.MOSAIC_METADATA.value,
			mosaic_rows=[{'mosaic_id': resolved_mosaic_id, 'amount': 0, 'role': 'metadata_target', 'position': 0}])

		# Act:
		result = _query_symbol_transactions(
			[transfer, metadata_target],
			create_symbol_sync_state(last_synced_height=4, finalized_height=3),
			TransactionQuery(transfer_mosaic_id=resolved_mosaic_id))

		# Assert:
		self.assertEqual([False], [(transaction.aggregate_hash is not None) for transaction in result])
		self.assertEqual(((resolved_mosaic_id, 12345, None, None),), result[0].mosaics)

	def test_returns_mosaic_amounts_and_saved_divisibility(self):
		# Arrange:
		transactions = [create_symbol_transaction(
			4,
			1,
			mosaic_rows=[
				{'mosaic_id': '1234567890ABCDEF', 'amount': 12345, 'role': 'transfer', 'position': 0},
				{'mosaic_id': 'FEDCBA9876543210', 'amount': 5, 'role': 'transfer', 'position': 1},
				{'mosaic_id': 'ABCDEF0123456789', 'amount': 54321, 'role': 'transfer', 'position': 2}
			])]
		mosaics = [create_symbol_mosaic('1234567890ABCDEF', 2), create_symbol_mosaic('FEDCBA9876543210', 0)]

		# Act:
		result = _query_symbol_transactions(
			transactions,
			create_symbol_sync_state(last_synced_height=4, finalized_height=3),
			TransactionQuery(),
			mosaics)

		# Assert:
		self.assertEqual((
			('1234567890ABCDEF', 12345, 2, None),
			('FEDCBA9876543210', 5, 0, None),
			('ABCDEF0123456789', 54321, None, None),
		), result[0].mosaics)

	def test_get_transactions_reads_height_below_dirty_boundary(self):
		# Arrange:
		transactions = [create_symbol_transaction(2, 1), create_symbol_transaction(3, 2)]
		sync_state = create_symbol_sync_state(
			last_synced_height=3,
			finalized_height=2,
			dirty_state_from_height=3)

		# Act:
		result = _query_symbol_transactions(transactions, sync_state, TransactionQuery(height=2))

		# Assert:
		self.assertEqual([2], [transaction.height for transaction in result])

	def test_get_transactions_raises_data_unavailable_at_dirty_boundary(self):
		# Arrange:
		transactions = [create_symbol_transaction(2, 1), create_symbol_transaction(3, 2)]
		sync_state = create_symbol_sync_state(
			last_synced_height=3,
			finalized_height=2,
			dirty_state_from_height=3)

		# Act + Assert:
		with self.assertRaisesRegex(SymbolDataUnavailable, 'requested height is above the readable height'):
			_query_symbol_transactions(transactions, sync_state, TransactionQuery(height=3))

	def test_get_transactions_rejects_unbounded_query_when_state_is_dirty(self):
		# Arrange:
		transactions = [create_symbol_transaction(2, 1), create_symbol_transaction(3, 2)]
		sync_state = create_symbol_sync_state(
			last_synced_height=3,
			finalized_height=2,
			dirty_state_from_height=3)

		# Act + Assert:
		with self.assertRaisesRegex(SymbolDataUnavailable, 'generic transaction page crosses an unsafe boundary'):
			_query_symbol_transactions(transactions, sync_state, TransactionQuery(limit=1, offset=1))

	def test_get_transactions_raises_data_unavailable_when_dirty_page_requires_current_mosaic_state(self):
		# Arrange:
		transactions = [create_symbol_transaction(
			2,
			1,
			mosaic_rows=[{'mosaic_id': '1234567890ABCDEF', 'amount': 5, 'role': 'transfer', 'position': 0}])]
		sync_state = create_symbol_sync_state(
			last_synced_height=3,
			finalized_height=2,
			dirty_state_from_height=3)

		# Act + Assert:
		with self.assertRaisesRegex(SymbolDataUnavailable, 'mosaic display depends on current state'):
			_query_symbol_transactions(transactions, sync_state, TransactionQuery(height=2))

	def test_get_transactions_reads_safe_height_while_repairing(self):
		# Arrange:
		transactions = [create_symbol_transaction(2, 1)]

		# Act:
		safe_result = _query_symbol_transactions(
			transactions,
			create_safe_repairing_sync_state(),
			TransactionQuery(height=2))

		# Assert:
		self.assertEqual([2], [transaction.height for transaction in safe_result])

	def test_get_transactions_raises_data_unavailable_when_sync_state_is_unhealthy(self):
		# Arrange:
		transactions = [create_symbol_transaction(2, 1)]
		sync_state = create_symbol_sync_state(last_synced_height=2, finalized_height=1, status='unhealthy')

		# Act + Assert:
		with self.assertRaises(SymbolDataUnavailable):
			_query_symbol_transactions(transactions, sync_state, TransactionQuery(height=2))

	def test_get_transactions_uses_configured_native_divisibility_during_repair(self):
		for saved_divisibility in (3, None):
			with self.subTest(saved_divisibility=saved_divisibility):
				# Arrange:
				transaction = create_symbol_mosaic_transfer(2, 1, NATIVE_MOSAIC_INFO.id, 123)
				mosaics = [create_symbol_mosaic(NATIVE_MOSAIC_INFO.id, saved_divisibility)] if saved_divisibility is not None else []

				# Act:
				result = _query_symbol_transactions(
					[transaction], create_safe_repairing_sync_state(), TransactionQuery(height=2), mosaics)

				# Assert:
				self.assertEqual(1, len(result))
				self.assertEqual(((NATIVE_MOSAIC_INFO.id, 123, NATIVE_MOSAIC_INFO.divisibility, None),), result[0].mosaics)
				self.assertEqual(0.000002, result[0].fee)

	def test_get_transactions_raises_data_unavailable_when_top_level_effective_fee_is_missing(self):
		# Arrange:
		transaction = create_symbol_transaction(1, 1, max_fee=None, size=None)

		# Act + Assert:
		with self.assertRaisesRegex(SymbolDataUnavailable, 'effective fee is missing'):
			_query_symbol_transactions(
				[transaction],
				create_symbol_sync_state(last_synced_height=1, finalized_height=1),
				TransactionQuery())

	def test_get_transactions_uses_one_snapshot_for_sync_state_page_and_mosaic_state(self):
		# Arrange:
		parent = create_symbol_transaction(1, 10, type=TransactionType.AGGREGATE_COMPLETE.value, hash=bytes.fromhex('AA' * 32))
		child = create_symbol_transaction(
			1,
			0,
			is_embedded=True,
			mosaic_rows=[{'mosaic_id': '1234567890ABCDEF', 'amount': 123, 'role': 'transfer', 'position': 0}])
		with symbol_test_database(
			create_symbol_sync_state(last_synced_height=1, finalized_height=1),
			[create_symbol_block(1)],
			[create_symbol_mosaic('1234567890ABCDEF', 2)]) as (db_config, puller_database):
			puller_database.upsert_transactions_for_height(1, [parent, child])
			with puller_database.connection.cursor() as cursor:
				cursor.execute(
					"UPDATE symbol_mosaics SET alias_names = '[\"before\"]'::jsonb WHERE mosaic_id = %s",
					('1234567890ABCDEF',))
			puller_database.connection.commit()

			database = PausingAfterSyncStateReadSymbolDatabase(db_config, NATIVE_MOSAIC_INFO)
			try:
				# Act:
				result = read_during_database_snapshot(
					database,
					lambda: database.get_transactions(TransactionQuery(
						address=TRANSACTION_SIGNER_ADDRESS, transaction_types=(TransactionType.AGGREGATE_COMPLETE.value,))),
					lambda: _update_transaction_snapshot(puller_database))
			finally:
				database.close()

		# Assert:
		self.assertEqual(1, len(result))
		self.assertEqual(0.000001, result[0].fee)
		self.assertEqual((('1234567890ABCDEF', 123, 2, 'before'),), result[0].embedded_transactions[0].mosaics)

	def test_get_transactions_reports_current_mosaic_state_read_failure_and_recovers_connection(self):
		# Arrange:
		transaction = create_symbol_transaction(
			1,
			1,
			mosaic_rows=[{'mosaic_id': '1234567890ABCDEF', 'amount': 123, 'role': 'transfer', 'position': 0}])
		with symbol_test_database(
			create_symbol_sync_state(last_synced_height=1, finalized_height=1),
			[create_symbol_block(1)],
			[create_symbol_mosaic('1234567890ABCDEF', 2)]) as (db_config, puller_database):
			puller_database.upsert_transactions_for_height(1, [transaction])
			database = SymbolDatabase(db_config, NATIVE_MOSAIC_INFO)
			is_mosaic_table_renamed = False
			try:
				try:
					with puller_database.connection.cursor() as cursor:
						cursor.execute('ALTER TABLE symbol_mosaics RENAME TO symbol_mosaics_for_test')
					puller_database.connection.commit()
					is_mosaic_table_renamed = True

					# Act: Trigger the failed read while the current-state table is unavailable.
					with self.assertRaises(PsycopgError):
						database.get_transactions(TransactionQuery(height=1))
				finally:
					if is_mosaic_table_renamed:
						puller_database.connection.rollback()
						with puller_database.connection.cursor() as cursor:
							cursor.execute('ALTER TABLE symbol_mosaics_for_test RENAME TO symbol_mosaics')
						puller_database.connection.commit()

				# Act: Retry through the same REST database instance after restoring the table.
				result = database.get_transactions(TransactionQuery(height=1))
			finally:
				database.close()

		# Assert:
		self.assertEqual(1, len(result))
		self.assertEqual((('1234567890ABCDEF', 123, 2, None),), result[0].mosaics)


class SymbolDatabaseTransactionAliasTest(TestCase):
	def test_get_transactions_checks_alias_start_at_snapshot_height(self):
		# Arrange: the alias is active at current height 3, after the queried transaction height 1.
		with symbol_test_database(
			create_symbol_sync_state(last_synced_height=3, finalized_height=2),
			[create_symbol_block(height) for height in (1, 2, 3)],
			[create_symbol_mosaic(NATIVE_MOSAIC_INFO.id, 6)]) as (db_config, puller_database):
			puller_database.upsert_namespace(create_symbol_namespace(start_height=2, updated_at_height=3), [])
			puller_database.upsert_transactions_for_height(1, [
				create_symbol_mosaic_transfer(1, 1, NATIVE_MOSAIC_INFO.id, 11),
				create_symbol_mosaic_transfer(1, 2, '1234567890ABCDEF', 22)])

			# Act:
			with SymbolDatabase(db_config, NATIVE_MOSAIC_INFO) as database:
				result = database.get_transactions(TransactionQuery(height=1, transfer_mosaic_id='887E5DB6BB0B21F5'))

		# Assert: only the current link's transfer at the requested historical height is returned.
		self.assertEqual([
			((1).to_bytes(32, 'big').hex().upper(), TransactionType.TRANSFER.value, None),
		], [
			(transaction.transaction_hash, transaction.transaction_type.value, transaction.embedded_index)
			for transaction in result])

	def test_get_transactions_keeps_namespace_and_transaction_rows_in_one_snapshot(self):
		# Arrange: both links have transfers; a concurrent commit changes the link and amount.
		alias_id = '887E5DB6BB0B21F5'
		mosaic_a = '1234567890ABCDEF'
		mosaic_b = '234567890ABCDEF0'
		with symbol_test_database(
			create_symbol_sync_state(last_synced_height=1, finalized_height=1),
			[create_symbol_block(1)]) as (db_config, puller_database):
			puller_database.upsert_namespace(create_symbol_namespace(alias_mosaic_id=mosaic_a), [])
			puller_database.upsert_transactions_for_height(1, [
				create_symbol_mosaic_transfer(1, 1, mosaic_a, 11),
				create_symbol_mosaic_transfer(1, 2, mosaic_b, 22)])

			def update_alias_snapshot():
				with puller_database.connection.cursor() as cursor:
					cursor.execute('UPDATE symbol_namespaces SET alias_mosaic_id = %s', (mosaic_b,))
					cursor.execute('UPDATE symbol_transaction_mosaics SET amount = 999')
				puller_database.connection.commit()

			# Act:
			with PausingAfterSyncStateReadSymbolDatabase(db_config, NATIVE_MOSAIC_INFO) as database:
				result = read_during_database_snapshot(
					database,
					lambda: database.get_transactions(TransactionQuery(transfer_mosaic_id=alias_id)),
					update_alias_snapshot)
			with SymbolDatabase(db_config, NATIVE_MOSAIC_INFO) as database:
				next_result = database.get_transactions(TransactionQuery(transfer_mosaic_id=alias_id))

		# Assert: first read sees old link and amount; next read sees the commit.
		self.assertEqual([(mosaic_a, 11, None, None, 1)], [
			(*transaction.mosaics[0], bytes.fromhex(transaction.transaction_hash)[-1]) for transaction in result])
		self.assertEqual([(mosaic_b, 999, None, None, 2)], [
			(*transaction.mosaics[0], bytes.fromhex(transaction.transaction_hash)[-1]) for transaction in next_result])

	def test_uses_saved_mosaic_target_without_resolving_it_as_an_alias(self):
		# Arrange:
		saved_target = '887e5db6bb0b21f5'
		transaction_target = '887E5DB6BB0B21F5'
		with symbol_test_database(
			create_symbol_sync_state(last_synced_height=1, finalized_height=1),
			[create_symbol_block(1)]) as (db_config, puller_database):
			puller_database.upsert_namespace(create_symbol_namespace(alias_mosaic_id=saved_target), [])
			puller_database.upsert_transactions_for_height(1, [
				create_symbol_mosaic_transfer(1, 1, transaction_target, 10),
				create_symbol_mosaic_transfer(1, 2, '1234567890ABCDEF', 20)])

			# Act:
			with SymbolDatabase(db_config, NATIVE_MOSAIC_INFO) as database:
				result = database.get_transactions(TransactionQuery(transfer_mosaic_id='887E5DB6BB0B21F5'))

			# Assert:
			self.assertEqual([(transaction_target, 10, None, None)], [
				transaction.mosaics[0] for transaction in result])

	def test_get_transactions_accepts_saved_zero_start_height_without_revalidating_lifetime_shape(self):
		# Arrange: start height zero is retained as a node-derived value and remains active at latest height 3.
		with symbol_test_database(
			create_symbol_sync_state(last_synced_height=3, finalized_height=2)) as (db_config, puller_database):
			puller_database.upsert_namespace(create_symbol_namespace(start_height=0, end_height=None), [])

			# Act:
			with SymbolDatabase(db_config, NATIVE_MOSAIC_INFO) as database:
				result = database.get_transactions(TransactionQuery(transfer_mosaic_id='887E5DB6BB0B21F5'))

		# Assert:
		self.assertEqual([], result)

	def test_get_transactions_returns_not_found_for_expired_alias_without_lifetime_shape_validation(self):
		# Arrange: end height one is expired at latest height three, regardless of its relation to start height.
		with symbol_test_database(
			create_symbol_sync_state(last_synced_height=3, finalized_height=2)) as (db_config, puller_database):
			puller_database.upsert_namespace(create_symbol_namespace(start_height=2, end_height=1), [])

			# Act + Assert:
			with self.assertRaisesRegex(SymbolMosaicAliasNotFound, 'not currently linked'):
				with SymbolDatabase(db_config, NATIVE_MOSAIC_INFO) as database:
					database.get_transactions(TransactionQuery(transfer_mosaic_id='887E5DB6BB0B21F5'))

	def test_get_transactions_returns_not_found_for_null_alias_target(self):
		# Arrange: a Mosaic alias row with no link is not a current Mosaic alias.
		with symbol_test_database(
			create_symbol_sync_state(last_synced_height=3, finalized_height=2)) as (db_config, puller_database):
			puller_database.upsert_namespace(create_symbol_namespace(alias_mosaic_id=None), [])

			# Act + Assert:
			with self.assertRaisesRegex(SymbolMosaicAliasNotFound, 'not currently linked'):
				with SymbolDatabase(db_config, NATIVE_MOSAIC_INFO) as database:
					database.get_transactions(TransactionQuery(transfer_mosaic_id='887E5DB6BB0B21F5'))

	def test_get_transactions_rejects_not_yet_active_alias(self):
		# Arrange:
		with symbol_test_database(
			create_symbol_sync_state(last_synced_height=3, finalized_height=2)) as (db_config, puller_database):
			puller_database.upsert_namespace(create_symbol_namespace(start_height=4), [])

			# Act + Assert:
			with self.assertRaisesRegex(SymbolMosaicAliasNotFound, 'not currently linked'):
				with SymbolDatabase(db_config, NATIVE_MOSAIC_INFO) as database:
					database.get_transactions(TransactionQuery(height=1, transfer_mosaic_id='887E5DB6BB0B21F5'))

	def test_get_transactions_normalizes_saved_lowercase_mosaic_target(self):
		# Arrange:
		with symbol_test_database(
			create_symbol_sync_state(last_synced_height=1, finalized_height=1),
			[create_symbol_block(1)]) as (db_config, puller_database):
			puller_database.upsert_namespace(create_symbol_namespace(alias_mosaic_id='72c0212e67a08bce'), [])
			puller_database.upsert_transactions_for_height(1, [create_symbol_mosaic_transfer(1, 1, NATIVE_MOSAIC_INFO.id, 10)])

			# Act:
			with SymbolDatabase(db_config, NATIVE_MOSAIC_INFO) as database:
				result = database.get_transactions(TransactionQuery(transfer_mosaic_id='887E5DB6BB0B21F5'))

		# Assert:
		self.assertEqual([(NATIVE_MOSAIC_INFO.id, 10, 6, None)], [transaction.mosaics[0] for transaction in result])


@contextmanager
def _transaction_mosaic_database(transactions, mosaics=(), native_mosaic_info=None):
	# Arrange:
	with symbol_test_database(blocks=[create_symbol_block(1)], mosaics=mosaics) as (db_config, puller_database):
		puller_database.upsert_transactions_for_height(1, transactions)
		with puller_database.connection.cursor() as cursor:
			cursor.execute('SELECT id FROM symbol_transactions ORDER BY id')
			transaction_ids = [row[0] for row in cursor.fetchall()]
			with SymbolDatabase(db_config, native_mosaic_info) as database:
				yield database, cursor, transaction_ids


def _query_symbol_transactions(transactions, sync_state, query, mosaics=None):
	transactions_by_height = group_records_by_height(transactions)
	heights = sorted(transactions_by_height)
	with symbol_test_database(
		sync_state,
		[create_symbol_block(height) for height in heights],
		mosaics or []) as (db_config, puller_database):
		for height, height_transactions in transactions_by_height.items():
			puller_database.upsert_transactions_for_height(height, height_transactions)

		with SymbolDatabase(db_config, NATIVE_MOSAIC_INFO) as database:
			return database.get_transactions(query)


def _update_transaction_snapshot(puller_database):
	with puller_database.connection.cursor() as cursor:
		cursor.execute("UPDATE symbol_sync_state SET status = 'unhealthy' WHERE id = 1")
		cursor.execute('UPDATE symbol_transactions SET effective_fee = 999 WHERE height = 1')
		cursor.execute('UPDATE symbol_transaction_mosaics SET amount = 456 WHERE height = 1')
		cursor.execute(
			'UPDATE symbol_transaction_addresses SET address = %s WHERE address = %s '
			'AND role = %s::symbol_transaction_address_role',
			(bytes.fromhex('FF' * 24), TRANSACTION_SIGNER_ADDRESS, 'signer'))
		cursor.execute(
			"UPDATE symbol_mosaics SET divisibility = 3, alias_names = '[\"after\"]'::jsonb WHERE mosaic_id = %s",
			('1234567890ABCDEF',))
	puller_database.connection.commit()

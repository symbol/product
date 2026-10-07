from datetime import datetime
from unittest import TestCase

from common.symbol.NativeMosaic import NativeMosaicInfo
from psycopg2 import Error as PsycopgError
from symbolchain.sc import TransactionType

from rest.db.SymbolDatabase import (
	SymbolDatabase,
	SymbolDataUnavailable,
	SymbolMosaicAliasNotFound,
	TransactionMosaicRecord,
	TransactionQuery,
	TransactionRecord
)

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


class SymbolDatabaseTransactionsTest(TestCase):  # pylint: disable=too-many-public-methods
	def test_get_transactions_orders_rows_by_height_and_id_and_hides_above_watermark(self):
		# Arrange:
		transactions = [
			create_symbol_transaction(4, 1),
			create_symbol_transaction(4, 2),
			create_symbol_transaction(3, 3),
			create_symbol_transaction(5, 4)
		]

		# Act:
		result = _query_symbol_transactions(
			transactions,
			create_symbol_sync_state(last_synced_height=4, finalized_height=3),
			TransactionQuery(limit=10))

		# Assert:
		self.assertEqual([(4, 2), (4, 1), (3, 3)], [
			(transaction.height, bytes(transaction.hash)[-1]) for transaction in result])

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
			TransactionRecord(
				3,
				(3).to_bytes(32, 'big'),
				False,
				None,
				None,
				4,
				TransactionType.TRANSFER.value,
				TRANSACTION_SIGNER_ADDRESS,
				TRANSACTION_RECIPIENT_ADDRESS,
				4,
				datetime(2026, 1, 1, 0, 0, 4),
				None,
				None,
				())
		], [_normalize_transaction_binary_fields(record) for record in result])

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
			TransactionRecord(
				1,
				(1).to_bytes(32, 'big'),
				False,
				None,
				None,
				4,
				TransactionType.TRANSFER.value,
				TRANSACTION_SIGNER_ADDRESS,
				TRANSACTION_RECIPIENT_ADDRESS,
				4,
				datetime(2026, 1, 1, 0, 0, 4),
				None,
				None,
				())
		], [_normalize_transaction_binary_fields(record) for record in result])

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
			TransactionRecord(
				2,
				bytes.fromhex('AA' * 32),
				False,
				None,
				None,
				4,
				TransactionType.AGGREGATE_COMPLETE.value,
				TRANSACTION_SIGNER_ADDRESS,
				TRANSACTION_RECIPIENT_ADDRESS,
				4,
				datetime(2026, 1, 1, 0, 0, 4),
				None,
				None,
				()),
			TransactionRecord(
				1,
				(1).to_bytes(32, 'big'),
				False,
				None,
				None,
				4,
				TransactionType.TRANSFER.value,
				TRANSACTION_SIGNER_ADDRESS,
				TRANSACTION_RECIPIENT_ADDRESS,
				4,
				datetime(2026, 1, 1, 0, 0, 4),
				None,
				None,
				(TransactionMosaicRecord(mosaic_id, 12345, 'transfer', 0, 2, []),))
		], [_normalize_transaction_binary_fields(record) for record in result])

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
			TransactionRecord(
				1,
				(1).to_bytes(32, 'big'),
				False,
				None,
				None,
				4,
				TransactionType.TRANSFER.value,
				TRANSACTION_SIGNER_ADDRESS,
				TRANSACTION_RECIPIENT_ADDRESS,
				4,
				datetime(2026, 1, 1, 0, 0, 4),
				None,
				None,
				())
		], [_normalize_transaction_binary_fields(record) for record in result])

	def test_get_transactions_includes_embedded_rows_when_requested(self):
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
			TransactionQuery(include_embedded=True))

		# Assert:
		self.assertEqual([
			(3, True, TransactionType.TRANSFER.value, None, parent_hash, 1),
			(2, True, TransactionType.TRANSFER.value, None, parent_hash, 0),
			(1, False, TransactionType.AGGREGATE_COMPLETE.value, parent_hash, None, None)
		], [
			(
				transaction.transaction_id,
				transaction.is_embedded,
				transaction.transaction_type,
				bytes(transaction.hash) if transaction.hash is not None else None,
				bytes(transaction.aggregate_hash) if transaction.aggregate_hash is not None else None,
				transaction.embedded_index)
			for transaction in result])

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
				transfer_mosaic_id=transfer_mosaic_id,
				include_embedded=True),
			[create_symbol_mosaic(transfer_mosaic_id, 2), create_symbol_mosaic(other_mosaic_id, 0)])

		# Assert:
		self.assertEqual([(False, bytes.fromhex('00' * 31 + '01'), None, None)], [
			(transaction.is_embedded, bytes(transaction.hash) if transaction.hash is not None else None,
				transaction.aggregate_hash, transaction.embedded_index)
			for transaction in result])
		self.assertEqual([(transfer_mosaic_id, 'transfer', 10)], [
			(mosaic.mosaic_id, mosaic.role, mosaic.amount)
			for transaction in result
			for mosaic in transaction.mosaics])

	def test_get_transactions_address_searches_each_row_role_without_parent_promotion_or_role_duplicates(self):
		# Arrange:
		participant_address = bytes.fromhex('04' * 24)
		parent = create_symbol_transaction(4, 10, type=TransactionType.AGGREGATE_COMPLETE.value)
		parent['hash'] = bytes.fromhex('AA' * 32)
		child0 = create_symbol_transaction(
			4,
			0,
			is_embedded=True,
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
		embedded_result = _query_symbol_transactions(
			[parent, child0, child1],
			create_symbol_sync_state(last_synced_height=4, finalized_height=3),
			TransactionQuery(address=participant_address, include_embedded=True))
		top_level_result = _query_symbol_transactions(
			[parent, child0, child1],
			create_symbol_sync_state(last_synced_height=4, finalized_height=3),
			TransactionQuery(address=participant_address))

		# Assert:
		self.assertEqual([
			TransactionRecord(
				3,
				None,
				True,
				bytes.fromhex('AA' * 32),
				1,
				4,
				TransactionType.TRANSFER.value,
				TRANSACTION_SIGNER_ADDRESS,
				TRANSACTION_RECIPIENT_ADDRESS,
				None,
				datetime(2026, 1, 1, 0, 0, 4),
				None,
				None,
				()),
			TransactionRecord(
				2,
				None,
				True,
				bytes.fromhex('AA' * 32),
				0,
				4,
				TransactionType.TRANSFER.value,
				TRANSACTION_SIGNER_ADDRESS,
				TRANSACTION_RECIPIENT_ADDRESS,
				None,
				datetime(2026, 1, 1, 0, 0, 4),
				None,
				None,
				())
		], [_normalize_transaction_binary_fields(record) for record in embedded_result])
		self.assertEqual([], top_level_result)

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
		self.assertEqual([False], [transaction.is_embedded for transaction in result])
		self.assertEqual([(resolved_mosaic_id, 'transfer', 12345)], [
			(mosaic.mosaic_id, mosaic.role, mosaic.amount) for mosaic in result[0].mosaics])

	def test_get_transactions_reads_saved_mosaic_divisibility_and_returns_null_for_missing_state(self):
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
		self.assertEqual([
			('1234567890ABCDEF', 2, []),
			('FEDCBA9876543210', 0, []),
			('ABCDEF0123456789', None, None)
		], [(mosaic.mosaic_id, mosaic.divisibility, mosaic.alias_names) for mosaic in result[0].mosaics])

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

	def test_get_transactions_raises_data_unavailable_above_dirty_boundary(self):
		# Arrange:
		transactions = [create_symbol_transaction(2, 1), create_symbol_transaction(3, 2)]
		sync_state = create_symbol_sync_state(
			last_synced_height=3,
			finalized_height=2,
			dirty_state_from_height=3)

		# Act + Assert:
		with self.assertRaisesRegex(SymbolDataUnavailable, 'requested height is above the readable height'):
			_query_symbol_transactions(transactions, sync_state, TransactionQuery(height=3))

	def test_get_transactions_raises_data_unavailable_when_page_crosses_dirty_boundary(self):
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

	def test_get_transactions_allows_native_mosaic_without_current_state_during_repair(self):
		# Arrange:
		transaction = create_symbol_mosaic_transfer(2, 1, NATIVE_MOSAIC_INFO.id, 123)
		with symbol_test_database(create_safe_repairing_sync_state(), [create_symbol_block(2)]) as (
			db_config, puller_database):
			puller_database.upsert_transactions_for_height(2, [transaction])
			puller_database.upsert_mosaic(create_symbol_mosaic(NATIVE_MOSAIC_INFO.id, 3))
			alias_names_json = '["repairing-native-name"]'
			with puller_database.connection.cursor() as cursor:
				cursor.execute(
					'UPDATE symbol_mosaics SET alias_names = %s::jsonb WHERE mosaic_id = %s',
					(alias_names_json, NATIVE_MOSAIC_INFO.id))
			puller_database.connection.commit()
			database = SymbolDatabase(db_config, NATIVE_MOSAIC_INFO)
			try:
				# Act:
				result = database.get_transactions(TransactionQuery(height=2))
			finally:
				database.close()

		# Assert:
		self.assertEqual(1, len(result))
		self.assertEqual(
			(NATIVE_MOSAIC_INFO.id, None, None),
			(result[0].mosaics[0].mosaic_id, result[0].mosaics[0].divisibility, result[0].mosaics[0].alias_names))

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
		transaction = create_symbol_transaction(
			1,
			1,
			mosaic_rows=[{'mosaic_id': '1234567890ABCDEF', 'amount': 123, 'role': 'transfer', 'position': 0}])
		with symbol_test_database(
			create_symbol_sync_state(last_synced_height=1, finalized_height=1),
			[create_symbol_block(1)],
			[create_symbol_mosaic('1234567890ABCDEF', 2)]) as (db_config, puller_database):
			puller_database.upsert_transactions_for_height(1, [transaction])
			with puller_database.connection.cursor() as cursor:
				cursor.execute(
					"UPDATE symbol_mosaics SET alias_names = '[\"before\"]'::jsonb WHERE mosaic_id = %s",
					('1234567890ABCDEF',))
			puller_database.connection.commit()

			database = PausingAfterSyncStateReadSymbolDatabase(db_config)
			try:
				# Act:
				result = read_during_database_snapshot(
					database,
					lambda: database.get_transactions(TransactionQuery(address=TRANSACTION_SIGNER_ADDRESS)),
					lambda: _update_transaction_snapshot(puller_database))
			finally:
				database.close()

		# Assert:
		self.assertEqual(1, len(result))
		self.assertEqual(1, result[0].effective_fee)
		self.assertEqual(123, result[0].mosaics[0].amount)
		self.assertEqual(['before'], result[0].mosaics[0].alias_names)

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
		self.assertEqual('1234567890ABCDEF', result[0].mosaics[0].mosaic_id)


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
			TransactionRecord(
				1,
				(1).to_bytes(32, 'big'),
				False,
				None,
				None,
				1,
				TransactionType.TRANSFER.value,
				TRANSACTION_SIGNER_ADDRESS,
				TRANSACTION_RECIPIENT_ADDRESS,
				1,
				datetime(2026, 1, 1, 0, 0, 1),
				None,
				None,
				(TransactionMosaicRecord('72C0212E67A08BCE', 11, 'transfer', 0, 6, []),))
		], [_normalize_transaction_binary_fields(record) for record in result])

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
			with PausingAfterSyncStateReadSymbolDatabase(db_config) as database:
				result = read_during_database_snapshot(
					database,
					lambda: database.get_transactions(TransactionQuery(transfer_mosaic_id=alias_id)),
					update_alias_snapshot)
			with SymbolDatabase(db_config) as database:
				next_result = database.get_transactions(TransactionQuery(transfer_mosaic_id=alias_id))

		# Assert: first read sees old link and amount; next read sees the commit.
		self.assertEqual([(mosaic_a, 11, 1)], [
			(row.mosaics[0].mosaic_id, row.mosaics[0].amount, bytes(row.hash)[-1]) for row in result])
		self.assertEqual([(mosaic_b, 999, 2)], [
			(row.mosaics[0].mosaic_id, row.mosaics[0].amount, bytes(row.hash)[-1]) for row in next_result])

	def test_get_transactions_uses_saved_alias_target_without_revalidating_format(self):
		# Arrange:
		for saved_target, transaction_target in (('invalid', 'INVALID'), ('887e5db6bb0b21f5', '887E5DB6BB0B21F5')):
			with self.subTest(saved_target=saved_target):
				with symbol_test_database(
					create_symbol_sync_state(last_synced_height=1, finalized_height=1),
					[create_symbol_block(1)]) as (db_config, puller_database):
					puller_database.upsert_namespace(create_symbol_namespace(alias_mosaic_id=saved_target), [])
					puller_database.upsert_transactions_for_height(1, [
						create_symbol_mosaic_transfer(1, 1, transaction_target, 10),
						create_symbol_mosaic_transfer(1, 2, '1234567890ABCDEF', 20)])

					# Act:
					with SymbolDatabase(db_config) as database:
						result = database.get_transactions(TransactionQuery(transfer_mosaic_id='887E5DB6BB0B21F5'))

					# Assert:
					self.assertEqual([(transaction_target, 10)], [
						(row.mosaics[0].mosaic_id, row.mosaics[0].amount) for row in result])

	def test_get_transactions_accepts_saved_zero_start_height_without_revalidating_lifetime_shape(self):
		# Arrange: start height zero is retained as a node-derived value and remains active at latest height 3.
		with symbol_test_database(
			create_symbol_sync_state(last_synced_height=3, finalized_height=2)) as (db_config, puller_database):
			puller_database.upsert_namespace(create_symbol_namespace(start_height=0, end_height=None), [])

			# Act:
			with SymbolDatabase(db_config) as database:
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
				with SymbolDatabase(db_config) as database:
					database.get_transactions(TransactionQuery(transfer_mosaic_id='887E5DB6BB0B21F5'))

	def test_get_transactions_returns_not_found_for_null_alias_target(self):
		# Arrange: a Mosaic alias row with no link is not a current Mosaic alias.
		with symbol_test_database(
			create_symbol_sync_state(last_synced_height=3, finalized_height=2)) as (db_config, puller_database):
			puller_database.upsert_namespace(create_symbol_namespace(alias_mosaic_id=None), [])

			# Act + Assert:
			with self.assertRaisesRegex(SymbolMosaicAliasNotFound, 'not currently linked'):
				with SymbolDatabase(db_config) as database:
					database.get_transactions(TransactionQuery(transfer_mosaic_id='887E5DB6BB0B21F5'))

	def test_get_transactions_rejects_not_yet_active_alias(self):
		# Arrange:
		with symbol_test_database(
			create_symbol_sync_state(last_synced_height=3, finalized_height=2)) as (db_config, puller_database):
			puller_database.upsert_namespace(create_symbol_namespace(start_height=4), [])

			# Act + Assert:
			with self.assertRaisesRegex(SymbolMosaicAliasNotFound, 'not currently linked'):
				with SymbolDatabase(db_config) as database:
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
		self.assertEqual([(NATIVE_MOSAIC_INFO.id, 10)], [(row.mosaics[0].mosaic_id, row.mosaics[0].amount) for row in result])


def _normalize_transaction_binary_fields(record):
	"""Normalizes PostgreSQL bytea memoryviews for value-based record comparisons."""

	return record._replace(
		hash=bytes(record.hash) if record.hash is not None else None,
		aggregate_hash=bytes(record.aggregate_hash) if record.aggregate_hash is not None else None,
		signer_address=bytes(record.signer_address),
		recipient_address=bytes(record.recipient_address) if record.recipient_address is not None else None)


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
			"UPDATE symbol_mosaics SET alias_names = '[\"after\"]'::jsonb WHERE mosaic_id = %s",
			('1234567890ABCDEF',))
	puller_database.connection.commit()

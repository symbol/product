from unittest import TestCase

from common.symbol.NativeMosaic import NativeMosaicInfo
from psycopg2 import Error as PsycopgError
from symbolchain.sc import TransactionType

from rest.db.SymbolDatabase import SortOrder, SymbolDatabase, SymbolDataUnavailable, TransactionQuery

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
from ..test.SymbolTransactionTestUtils import SIGNER_PUBLIC_KEY, create_symbol_mosaic_transfer, create_symbol_transaction

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
		page_result = _query_symbol_transactions(
			transactions,
			create_symbol_sync_state(last_synced_height=4, finalized_height=3),
			TransactionQuery(limit=2, offset=1))

		# Assert:
		self.assertEqual([(4, 2), (4, 1), (3, 3)], [
			(transaction.height, bytes(transaction.hash)[-1]) for transaction in result])
		self.assertEqual([(4, 1), (3, 3)], [
			(transaction.height, bytes(transaction.hash)[-1]) for transaction in page_result])

	def test_get_transactions_returns_empty_for_height_above_clean_watermark(self):
		# Arrange + Act:
		result = _query_symbol_transactions(
			[create_symbol_transaction(4, 1)],
			create_symbol_sync_state(last_synced_height=4, finalized_height=3),
			TransactionQuery(height=5))

		# Assert:
		self.assertEqual([], result)

	def test_get_transactions_rejects_ascending_order(self):
		# Arrange:
		with symbol_test_database() as (db_config, _puller_database):
			database = SymbolDatabase(db_config)
			try:
				# Act + Assert:
				with self.assertRaisesRegex(ValueError, 'order must be DESC'):
					database.get_transactions(TransactionQuery(order=SortOrder.ASC))
			finally:
				database.close()

	def test_get_transactions_applies_type_or_and_signer_recipient_and_embedded_filter(self):
		# Arrange:
		other_public_key = bytes.fromhex('02' * 32)
		other_recipient = bytes.fromhex('03' * 24)
		transactions = [
			create_symbol_transaction(4, 1),
			create_symbol_transaction(
				4,
				2,
				type=TransactionType.AGGREGATE_COMPLETE.value,
				hash=bytes.fromhex('AA' * 32)),
			create_symbol_transaction(4, 3, signer_public_key=other_public_key),
			create_symbol_transaction(4, 4, recipient_address=other_recipient),
			create_symbol_transaction(4, 0, is_embedded=True),
			create_symbol_transaction(4, 1, is_embedded=True),
			create_symbol_transaction(4, 5, type=TransactionType.MOSAIC_METADATA.value)
		]
		query = TransactionQuery(
			transaction_types=(TransactionType.TRANSFER.value, TransactionType.AGGREGATE_COMPLETE.value),
			signer_public_key=SIGNER_PUBLIC_KEY,
			recipient_address=TRANSACTION_RECIPIENT_ADDRESS,
			include_embedded=True)

		# Act:
		result = _query_symbol_transactions(
			transactions,
			create_symbol_sync_state(last_synced_height=4, finalized_height=3),
			query)

		# Assert:
		self.assertEqual([
			(True, 1),
			(True, 0),
			(False, None),
			(False, None),
		], [(transaction.is_embedded, transaction.embedded_index) for transaction in result])
		self.assertEqual([
			TransactionType.TRANSFER.value,
			TransactionType.TRANSFER.value,
			TransactionType.AGGREGATE_COMPLETE.value,
			TransactionType.TRANSFER.value
		], [transaction.transaction_type for transaction in result])

	def test_get_transactions_requires_address_and_transfer_mosaic_on_the_same_row(self):
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

		# Act:
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
		self.assertEqual([(True, 1), (True, 0)], [
			(transaction.is_embedded, transaction.embedded_index) for transaction in embedded_result])
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

	def test_get_transactions_raises_data_unavailable_when_confirmed_timestamp_is_missing(self):
		# Arrange:
		with symbol_test_database(
			create_symbol_sync_state(last_synced_height=1, finalized_height=1),
			[create_symbol_block(1)]) as (db_config, puller_database):
			puller_database.upsert_transactions_for_height(1, [create_symbol_transaction(1, 1)])
			with puller_database.connection.cursor() as cursor:
				cursor.execute('ALTER TABLE symbol_transactions ALTER COLUMN timestamp DROP NOT NULL')
				cursor.execute('UPDATE symbol_transactions SET timestamp = NULL WHERE height = 1')
			puller_database.connection.commit()
			database = SymbolDatabase(db_config)
			try:
				# Act + Assert:
				with self.assertRaisesRegex(SymbolDataUnavailable, 'confirmed timestamp is missing'):
					database.get_transactions(TransactionQuery())
			finally:
				database.close()

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

from unittest import TestCase

from psycopg2 import Error as PsycopgError

from rest.db.SymbolDatabase import SortOrder, SymbolDatabase, SymbolDataUnavailable

from ..test.SymbolBlockTestUtils import create_symbol_sync_state
from ..test.SymbolDatabaseTestUtils import (
	PausingAfterSyncStateReadSymbolDatabase,
	create_safe_repairing_sync_state,
	read_during_database_snapshot,
	symbol_test_database
)
from ..test.SymbolMosaicTestUtils import create_symbol_mosaic, create_symbol_mosaic_view


def _create_default_mosaic_row():
	mosaic_map = create_symbol_mosaic('1234567890ABCDEF', 6)
	mosaic_map.update({
		'start_height': 10,
		'expiration_height': 30,
		'duration': 20,
		'supply': 1234567,
		'flags': 10,
		'transferable': True,
		'revokable': True,
		'updated_at_height': 10
	})
	return mosaic_map


class SymbolDatabaseMosaicsTest(TestCase):
	def test_can_get_mosaic_metadata_from_postgresql(self):
		# Arrange:
		mosaic_map = _create_default_mosaic_row()
		with symbol_test_database(
			create_symbol_sync_state(last_synced_height=10, finalized_height=9),
			mosaics=[mosaic_map]) as (db_config, puller_database):
			with puller_database.connection.cursor() as cursor:
				cursor.execute(
					"UPDATE symbol_mosaics SET alias_names = '[\"example\", \"example.token\"]'::jsonb WHERE mosaic_id = %s",
					(mosaic_map['mosaic_id'],))
			puller_database.connection.commit()

			# Act:
			with SymbolDatabase(db_config) as database:
				result = database.get_mosaics(10, 0, SortOrder.DESC)

		# Assert:
		self.assertEqual([
			create_symbol_mosaic_view(
				mosaic_id='1234567890ABCDEF',
				owner_address='TCEUGLPCMO5Y72EEISSNUKGTMCN5RO4PVYMK5FI',
				start_height=10,
				expiration_height=30,
				duration=20)
		], result)

	def _assert_mosaic_page(self, query_map, expected_ids):
		# Arrange: ID order differs from registration height order.
		mosaics = []
		for mosaic_id, start_height in ((3, 1), (1, 3), (2, 2)):
			mosaic_map = create_symbol_mosaic(f'{mosaic_id:016X}', 2)
			mosaic_map['start_height'] = start_height
			mosaic_map['updated_at_height'] = start_height
			mosaics.append(mosaic_map)

		# Act:
		result = _query_symbol_mosaics(
			mosaics,
			create_symbol_sync_state(last_synced_height=3, finalized_height=2),
			**query_map)

		# Assert:
		self.assertEqual([f'{mosaic_id:016X}' for mosaic_id in expected_ids], [mosaic.mosaic_id for mosaic in result])

	def test_get_mosaics_returns_ascending_start_height_order(self):
		self._assert_mosaic_page({'sort': SortOrder.ASC}, [3, 2, 1])

	def test_get_mosaics_returns_descending_start_height_order(self):
		self._assert_mosaic_page({'sort': SortOrder.DESC}, [1, 2, 3])

	def _assert_mosaic_pages_with_equal_start_heights(self, sort, expected_pages):
		# Arrange: equal-height mosaics are inserted out of ID order.
		mosaics = []
		for mosaic_id, start_height in ((8, 1), (3, 2), (1, 3), (2, 2), (4, 2)):
			mosaic_map = create_symbol_mosaic(f'{mosaic_id:016X}', 2)
			mosaic_map['start_height'] = start_height
			mosaic_map['updated_at_height'] = start_height
			mosaics.append(mosaic_map)

		with symbol_test_database(create_symbol_sync_state(3, 2), mosaics=mosaics) as (db_config, _puller_database):
			# Act:
			with SymbolDatabase(db_config) as database:
				pages = [database.get_mosaics(2, offset, sort) for offset in (0, 2, 4)]

		# Assert:
		self.assertEqual(
			[[f'{mosaic_id:016X}' for mosaic_id in page] for page in expected_pages],
			[[mosaic.mosaic_id for mosaic in page] for page in pages])

	def test_get_mosaics_orders_equal_start_heights_by_id_across_ascending_pages(self):
		self._assert_mosaic_pages_with_equal_start_heights(SortOrder.ASC, [[8, 2], [3, 4], [1]])

	def test_get_mosaics_orders_equal_start_heights_by_id_across_descending_pages(self):
		self._assert_mosaic_pages_with_equal_start_heights(SortOrder.DESC, [[1, 4], [3, 2], [8]])

	def test_get_mosaics_returns_empty_for_zero_limit(self):
		self._assert_mosaic_page({'limit': 0}, [])

	def test_get_mosaics_returns_empty_when_offset_reaches_end(self):
		self._assert_mosaic_page({'offset': 3}, [])

	def test_get_mosaics_returns_empty_when_no_mosaics_exist(self):
		# Arrange + Act:
		result = _query_symbol_mosaics(
			[],
			create_symbol_sync_state(last_synced_height=1, finalized_height=1))

		# Assert:
		self.assertEqual([], result)

	def _assert_unavailable_mosaic_state(self, sync_state_map):
		# Act + Assert: current mosaics are unsafe even if their registration height is in the clean prefix.
		with self.assertRaisesRegex(SymbolDataUnavailable, 'Symbol mosaic data is unavailable'):
			_query_symbol_mosaics([create_symbol_mosaic('1234567890ABCDEF', 6)], sync_state_map)

	def test_get_mosaics_rejects_missing_sync_state(self):
		self._assert_unavailable_mosaic_state(None)

	def test_get_mosaics_rejects_unhealthy_sync_state(self):
		self._assert_unavailable_mosaic_state(create_symbol_sync_state(2, 1, status='unhealthy'))

	def test_get_mosaics_rejects_zero_last_synced_height(self):
		self._assert_unavailable_mosaic_state(create_symbol_sync_state(0, None))

	def test_get_mosaics_rejects_repairing_state_without_dirty_boundary(self):
		self._assert_unavailable_mosaic_state(create_symbol_sync_state(2, 1, status='repairing'))

	def test_get_mosaics_rejects_repairing_state_with_clean_prefix(self):
		self._assert_unavailable_mosaic_state(create_safe_repairing_sync_state())

	def test_get_mosaics_rejects_dirty_state_at_synced_height(self):
		self._assert_unavailable_mosaic_state(create_symbol_sync_state(2, 1, dirty_state_from_height=2))

	def test_get_mosaics_rejects_dirty_state_above_synced_height(self):
		self._assert_unavailable_mosaic_state(create_symbol_sync_state(2, 1, dirty_state_from_height=3))

	def test_get_mosaics_reads_sync_state_and_metadata_from_same_snapshot(self):
		# Arrange:
		with symbol_test_database(
			create_symbol_sync_state(last_synced_height=10, finalized_height=9),
			mosaics=[_create_default_mosaic_row()]) as (db_config, puller_database):
			def update_mosaic_snapshot():
				with puller_database.connection.cursor() as cursor:
					cursor.execute("UPDATE symbol_sync_state SET status = 'unhealthy' WHERE id = 1")
					cursor.execute("UPDATE symbol_mosaics SET supply = 999, alias_names = '[\"after\"]'::jsonb")
				puller_database.connection.commit()

			# Act:
			with PausingAfterSyncStateReadSymbolDatabase(db_config) as database:
				result = read_during_database_snapshot(
					database,
					lambda: database.get_mosaics(10, 0, SortOrder.DESC),
					update_mosaic_snapshot)

				# Assert: this request sees the old metadata; the next request sees the unhealthy state.
				self.assertEqual([1234567], [mosaic.supply for mosaic in result])
				self.assertEqual([[]], [mosaic.alias_names for mosaic in result])
				with self.assertRaises(SymbolDataUnavailable):
					database.get_mosaics(10, 0, SortOrder.DESC)

	def test_get_mosaics_returns_connection_for_next_request_after_sql_failure(self):
		# Arrange:
		with symbol_test_database(
			create_symbol_sync_state(last_synced_height=10, finalized_height=9),
			mosaics=[_create_default_mosaic_row()]) as (db_config, puller_database):
			with SymbolDatabase(db_config) as database:
				with puller_database.connection.cursor() as cursor:
					cursor.execute('ALTER TABLE symbol_mosaics RENAME COLUMN supply TO supply_for_test')
				puller_database.connection.commit()

				try:
					# Act:
					with self.assertRaises(PsycopgError):
						database.get_mosaics(10, 0, SortOrder.DESC)
				finally:
					with puller_database.connection.cursor() as cursor:
						cursor.execute('ALTER TABLE symbol_mosaics RENAME COLUMN supply_for_test TO supply')
					puller_database.connection.commit()

				result = database.get_mosaics(10, 0, SortOrder.DESC)

		# Assert:
		self.assertEqual(['1234567890ABCDEF'], [mosaic.mosaic_id for mosaic in result])


def _query_symbol_mosaics(mosaics, sync_state_map, limit=10, offset=0, sort=SortOrder.DESC):
	with symbol_test_database(sync_state_map, mosaics=mosaics) as (db_config, _puller_database):
		with SymbolDatabase(db_config) as database:
			return database.get_mosaics(limit, offset, sort)

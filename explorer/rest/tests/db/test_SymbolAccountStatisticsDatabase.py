from datetime import timedelta
from decimal import Decimal
from unittest import TestCase

from common.symbol.NativeMosaic import NativeMosaicInfo
from psycopg2 import Error as PsycopgError
from symbolchain.symbol.Network import Address

from rest.db.SymbolDatabase import AccountStatisticsRecord, SymbolDatabase, SymbolDataUnavailable

from ..test.SymbolAccountListTestUtils import (
	CUSTOM_MOSAIC_ID,
	NATIVE_MOSAIC_ID,
	REFRESH_COMPLETED_AT,
	account_address,
	create_refresh_entry,
	seed_refresh_run
)
from ..test.SymbolBlockTestUtils import create_symbol_block, create_symbol_sync_state
from ..test.SymbolDatabaseTestUtils import PausingAfterSyncStateReadSymbolDatabase, read_during_database_snapshot, symbol_test_database

NATIVE_MOSAIC_INFO = NativeMosaicInfo(NATIVE_MOSAIC_ID, 6)
NOW = REFRESH_COMPLETED_AT + timedelta(hours=2)


def create_statistics_entries(run_id='selected-run'):
	return [
		create_refresh_entry(
			run_id, 1, 0, 4,
			mosaic_rows=[(NATIVE_MOSAIC_ID, 10_000_000_000), (CUSTOM_MOSAIC_ID, 1)]),
		create_refresh_entry(
			run_id, 2, 1, 3,
			mosaic_rows=[(NATIVE_MOSAIC_ID, 9_999_999_999)]),
		create_refresh_entry(
			run_id, 3, 2, 2,
			mosaic_rows=[(NATIVE_MOSAIC_ID, 10_000_000_000)]),
		create_refresh_entry(run_id, 4, 3, 1, mosaic_rows=[])
	]


class SymbolAccountStatisticsDatabaseTest(TestCase):
	@staticmethod
	def _create_database(db_config, native_mosaic_info=NATIVE_MOSAIC_INFO, clock=lambda: NOW):
		return SymbolDatabase(db_config, native_mosaic_info, clock=clock)

	@staticmethod
	def _seed_active_blocks(writer):
		cutoff = NOW - timedelta(days=7)
		writer.upsert_blocks([
			create_symbol_block(1, timestamp=cutoff - timedelta(seconds=1), beneficiary_address=account_address(3)),
			create_symbol_block(2, timestamp=cutoff, beneficiary_address=account_address(1)),
			create_symbol_block(3, timestamp=NOW, beneficiary_address=account_address(1)),
			create_symbol_block(4, timestamp=NOW, beneficiary_address=account_address(2)),
			create_symbol_block(5, timestamp=NOW, beneficiary_address=account_address(99), signer_address=account_address(4)),
			{
				**create_symbol_block(1, timestamp=NOW, beneficiary_address=account_address(4)),
				'height': 101, 'hash': bytes([101]) * 32, 'previous_hash': bytes([100]) * 32
			}
		])

	def test_get_account_statistics_rejects_missing_native_mosaic_configuration(self):
		# Arrange:
		with symbol_test_database(create_symbol_sync_state(100, 100)) as (config, _):
			with SymbolDatabase(config) as database:
				# Act:
				with self.assertRaises(SymbolDataUnavailable) as context:
					database.get_account_statistics(7200, 7)

		# Assert:
		self.assertEqual('Symbol account statistics native mosaic is unavailable', str(context.exception))

	def test_get_account_statistics_computes_all_snapshot_cohorts_and_bounds_activity(self):
		# Arrange: account 1 is active+eligible, 2 active-only, 3 eligible-only, and 4 neither.
		with symbol_test_database(create_symbol_sync_state(100, 100)) as (config, writer):
			seed_refresh_run(writer, 'selected-run', create_statistics_entries())
			self._seed_active_blocks(writer)
			with writer.connection.cursor() as cursor:
				cursor.execute(
					'UPDATE symbol_accounts SET is_harvesting_active = FALSE WHERE address = %s',
					(account_address(1),))
			writer.connection.commit()
			with self._create_database(config) as database:
				# Act:
				result = database.get_account_statistics(7200, 7)

		# Assert: repeated beneficiaries count once; signer-only, outsider, and above-watermark rows do not count.
		self.assertEqual(4, result.total)
		self.assertEqual(2, result.harvesting)
		self.assertEqual(2, result.eligible_for_harvesting)
		self.assertEqual(1, result.harvesting_eligible)
		self.assertEqual(Decimal('1'), result.total_importance)
		self.assertEqual((
			(Decimal('0.4'), str(Address(account_address(1)))),
			(Decimal('0.3'), str(Address(account_address(2)))),
			(Decimal('0.2'), str(Address(account_address(3)))),
			(Decimal('0.1'), str(Address(account_address(4))))
		), result.top_accounts)

	def test_get_account_statistics_uses_configured_native_mosaic_id_for_eligibility(self):
		# Arrange:
		configured_mosaic_info = NativeMosaicInfo(CUSTOM_MOSAIC_ID, 6)
		entries = [
			create_refresh_entry('selected-run', 1, 0, 3, mosaic_rows=[
				(CUSTOM_MOSAIC_ID, 10_000_000_000), (NATIVE_MOSAIC_ID, 9_999_999_999)]),
			create_refresh_entry('selected-run', 2, 1, 2, mosaic_rows=[
				(CUSTOM_MOSAIC_ID, 10_000_000_000), (NATIVE_MOSAIC_ID, 9_999_999_999)]),
			create_refresh_entry('selected-run', 3, 2, 1, mosaic_rows=[
				(CUSTOM_MOSAIC_ID, 9_999_999_999), (NATIVE_MOSAIC_ID, 10_000_000_000)])
		]
		with symbol_test_database(create_symbol_sync_state(100, 100)) as (config, writer):
			seed_refresh_run(writer, 'selected-run', entries, native_mosaic_id=CUSTOM_MOSAIC_ID)
			with self._create_database(config, configured_mosaic_info) as database:
				# Act:
				result = database.get_account_statistics(7200, 7)

		# Assert: the configured mosaic yields two eligible accounts; the default-mosaic decoy yields one.
		self.assertEqual(3, result.total)
		self.assertEqual(2, result.eligible_for_harvesting)

	def test_get_account_statistics_uses_configured_divisibility_for_inclusive_and_exclusive_bounds(self):
		# Arrange:
		configured_mosaic_info = NativeMosaicInfo(NATIVE_MOSAIC_ID, 3)
		entries = [
			create_refresh_entry('selected-run', 1, 0, 4, mosaic_rows=[(NATIVE_MOSAIC_ID, 10_000_000)]),
			create_refresh_entry('selected-run', 2, 1, 3, mosaic_rows=[(NATIVE_MOSAIC_ID, 9_999_999)]),
			create_refresh_entry('selected-run', 3, 2, 2, mosaic_rows=[(NATIVE_MOSAIC_ID, 50_000_000_000)]),
			create_refresh_entry('selected-run', 4, 3, 1, mosaic_rows=[(NATIVE_MOSAIC_ID, 49_999_999_999)]),
			create_refresh_entry('selected-run', 5, 4, 0, mosaic_rows=[(NATIVE_MOSAIC_ID, 1_000_000_000)])
		]
		with symbol_test_database(create_symbol_sync_state(100, 100)) as (config, writer):
			seed_refresh_run(writer, 'selected-run', entries)
			with self._create_database(config, configured_mosaic_info) as database:
				# Act:
				result = database.get_account_statistics(7200, 7)

		# Assert: three accounts meet [10,000,000, 50,000,000,000); six-digit bounds count two instead.
		self.assertEqual(3, result.eligible_for_harvesting)

	def test_get_account_statistics_uses_configured_harvesting_active_window(self):
		# Arrange:
		entries = [
			create_refresh_entry('selected-run', 1, 0, 0),
			create_refresh_entry('selected-run', 2, 1, 0)
		]
		with symbol_test_database(create_symbol_sync_state(100, 100)) as (config, writer):
			seed_refresh_run(writer, 'selected-run', entries)
			writer.upsert_blocks([
				create_symbol_block(
					1, timestamp=NOW - timedelta(days=4), beneficiary_address=account_address(2)),
				create_symbol_block(
					2, timestamp=NOW - timedelta(days=2), beneficiary_address=account_address(1))
			])
			with self._create_database(config) as database:
				# Act:
				result = database.get_account_statistics(7200, 3)

		# Assert: only the two-day beneficiary is active for three days; a seven-day hardcode counts both.
		self.assertEqual(1, result.harvesting)

	def test_get_account_statistics_advancing_clock_moves_inclusive_cutoff(self):
		# Arrange:
		clock = [NOW]
		with symbol_test_database(create_symbol_sync_state(100, 100)) as (config, writer):
			seed_refresh_run(writer, 'selected-run', create_statistics_entries())
			writer.upsert_blocks([
				create_symbol_block(
					1, timestamp=NOW - timedelta(days=7), beneficiary_address=account_address(1)),
				create_symbol_block(2, timestamp=NOW, beneficiary_address=account_address(2))
			])
			with self._create_database(config, clock=lambda: clock[0]) as database:
				# Act:
				at_boundary = database.get_account_statistics(7201, 7)
				clock[0] += timedelta(seconds=1)
				after_boundary = database.get_account_statistics(7201, 7)

		# Assert: the exact cutoff is active, but becomes older after the clock advances.
		self.assertEqual(2, at_boundary.harvesting)
		self.assertEqual(1, after_boundary.harvesting)

	def test_get_account_statistics_orders_top_ties_by_address_at_top_ten_boundary(self):
		# Arrange:
		importance_by_identity = {
			1: 100, 2: 90, 3: 90, 4: 80, 5: 70, 6: 60,
			7: 50, 8: 40, 9: 30, 10: 20, 11: 20, 12: 10
		}
		entries = [
			create_refresh_entry('selected-run', identity, identity, importance)
			for identity, importance in importance_by_identity.items()
		]
		with symbol_test_database(create_symbol_sync_state(100, 100)) as (config, writer):
			seed_refresh_run(writer, 'selected-run', entries)
			with self._create_database(config) as database:
				# Act:
				result = database.get_account_statistics(7200, 7)

		# Assert: tied importance uses address order, including the tie that straddles rank ten.
		expected_identities = sorted(
			importance_by_identity,
			key=lambda identity: (-importance_by_identity[identity], account_address(identity)))[:10]
		expected_addresses = tuple(str(Address(account_address(identity))) for identity in expected_identities)
		self.assertEqual(expected_addresses, tuple(row[1] for row in result.top_accounts))
		self.assertEqual(12, result.total)

	def test_get_account_statistics_returns_empty_statistics_for_empty_successful_snapshot(self):
		# Arrange:
		with symbol_test_database(create_symbol_sync_state(100, 100)) as (config, writer):
			seed_refresh_run(writer, 'empty-run', [])
			with self._create_database(config) as database:
				# Act:
				result = database.get_account_statistics(7200, 7)

		# Assert:
		self.assertEqual(AccountStatisticsRecord(0, 0, 0, 0, Decimal(0), ()), result)

	def test_get_account_statistics_rejects_missing_successful_refresh(self):
		# Arrange:
		with symbol_test_database(create_symbol_sync_state(100, 100)) as (config, _writer):
			with self._create_database(config) as database:
				# Act:
				with self.assertRaises(SymbolDataUnavailable) as context:
					database.get_account_statistics(7200, 7)

		# Assert:
		self.assertEqual('Symbol account refresh data is unavailable', str(context.exception))

	def test_get_account_statistics_rejects_unhealthy_refresh_statuses(self):
		for status in ('unhealthy', 'stale', 'refreshing'):
			with self.subTest(status=status), symbol_test_database(create_symbol_sync_state(100, 100)) as (config, writer):
				# Arrange:
				seed_refresh_run(writer, 'selected-run', create_statistics_entries())
				writer.upsert_account_refresh_state({'status': status})
				with self._create_database(config) as database:
					# Act:
					with self.assertRaises(SymbolDataUnavailable) as context:
						database.get_account_statistics(7200, 7)
				# Assert:
				self.assertEqual('Symbol account refresh data is unavailable', str(context.exception))

	def test_get_account_statistics_rejects_refresh_older_than_max_age(self):
		# Arrange:
		with symbol_test_database(create_symbol_sync_state(100, 100)) as (config, writer):
			seed_refresh_run(
				writer, 'selected-run', create_statistics_entries(), completed_at=NOW - timedelta(seconds=7201))
			with self._create_database(config) as database:
				# Act:
				with self.assertRaises(SymbolDataUnavailable) as context:
					database.get_account_statistics(7200, 7)

		# Assert:
		self.assertEqual('Symbol account refresh data is unavailable', str(context.exception))

	def test_get_account_statistics_accepts_refresh_at_max_age_boundary(self):
		# Arrange:
		with symbol_test_database(create_symbol_sync_state(100, 100)) as (config, writer):
			seed_refresh_run(
				writer, 'selected-run', create_statistics_entries(), completed_at=NOW - timedelta(seconds=7200))
			with self._create_database(config) as database:
				# Act:
				result = database.get_account_statistics(7200, 7)

		# Assert:
		self.assertEqual(4, result.total)

	def test_get_account_statistics_rejects_unreadable_sync_state_with_successful_snapshot(self):
		# Arrange:
		with symbol_test_database(create_symbol_sync_state(100, 100, status='unhealthy')) as (config, writer):
			seed_refresh_run(writer, 'selected-run', create_statistics_entries())
			with self._create_database(config) as database:
				# Act:
				with self.assertRaises(SymbolDataUnavailable) as context:
					database.get_account_statistics(7200, 7)

		# Assert:
		self.assertEqual('Symbol account data is unavailable', str(context.exception))

	def test_get_account_statistics_propagates_database_errors(self):
		# Arrange:
		with symbol_test_database(create_symbol_sync_state(100, 100)) as (config, writer):
			seed_refresh_run(writer, 'selected-run', create_statistics_entries())
			with self._create_database(config) as database:
				with database.connection() as connection:
					with connection.cursor() as cursor:
						cursor.execute('DROP TABLE symbol_account_refresh_state')
					connection.commit()
				# Act:
				with self.assertRaises(PsycopgError):
					database.get_account_statistics(7200, 7)

	def test_get_account_statistics_reads_refresh_run_and_watermark_from_one_snapshot(self):
		# Arrange:
		old_entries = [
			create_refresh_entry('old-run', 1, 0, 7, mosaic_rows=[(NATIVE_MOSAIC_ID, 10_000_000_000)]),
			create_refresh_entry('old-run', 2, 1, 3, mosaic_rows=[(NATIVE_MOSAIC_ID, 9_999_999_999)])
		]
		new_entries = [
			create_refresh_entry('new-run', 1, 0, 2, mosaic_rows=[(NATIVE_MOSAIC_ID, 9_999_999_999)]),
			create_refresh_entry('new-run', 2, 1, 5, mosaic_rows=[(NATIVE_MOSAIC_ID, 10_000_000_000)]),
			create_refresh_entry('new-run', 3, 2, 3, mosaic_rows=[(NATIVE_MOSAIC_ID, 10_000_000_000)])
		]
		for entry in old_entries + new_entries:
			entry['snapshot_height'] = 29
		with symbol_test_database(create_symbol_sync_state(29, 29)) as (config, writer):
			seed_refresh_run(writer, 'old-run', old_entries, completed_height=29)
			seed_refresh_run(writer, 'new-run', new_entries, completed_height=29)
			writer.upsert_account_refresh_state({'last_successful_run_id': 'old-run'})
			writer.upsert_blocks([
				create_symbol_block(
					29, timestamp=NOW - timedelta(seconds=1), beneficiary_address=account_address(1)),
				create_symbol_block(
					30, timestamp=NOW, beneficiary_address=account_address(2))
			])
			with PausingAfterSyncStateReadSymbolDatabase(
				config, NATIVE_MOSAIC_INFO, lambda: NOW) as database:
				def switch_successful_run_and_watermark():
					with writer.connection.cursor() as cursor:
						cursor.execute(
							'UPDATE symbol_account_refresh_state SET last_successful_run_id = %s WHERE id = 1',
							('new-run',))
						cursor.execute(
							'''UPDATE symbol_sync_state
							SET chain_height = 30, last_synced_height = 30, last_synced_block_hash = %s
							WHERE id = 1''',
							(bytes([30]) * 32,))
					writer.connection.commit()

				# Act:
				old_result = read_during_database_snapshot(
					database,
					lambda: database.get_account_statistics(7200, 7),
					switch_successful_run_and_watermark)
				new_result = database.get_account_statistics(7200, 7)

		# Assert:
		self.assertEqual((2, 1, 1, 1, Decimal('1')), old_result[:5])
		self.assertEqual((
			(Decimal('0.7'), str(Address(account_address(1)))),
			(Decimal('0.3'), str(Address(account_address(2))))
		), old_result.top_accounts)
		self.assertEqual((3, 2, 2, 1, Decimal('1')), new_result[:5])
		self.assertEqual((
			(Decimal('0.5'), str(Address(account_address(2)))),
			(Decimal('0.3'), str(Address(account_address(3)))),
			(Decimal('0.2'), str(Address(account_address(1))))
		), new_result.top_accounts)

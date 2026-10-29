import tempfile
from datetime import timedelta, timezone
from decimal import Decimal
from pathlib import Path
from unittest import TestCase

from common.symbol.NativeMosaic import NativeMosaicInfo
from flask import Flask
from psycopg2 import Error as PsycopgError
from symbolchain.symbol.Network import Address, Network

from rest import create_app
from rest.db.SymbolDatabase import AccountStatisticsRecord, SymbolDatabase, SymbolDataUnavailable
from rest.facade.SymbolRestFacade import SymbolRestFacade
from rest.model.symbol.HarvestingBalanceRange import HarvestingBalanceRange
from rest.routes.symbol import setup_symbol_routes

from ..test.EnvTestUtils import rest_settings_env
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
HARVESTING_BALANCE_RANGE = HarvestingBalanceRange(10_000_000_000, 49_999_999_999_999)


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


def _write_rest_app_config(directory, database_config, minimum_balance, maximum_balance):
	db_config_path = Path(directory) / 'database.ini'
	db_config_path.write_text(f'''[symbol_db]
database = {database_config.database}
user = {database_config.user}
password = {database_config.password}
host = {database_config.host}
port = {database_config.port}
''', encoding='utf8')
	app_config_path = Path(directory) / 'rest.config'
	app_config_path.write_text(f'''REST_CHAIN="symbol"
DATABASE_CONFIG_FILEPATH="{db_config_path}"
SYMBOL_NODE_URL="http://127.0.0.1:3000"
SYMBOL_NODE_ALLOWED_HOSTS="127.0.0.1:3000"
SYMBOL_NODE_ALLOW_LOOPBACK="true"
SYMBOL_NATIVE_MOSAIC_ID="{NATIVE_MOSAIC_ID}"
SYMBOL_ACCOUNT_REFRESH_MAX_AGE_SECONDS=7200
SYMBOL_HARVESTING_ACTIVE_WINDOW_DAYS=7
SYMBOL_HARVESTING_MIN_BALANCE={minimum_balance}
SYMBOL_HARVESTING_MAX_BALANCE={maximum_balance}
NETWORK_NAME="testnet"
''', encoding='utf8')
	return app_config_path


def _get_two_app_balance_responses(database_config):
	with tempfile.TemporaryDirectory() as first_directory, tempfile.TemporaryDirectory() as second_directory:
		first_config = _write_rest_app_config(first_directory, database_config, 100, 200)
		second_config = _write_rest_app_config(second_directory, database_config, 300, 400)
		with rest_settings_env(first_config):
			first_app = create_app()
		with rest_settings_env(second_config):
			second_app = create_app()

		first_database = first_app.extensions['symbol_database']
		second_database = second_app.extensions['symbol_database']
		first_database._clock = lambda: NOW  # pylint: disable=protected-access
		second_database._clock = lambda: NOW  # pylint: disable=protected-access
		try:
			first_client = first_app.test_client()
			second_client = second_app.test_client()
			return (
				first_client.get('/api/symbol/account/statistics'),
				second_client.get('/api/symbol/account/statistics'),
				first_client.get('/api/symbol/account/statistics'))
		finally:
			first_database.close()
			second_database.close()


class SymbolAccountStatisticsDatabaseTest(TestCase):  # pylint: disable=too-many-public-methods
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

	def test_get_account_statistics_uses_configured_native_mosaic_and_inclusive_atomic_bounds(self):
		# Arrange: other mosaic balances are decoys and the configured bounds are raw atomic units.
		amounts = [99, 100, 101, 199, 200, 201, None]
		entries = [
			create_refresh_entry('selected-run', identity, identity, 1, mosaic_rows=[
				(NATIVE_MOSAIC_ID, 10_000_000_000),
				*(([(CUSTOM_MOSAIC_ID, amount)]) if amount is not None else [])
			])
			for identity, amount in enumerate(amounts, 1)
		]
		with symbol_test_database(create_symbol_sync_state(100, 100)) as (config, writer):
			seed_refresh_run(writer, 'selected-run', entries)
			with SymbolDatabase(config, NativeMosaicInfo(CUSTOM_MOSAIC_ID, 6), clock=lambda: NOW) as database:
				# Act:
				result = database.get_account_statistics(7200, 7, HarvestingBalanceRange(100, 200))

		# Assert: both bounds and their interior are eligible, without divisibility scaling.
		self.assertEqual(7, result.total)
		self.assertEqual(4, result.eligible_for_harvesting)

	def test_get_account_statistics_counts_missing_mosaic_as_zero_balance(self):
		# Arrange: core treats an account without the configured mosaic as having zero balance.
		with symbol_test_database(create_symbol_sync_state(100, 100)) as (config, writer):
			seed_refresh_run(writer, 'selected-run', [create_refresh_entry('selected-run', 1, 0, 1)])
			with self._create_database(config) as database:
				# Act:
				result = database.get_account_statistics(7200, 7, HarvestingBalanceRange(0, 200))

		# Assert:
		self.assertEqual(1, result.eligible_for_harvesting)

	def test_statistics_http_reports_native_mosaic_counts_and_percentage(self):
		# Arrange: another mosaic is a decoy and only one eligible account is active.
		entries = [
			create_refresh_entry('selected-run', identity, identity, 1, mosaic_rows=[
				(CUSTOM_MOSAIC_ID, 1), (NATIVE_MOSAIC_ID, amount)])
			for identity, amount in [(1, 100), (2, 200), (3, 201)]
		]
		with symbol_test_database(create_symbol_sync_state(100, 100)) as (config, writer):
			seed_refresh_run(writer, 'selected-run', entries)
			writer.upsert_blocks([create_symbol_block(1, timestamp=NOW, beneficiary_address=account_address(1))])
			with self._create_database(config) as database:
				facade = SymbolRestFacade(
					database, NATIVE_MOSAIC_INFO, Network.TESTNET, 7200, 7, HarvestingBalanceRange(100, 200))
				app = Flask(__name__)
				setup_symbol_routes(app, facade)
				# Act:
				response = app.test_client().get('/api/symbol/account/statistics')

		# Assert:
		self.assertEqual(200, response.status_code)
		body = response.get_json()
		self.assertEqual(3, body['total'])
		self.assertEqual(1, body['harvesting'])
		self.assertEqual(2, body['eligibleForHarvesting'])
		self.assertEqual(50.0, body['harvestingAccountsPercentage'])
		self.assertEqual([[50.0, 'Harvesting'], [50.0, 'Not harvesting']], body['harvestingAccountsChart'])

	def test_create_app_uses_isolated_harvesting_balance_ranges(self):
		# Arrange:
		entries = [
			create_refresh_entry('selected-run', identity, identity, 1, mosaic_rows=[(NATIVE_MOSAIC_ID, amount)])
			for identity, amount in [(1, 150), (2, 180), (3, 350)]
		]
		with symbol_test_database(create_symbol_sync_state(100, 100)) as (config, writer):
			seed_refresh_run(writer, 'selected-run', entries)
			responses = _get_two_app_balance_responses(config)

		# Assert: creating the second app does not change either response from the first app.
		self.assertEqual([200, 200, 200], [response.status_code for response in responses])
		self.assertEqual([2, 1, 2], [response.get_json()['eligibleForHarvesting'] for response in responses])

	def test_statistics_http_rejects_refresh_that_ages_between_requests(self):
		# Arrange:
		clock = [NOW]
		with symbol_test_database(create_symbol_sync_state(100, 100)) as (config, writer):
			seed_refresh_run(writer, 'selected-run', create_statistics_entries(), completed_at=NOW)
			with self._create_database(config, clock=lambda: clock[0]) as database:
				facade = SymbolRestFacade(
					database, NATIVE_MOSAIC_INFO, Network.TESTNET, 10, 7, HarvestingBalanceRange(0, 200))
				app = Flask(__name__)
				setup_symbol_routes(app, facade)
				client = app.test_client()

				# Act:
				first_response = client.get('/api/symbol/account/statistics')
				clock[0] += timedelta(seconds=11)
				second_response = client.get('/api/symbol/account/statistics')

		# Assert:
		self.assertEqual(200, first_response.status_code)
		self.assertEqual(503, second_response.status_code)
		self.assertEqual({'status': 503, 'message': 'Symbol backend data is unavailable'}, second_response.get_json())

	def test_statistics_http_rejects_sync_state_that_becomes_unhealthy_between_requests(self):
		# Arrange:
		with symbol_test_database(create_symbol_sync_state(100, 100)) as (config, writer):
			seed_refresh_run(writer, 'selected-run', create_statistics_entries())
			with self._create_database(config) as database:
				facade = SymbolRestFacade(
					database, NATIVE_MOSAIC_INFO, Network.TESTNET, 7200, 7, HarvestingBalanceRange(0, 200))
				app = Flask(__name__)
				setup_symbol_routes(app, facade)
				client = app.test_client()

				# Act:
				first_response = client.get('/api/symbol/account/statistics')
				writer.upsert_sync_state(create_symbol_sync_state(100, 100, status='unhealthy'))
				second_response = client.get('/api/symbol/account/statistics')

		# Assert:
		self.assertEqual(200, first_response.status_code)
		self.assertEqual(503, second_response.status_code)
		self.assertEqual({'status': 503, 'message': 'Symbol backend data is unavailable'}, second_response.get_json())

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
				result = database.get_account_statistics(7200, 7, HARVESTING_BALANCE_RANGE)

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
				result = database.get_account_statistics(7200, 7, HarvestingBalanceRange(10_000_000_000, 49_999_999_999_999))

		# Assert: the configured mosaic yields two eligible accounts; the default-mosaic decoy yields one.
		self.assertEqual(3, result.total)
		self.assertEqual(2, result.eligible_for_harvesting)

	def test_get_account_statistics_uses_supplied_atomic_balance_bounds(self):
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
				result = database.get_account_statistics(7200, 7, HarvestingBalanceRange(10_000_000, 49_999_999_999))

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
				result = database.get_account_statistics(7200, 3, HARVESTING_BALANCE_RANGE)

		# Assert: only the two-day beneficiary is active for three days; a seven-day hardcode counts both.
		self.assertEqual(1, result.harvesting)

	def test_get_account_statistics_compares_utc_storage_with_offset_clock(self):
		# Arrange: timestamp without time zone values represent UTC, including the exact boundary.
		cutoff = NOW - timedelta(days=7)
		clock = NOW.astimezone(timezone(timedelta(hours=5, minutes=30)))
		with symbol_test_database(create_symbol_sync_state(100, 100)) as (config, writer):
			seed_refresh_run(writer, 'selected-run', [create_refresh_entry('selected-run', i, i, 1) for i in (1, 2, 3)])
			blocks = [
				create_symbol_block(
					i, beneficiary_address=account_address(i),
					timestamp=(cutoff + timedelta(seconds=delta)).replace(tzinfo=None))
				for i, delta in [(1, -1), (2, 0), (3, 1)]
			]
			writer.upsert_blocks(blocks)
			with self._create_database(config, clock=lambda: clock) as database:
				with database.connection() as connection:
					with connection.cursor() as cursor:
						cursor.execute("SET TIME ZONE 'America/New_York'")
					connection.commit()
				# Act:
				result = database.get_account_statistics(7200, 7, HARVESTING_BALANCE_RANGE)

		# Assert: UTC storage includes exactly the two boundary-or-later blocks.
		self.assertEqual(2, result.harvesting)

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
				at_boundary = database.get_account_statistics(7201, 7, HARVESTING_BALANCE_RANGE)
				clock[0] += timedelta(seconds=1)
				after_boundary = database.get_account_statistics(7201, 7, HARVESTING_BALANCE_RANGE)

		# Assert: the exact cutoff is active, but becomes older after the clock advances.
		self.assertEqual(2, at_boundary.harvesting)
		self.assertEqual(1, after_boundary.harvesting)

	def test_get_account_statistics_orders_top_ties_by_address_at_top_ten_boundary(self):
		# Arrange:
		importance_by_identity = {
			1: 160, 2: 140, 3: 140, 4: 120, 5: 100, 6: 80,
			7: 70, 8: 60, 9: 50, 10: 40, 11: 40, 12: 0
		}
		entries = [
			create_refresh_entry('selected-run', identity, identity, importance)
			for identity, importance in importance_by_identity.items()
		]
		with symbol_test_database(create_symbol_sync_state(100, 100)) as (config, writer):
			seed_refresh_run(writer, 'selected-run', entries)
			with self._create_database(config) as database:
				# Act:
				result = database.get_account_statistics(7200, 7, HARVESTING_BALANCE_RANGE)

		# Assert: tied importance uses address order, including the tie that straddles rank ten.
		expected_identities = sorted(
			importance_by_identity,
			key=lambda identity: (-importance_by_identity[identity], account_address(identity)))[:10]
		expected_addresses = tuple(str(Address(account_address(identity))) for identity in expected_identities)
		self.assertEqual(expected_addresses, tuple(row[1] for row in result.top_accounts))
		self.assertEqual(12, result.total)
		self.assertEqual(Decimal('1'), result.total_importance)

	def test_get_account_statistics_returns_empty_statistics_for_empty_successful_snapshot(self):
		# Arrange:
		with symbol_test_database(create_symbol_sync_state(100, 100)) as (config, writer):
			seed_refresh_run(writer, 'empty-run', [])
			with self._create_database(config) as database:
				# Act:
				result = database.get_account_statistics(7200, 7, HARVESTING_BALANCE_RANGE)

		# Assert:
		self.assertEqual(AccountStatisticsRecord(0, 0, 0, 0, Decimal(0), ()), result)

	def test_get_account_statistics_rejects_missing_successful_refresh(self):
		# Arrange:
		with symbol_test_database(create_symbol_sync_state(100, 100)) as (config, _writer):
			with self._create_database(config) as database:
				# Act:
				with self.assertRaises(SymbolDataUnavailable) as context:
					database.get_account_statistics(7200, 7, HARVESTING_BALANCE_RANGE)

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
						database.get_account_statistics(7200, 7, HARVESTING_BALANCE_RANGE)
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
					database.get_account_statistics(7200, 7, HARVESTING_BALANCE_RANGE)

		# Assert:
		self.assertEqual('Symbol account refresh data is unavailable', str(context.exception))

	def test_get_account_statistics_accepts_refresh_at_max_age_boundary(self):
		# Arrange:
		with symbol_test_database(create_symbol_sync_state(100, 100)) as (config, writer):
			seed_refresh_run(
				writer, 'selected-run', create_statistics_entries(), completed_at=NOW - timedelta(seconds=7200))
			with self._create_database(config) as database:
				# Act:
				result = database.get_account_statistics(7200, 7, HARVESTING_BALANCE_RANGE)

		# Assert:
		self.assertEqual(4, result.total)

	def test_get_account_statistics_rejects_unreadable_sync_state_with_successful_snapshot(self):
		# Arrange:
		with symbol_test_database(create_symbol_sync_state(100, 100, status='unhealthy')) as (config, writer):
			seed_refresh_run(writer, 'selected-run', create_statistics_entries())
			with self._create_database(config) as database:
				# Act:
				with self.assertRaises(SymbolDataUnavailable) as context:
					database.get_account_statistics(7200, 7, HARVESTING_BALANCE_RANGE)

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
					database.get_account_statistics(7200, 7, HARVESTING_BALANCE_RANGE)

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
					lambda: database.get_account_statistics(7200, 7, HARVESTING_BALANCE_RANGE),
					switch_successful_run_and_watermark)
				new_result = database.get_account_statistics(7200, 7, HARVESTING_BALANCE_RANGE)

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

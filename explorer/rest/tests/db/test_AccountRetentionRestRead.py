"""REST account reads remain complete across publication and generation cleanup."""
from datetime import datetime, timezone
from decimal import Decimal
from threading import Event, Thread

from common.symbol.NativeMosaic import NativeMosaicInfo
from symbolchain.symbol.Network import Address

from rest.db.SymbolDatabase import (
	AccountListQuery,
	AccountListRecord,
	AccountSortField,
	AccountStatisticsRecord,
	MosaicRecord,
	SymbolDatabase
)
from rest.model.symbol.HarvestingBalanceRange import HarvestingBalanceRange

from ..test.SymbolAccountListTestUtils import (
	CUSTOM_MOSAIC_ID,
	NATIVE_MOSAIC_ID,
	REFRESH_COMPLETED_AT,
	account_address,
	create_refresh_entry,
	seed_refresh_run
)
from ..test.SymbolBlockTestUtils import create_symbol_sync_state
from ..test.SymbolDatabaseTestUtils import symbol_test_database

COMPLETED_AT = datetime(2026, 1, 1, tzinfo=timezone.utc)
NATIVE_MOSAIC_INFO = NativeMosaicInfo(NATIVE_MOSAIC_ID, 6)


def _assert_read_survives_cleanup(read, expected_old, expected_current):  # pylint: disable=too-many-locals,too-many-statements
	# Arrange: publish distinct old and current generations around a paused reader.
	with symbol_test_database(create_symbol_sync_state(100, 100)) as (database_config, writer):
		seed_refresh_run(writer, 'old', [
			create_refresh_entry(
				'old', 1, 1, 1, public_key=bytes([11]) * 32,
				mosaic_rows=[(NATIVE_MOSAIC_ID, 10), (CUSTOM_MOSAIC_ID, 11)]),
			create_refresh_entry(
				'old', 2, 0, 3, public_key=bytes([12]) * 32, account_type='remote',
				mosaic_rows=[(NATIVE_MOSAIC_ID, 20), (CUSTOM_MOSAIC_ID, 22)])
		], completed_at=REFRESH_COMPLETED_AT)
		selected = Event()
		resume = Event()

		class PausingDatabase(SymbolDatabase):  # pylint: disable=arguments-differ
			def __init__(self, *args):
				super().__init__(*args)
				self.isolation = None
				self.read_connection = None

			def _start_read_transaction(self, cursor):  # pylint: disable=arguments-differ
				self.read_connection = cursor.connection
				super()._start_read_transaction(cursor)
				cursor.execute("SET LOCAL statement_timeout = '3000ms'")

			def _fetch_account_refresh_state(self, cursor):  # pylint: disable=arguments-differ
				state = super()._fetch_account_refresh_state(cursor)
				cursor.execute('SHOW transaction_isolation')
				self.isolation = cursor.fetchone()[0]
				selected.set()
				if not resume.wait(timeout=10):
					raise RuntimeError('Timed out waiting for generation cleanup')

				return state

		reader = PausingDatabase(database_config, NATIVE_MOSAIC_INFO, lambda: COMPLETED_AT)
		results = []
		errors = []

		def read_in_thread():
			try:
				results.append(read(reader))
			except Exception as error:  # pylint: disable=broad-exception-caught
				errors.append(error)

		worker = Thread(target=read_in_thread, daemon=True)
		# Act: keep the selected snapshot open while two publications and cleanup commit.
		try:
			worker.start()
			assert selected.wait(timeout=10), 'REST reader did not select a generation'
			seed_refresh_run(writer, 'middle', [
				create_refresh_entry(
					'middle', 5, 0, 1, mosaic_rows=[(NATIVE_MOSAIC_ID, 55), (CUSTOM_MOSAIC_ID, 66)])
			], completed_at=REFRESH_COMPLETED_AT)
			seed_refresh_run(writer, 'current', [
				create_refresh_entry(
					'current', 1, 1, 1, public_key=bytes([21]) * 32, account_type='remote',
					mosaic_rows=[(NATIVE_MOSAIC_ID, 90), (CUSTOM_MOSAIC_ID, 91)]),
				create_refresh_entry(
					'current', 3, 0, 2, public_key=bytes([23]) * 32,
					mosaic_rows=[(NATIVE_MOSAIC_ID, 30), (CUSTOM_MOSAIC_ID, 31)]),
				create_refresh_entry(
					'current', 4, 2, 3, public_key=bytes([24]) * 32,
					mosaic_rows=[(NATIVE_MOSAIC_ID, 70), (CUSTOM_MOSAIC_ID, 71)])
			], completed_at=REFRESH_COMPLETED_AT)
			with writer.workflow_lock():
				writer.prune_account_refresh_generations()

			with writer.connection.cursor() as cursor:
				for table in (
					'symbol_account_refresh_accounts',
					'symbol_account_refresh_mosaics',
					'symbol_account_list_ranks'
				):
					cursor.execute(f'SELECT count(*) FROM {table} WHERE refresh_run_id = %s', ('old',))
					assert cursor.fetchone()[0] == 0
		finally:
			resume.set()
			if worker.ident is not None:
				worker.join(timeout=10)

			if worker.is_alive() and reader.read_connection is not None:
				try:
					reader.read_connection.cancel()
				except Exception as error:  # pylint: disable=broad-exception-caught
					errors.append(error)

				worker.join(timeout=5)

			if worker.is_alive() and reader.read_connection is not None:
				try:
					with writer.connection.cursor() as cursor:
						cursor.execute('SELECT pg_terminate_backend(%s)', (reader.read_connection.get_backend_pid(),))

					writer.connection.commit()
				except Exception as error:  # pylint: disable=broad-exception-caught
					errors.append(error)

				worker.join(timeout=5)

			if not worker.is_alive():
				reader.close()

		# Assert: the in-flight and next reads each match their complete generation.
		assert not worker.is_alive(), 'REST reader did not stop after cancellation'
		assert not errors
		assert reader.isolation == 'repeatable read'
		assert results == [expected_old]
		with SymbolDatabase(database_config, NATIVE_MOSAIC_INFO, lambda: COMPLETED_AT) as current:
			assert read(current) == expected_current


def test_rest_statistics_survive_cleanup():
	# Arrange:
	old = AccountStatisticsRecord(
		2, 0, 2, 0, Decimal('1'),
		((Decimal('0.75'), str(Address(account_address(2)))), (Decimal('0.25'), str(Address(account_address(1)))))
	)
	current = AccountStatisticsRecord(
		3, 0, 3, 0, Decimal('1'),
		((Decimal('0.5'), str(Address(account_address(4)))), (Decimal('0.33333333333333333333'), str(Address(account_address(3)))),
			(Decimal('0.16666666666666666667'), str(Address(account_address(1)))))
	)

	def read_statistics(reader):
		return reader.get_account_statistics(3600, 7, HarvestingBalanceRange(0, 100))

	_assert_read_survives_cleanup(read_statistics, old, current)


def test_rest_list_survives_cleanup():
	# Arrange:
	old = [
		AccountListRecord(
			account_address(2), bytes([12]) * 32, 'remote', Decimal('0.75'), NATIVE_MOSAIC_ID, (),
			(MosaicRecord(CUSTOM_MOSAIC_ID, 22, None, None, None, ()), MosaicRecord(NATIVE_MOSAIC_ID, 20, None, None, None, ())),
			False, None),
		AccountListRecord(
			account_address(1), bytes([11]) * 32, 'main', Decimal('0.25'), NATIVE_MOSAIC_ID, (),
			(MosaicRecord(CUSTOM_MOSAIC_ID, 11, None, None, None, ()), MosaicRecord(NATIVE_MOSAIC_ID, 10, None, None, None, ())),
			False, None)
	]
	current = [
		AccountListRecord(
			account_address(3), bytes([23]) * 32, 'main', Decimal('0.33333333333333333333'), NATIVE_MOSAIC_ID, (),
			(MosaicRecord(CUSTOM_MOSAIC_ID, 31, None, None, None, ()), MosaicRecord(NATIVE_MOSAIC_ID, 30, None, None, None, ())),
			False, None),
		AccountListRecord(
			account_address(1), bytes([21]) * 32, 'remote', Decimal('0.16666666666666666667'), NATIVE_MOSAIC_ID, (),
			(MosaicRecord(CUSTOM_MOSAIC_ID, 91, None, None, None, ()), MosaicRecord(NATIVE_MOSAIC_ID, 90, None, None, None, ())),
			False, None),
		AccountListRecord(
			account_address(4), bytes([24]) * 32, 'main', Decimal('0.5'), NATIVE_MOSAIC_ID, (),
			(MosaicRecord(CUSTOM_MOSAIC_ID, 71, None, None, None, ()), MosaicRecord(NATIVE_MOSAIC_ID, 70, None, None, None, ())),
			False, None)
	]

	def read_list(reader):
		query = AccountListQuery(AccountSortField.ID, None, 100, 0, False)
		return reader.get_account_list(query, 3600, 7)

	_assert_read_survives_cleanup(read_list, old, current)

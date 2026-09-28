from contextlib import contextmanager
from threading import Event, Thread

from common.tests.PostgresTestUtils import PostgresTestDatabase, drop_symbol_block_tables_if_present
from puller.db.SymbolDatabase import SymbolDatabase as PullerSymbolDatabase

from rest.db.SymbolDatabase import SymbolDatabase

from .SymbolBlockTestUtils import create_symbol_sync_state


class PausingAfterSyncStateReadSymbolDatabase(SymbolDatabase):
	"""Pauses after reading sync state to test repeatable-read snapshot boundaries."""

	def __init__(self, db_config):
		super().__init__(db_config)
		self.state_read_event = Event()
		self.allow_query_event = Event()

	def _fetch_sync_state(self, cursor):  # pylint: disable=arguments-differ
		sync_state = super()._fetch_sync_state(cursor)
		self.state_read_event.set()
		if not self.allow_query_event.wait(timeout=5):
			raise RuntimeError('Timed out waiting for snapshot interleaving')

		return sync_state


def initialize_symbol_database(puller_database, sync_state=None, blocks=(), mosaics=()):
	"""Recreates the Symbol test tables and seeds shared block and mosaic state."""

	drop_symbol_block_tables_if_present(puller_database)
	puller_database.create_tables()
	if sync_state is not None:
		puller_database.upsert_sync_state(sync_state)
	if blocks:
		puller_database.upsert_blocks(blocks)
	for mosaic in mosaics:
		puller_database.upsert_mosaic(mosaic)


@contextmanager
def symbol_test_database(sync_state=None, blocks=(), mosaics=()):
	"""Provides an initialized PostgreSQL-backed Symbol fixture and cleans up its tables."""

	with PostgresTestDatabase() as db_config:
		with PullerSymbolDatabase(db_config) as puller_database:
			try:
				initialize_symbol_database(puller_database, sync_state, blocks, mosaics)
				yield db_config, puller_database
			finally:
				drop_symbol_block_tables_if_present(puller_database)


def read_during_database_snapshot(database, read_callback, update_callback):
	"""Pauses a database reader after its first snapshot read while another transaction commits."""

	results = []
	errors = []

	def read_database():
		try:
			results.append(read_callback())
		except Exception as error:  # pylint: disable=broad-exception-caught
			errors.append(error)

	reader_thread = Thread(target=read_database)
	reader_thread.start()
	primary_error = None
	primary_traceback = None
	cleanup_error = None
	try:
		if not database.state_read_event.wait(timeout=5):
			raise AssertionError('Reader did not fetch sync state')
		update_callback()
	except Exception as error:  # pylint: disable=broad-exception-caught
		primary_error = error
		primary_traceback = error.__traceback__
	finally:
		try:
			database.allow_query_event.set()
		except Exception as error:  # pylint: disable=broad-exception-caught
			cleanup_error = error

		try:
			reader_thread.join(timeout=5)
			if reader_thread.is_alive():
				raise AssertionError('Reader did not finish')
		except Exception as error:  # pylint: disable=broad-exception-caught
			cleanup_error = error

	if primary_error:
		if cleanup_error:
			raise primary_error.with_traceback(primary_traceback) from cleanup_error
		raise primary_error.with_traceback(primary_traceback)

	if cleanup_error:
		raise cleanup_error

	if errors:
		raise errors[0]

	return results[0]


def create_safe_repairing_sync_state():
	"""Returns a repairing state with one published clean height."""

	return create_symbol_sync_state(
		last_synced_height=2,
		finalized_height=1,
		status='repairing',
		dirty_state_from_height=3)


def group_records_by_height(records):
	"""Groups persisted test records by their stored height."""

	grouped_records = {}
	for record in records:
		grouped_records.setdefault(record['height'], []).append(record)

	return grouped_records

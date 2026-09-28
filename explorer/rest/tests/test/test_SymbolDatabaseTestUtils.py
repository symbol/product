from threading import Event
from types import SimpleNamespace
from unittest import TestCase

from .SymbolDatabaseTestUtils import read_during_database_snapshot


class SetFailingEvent(Event):
	"""Releases a waiter, then raises to exercise snapshot cleanup precedence."""

	def __init__(self, error):
		super().__init__()
		self.error = error

	def set(self):
		super().set()
		raise self.error


class WaitFailingEvent(Event):
	"""Returns a timeout immediately to exercise a failed snapshot rendezvous."""

	def wait(self, timeout=None):
		return False


class SymbolDatabaseTestUtilsTest(TestCase):
	def test_read_during_database_snapshot_joins_reader_and_preserves_update_error(self):
		# Arrange:
		read_sync_state = Event()
		cleanup_error = RuntimeError('release failed after notifying reader')
		allow_query = SetFailingEvent(cleanup_error)
		database = SimpleNamespace(state_read_event=read_sync_state, allow_query_event=allow_query)
		reader_finished = Event()
		update_error = ValueError('update failed')

		def read_callback():
			try:
				read_sync_state.set()
				if not allow_query.wait(timeout=5):
					raise AssertionError('Reader was not released')
				return 'snapshot'
			finally:
				reader_finished.set()

		def update_callback():
			raise update_error

		# Act:
		with self.assertRaises(ValueError) as exception_context:
			read_during_database_snapshot(database, read_callback, update_callback)

		# Assert:
		self.assertIs(update_error, exception_context.exception)
		self.assertIs(cleanup_error, exception_context.exception.__cause__)
		self.assertTrue(reader_finished.is_set())

	def test_read_during_database_snapshot_propagates_sync_state_wait_failure_after_join(self):
		# Arrange:
		read_sync_state = WaitFailingEvent()
		allow_query = Event()
		database = SimpleNamespace(state_read_event=read_sync_state, allow_query_event=allow_query)
		reader_finished = Event()

		def read_callback():
			try:
				read_sync_state.set()
				if not allow_query.wait(timeout=5):
					raise AssertionError('Reader was not released')
				return 'snapshot'
			finally:
				reader_finished.set()

		# Act:
		with self.assertRaisesRegex(AssertionError, 'Reader did not fetch sync state'):
			read_during_database_snapshot(database, read_callback, lambda: None)

		# Assert:
		self.assertTrue(reader_finished.is_set())

	def test_read_during_database_snapshot_propagates_reader_error(self):
		# Arrange:
		read_sync_state = Event()
		allow_query = Event()
		database = SimpleNamespace(state_read_event=read_sync_state, allow_query_event=allow_query)
		reader_finished = Event()
		reader_error = ValueError('reader failed')

		def read_callback():
			try:
				read_sync_state.set()
				if not allow_query.wait(timeout=5):
					raise AssertionError('Reader was not released')
				raise reader_error
			finally:
				reader_finished.set()

		# Act:
		with self.assertRaises(ValueError) as exception_context:
			read_during_database_snapshot(database, read_callback, lambda: None)

		# Assert:
		self.assertIs(reader_error, exception_context.exception)
		self.assertTrue(reader_finished.is_set())

	def test_read_during_database_snapshot_propagates_cleanup_error_after_reader_finishes(self):
		# Arrange:
		read_sync_state = Event()
		cleanup_error = RuntimeError('release failed after notifying reader')
		allow_query = SetFailingEvent(cleanup_error)
		database = SimpleNamespace(state_read_event=read_sync_state, allow_query_event=allow_query)
		reader_finished = Event()

		def read_callback():
			try:
				read_sync_state.set()
				if not allow_query.wait(timeout=5):
					raise AssertionError('Reader was not released')
				return 'snapshot'
			finally:
				reader_finished.set()

		# Act:
		with self.assertRaises(RuntimeError) as exception_context:
			read_during_database_snapshot(database, read_callback, lambda: None)

		# Assert:
		self.assertIs(cleanup_error, exception_context.exception)
		self.assertTrue(reader_finished.is_set())

	def test_read_during_database_snapshot_reports_reader_still_running_after_finite_join(self):
		# Arrange:
		read_sync_state = Event()
		allow_query = Event()
		release_reader = Event()
		reader_finished = Event()
		database = SimpleNamespace(state_read_event=read_sync_state, allow_query_event=allow_query)

		def read_callback():
			try:
				read_sync_state.set()
				if not allow_query.wait(timeout=5):
					raise AssertionError('Reader was not released')
				release_reader.wait(timeout=10)
				return 'snapshot'
			finally:
				reader_finished.set()

		# Act:
		try:
			with self.assertRaisesRegex(AssertionError, 'Reader did not finish'):
				read_during_database_snapshot(database, read_callback, lambda: None)
		finally:
			release_reader.set()

		# Assert:
		self.assertTrue(reader_finished.wait(timeout=5))

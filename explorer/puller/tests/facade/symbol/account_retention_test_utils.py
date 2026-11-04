"""Helpers for PostgreSQL account-retention integration tests."""
import threading
import time

from puller.db.SymbolDatabase import SymbolDatabase


class AccountRetentionDeleteGate:
	"""Owns an advisory lock for tests where lock contention is the target behavior."""

	def __init__(self, database, db_config, target_run_id):
		self.database = database
		self.observer = SymbolDatabase(db_config)
		self.target_run_id = target_run_id
		self.is_locked = False

	def __enter__(self):
		self.observer.__enter__()
		try:
			with self.database.connection.cursor() as cursor:
				cursor.execute('CREATE TABLE retention_test_gate_state (target varchar NOT NULL, attempts int NOT NULL)')
				cursor.execute('INSERT INTO retention_test_gate_state VALUES (%s, 0)', (self.target_run_id,))
				cursor.execute('''
					CREATE FUNCTION retention_test_gate() RETURNS trigger LANGUAGE plpgsql AS $$
					BEGIN
						IF OLD.refresh_run_id = (SELECT target FROM retention_test_gate_state) THEN
							UPDATE retention_test_gate_state SET attempts = attempts + 1;
							PERFORM pg_advisory_xact_lock(73502, 1);
						END IF;
						RETURN OLD;
					END $$
				''')
				cursor.execute('''
					CREATE TRIGGER retention_test_gate BEFORE DELETE ON symbol_account_list_ranks
					FOR EACH ROW EXECUTE FUNCTION retention_test_gate()
				''')

			self.database.connection.commit()
			with self.observer.connection.cursor() as cursor:
				cursor.execute('SELECT pg_advisory_lock(73502, 1)')

			self.observer.connection.commit()
			self.is_locked = True
			return self
		except BaseException:
			self.__exit__(None, None, None)
			raise

	def wait_for_advisory_wait(self, worker_pid):
		"""Waits until PostgreSQL confirms the worker is blocked on an advisory lock."""

		cursor = self.observer.connection.cursor()
		deadline = time.monotonic() + 5
		while time.monotonic() < deadline:
			cursor.execute(
				'SELECT EXISTS (SELECT 1 FROM pg_locks WHERE pid = %s AND locktype = %s AND NOT granted)',
				(worker_pid, 'advisory'))
			if cursor.fetchone()[0]:
				self.observer.connection.commit()
				return

			threading.Event().wait(0.01)

		raise AssertionError('worker did not reach the PostgreSQL advisory gate')

	def release(self):
		"""Releases the advisory gate; safe to invoke again from cleanup."""

		if self.is_locked and not self.observer.connection.closed:
			self.observer.connection.rollback()
			with self.observer.connection.cursor() as cursor:
				cursor.execute('SELECT pg_advisory_unlock(73502, 1)')

			self.observer.connection.commit()
			self.is_locked = False

	def stop_worker(self, worker, connection):
		"""Releases a worker and cancels its database operation if it fails to finish."""

		self.release()
		if worker.ident is None:
			return

		worker.join(15)
		if worker.is_alive() and connection is not None:
			if not connection.closed:
				connection.cancel()

			worker.join(5)

		if worker.is_alive():
			raise AssertionError('cleanup worker did not finish after release and cancellation')

	def __exit__(self, *_):
		try:
			self.release()
		finally:
			self.observer.__exit__(None, None, None)
			self.database.connection.rollback()
			with self.database.connection.cursor() as cursor:
				cursor.execute("SET LOCAL lock_timeout = '5s'")
				cursor.execute('DROP FUNCTION IF EXISTS retention_test_gate() CASCADE')
				cursor.execute('DROP TABLE IF EXISTS retention_test_gate_state')

			self.database.connection.commit()


class AccountRetentionReleaseGate:
	"""Uses a polled flag row for observations that must not consume lock_timeout."""

	def __init__(self, database, db_config, target_run_id, max_wait_seconds=30):
		self.database = database
		self.observer = SymbolDatabase(db_config)
		self.target_run_id = target_run_id
		self.max_wait_seconds = max_wait_seconds

	def __enter__(self):
		self.observer.__enter__()
		try:
			self.install()
		except BaseException:
			self.database.connection.rollback()
			self.observer.__exit__(None, None, None)
			raise

		return self

	def install(self):
		with self.database.connection.cursor() as cursor:
			cursor.execute('CREATE TABLE retention_test_release_state (target varchar PRIMARY KEY, released boolean NOT NULL)')
			cursor.execute('INSERT INTO retention_test_release_state VALUES (%s, false)', (self.target_run_id,))
			function_sql = f'''
				CREATE FUNCTION retention_test_release_gate() RETURNS trigger LANGUAGE plpgsql AS $$
			DECLARE
				started_at timestamptz := clock_timestamp();
			BEGIN
				IF OLD.refresh_run_id = (SELECT target FROM retention_test_release_state) THEN
					WHILE NOT (SELECT released FROM retention_test_release_state WHERE target = OLD.refresh_run_id) LOOP
						IF clock_timestamp() - started_at > interval '{int(self.max_wait_seconds)} seconds' THEN
							RAISE EXCEPTION 'retention test release gate exceeded its server-side limit';
						END IF;
						PERFORM pg_sleep(0.01);
					END LOOP;
				END IF;
				RETURN OLD;
			END $$
			'''
			cursor.execute(function_sql)
			cursor.execute('''
				CREATE TRIGGER retention_test_release_gate BEFORE DELETE ON symbol_account_list_ranks
				FOR EACH ROW EXECUTE FUNCTION retention_test_release_gate()
			''')

		self.database.connection.commit()

	def wait_for_worker_sleep(self, worker_pid):
		"""Waits for the server-side polling gate, bounded independently of lock_timeout."""

		cursor = self.observer.connection.cursor()
		deadline = time.monotonic() + min(self.max_wait_seconds, 10)
		while time.monotonic() < deadline:
			cursor.execute('''
				SELECT wait_event = 'PgSleep' FROM pg_stat_activity WHERE pid = %s
			''', (worker_pid,))
			row = cursor.fetchone()
			if row and row[0]:
				self.observer.connection.commit()
				return

			self.observer.connection.commit()
			threading.Event().wait(0.01)

		raise AssertionError('worker did not reach the PostgreSQL flag gate before its observation deadline')

	def release(self):
		"""Opens the gate without acquiring a row lock held by the worker."""

		with self.observer.connection.cursor() as cursor:
			cursor.execute('UPDATE retention_test_release_state SET released = true WHERE target = %s', (self.target_run_id,))

		self.observer.connection.commit()

	def stop_worker(self, worker, connection):
		"""Opens the gate and bounds worker cleanup, cancelling its SQL if needed."""

		try:
			self.release()
		finally:
			if worker.ident is not None:
				worker.join(min(self.max_wait_seconds, 15))
				if worker.is_alive() and connection is not None and not connection.closed:
					connection.cancel()
					worker.join(5)

				if worker.is_alive():
					raise AssertionError('cleanup worker did not finish after release and cancellation')

	def remove(self):
		self.database.connection.rollback()
		with self.database.connection.cursor() as cursor:
			cursor.execute('DROP FUNCTION IF EXISTS retention_test_release_gate() CASCADE')
			cursor.execute('DROP TABLE IF EXISTS retention_test_release_state')

		self.database.connection.commit()

	def __exit__(self, *_):
		try:
			self.release()
		finally:
			try:
				self.remove()
			finally:
				self.observer.__exit__(None, None, None)


class ManualRetentionClock:
	"""Provides explicit monotonic readings to cleanup through constructor injection."""

	def __init__(self, initial_value=0):
		self.value = initial_value
		self.readings = []

	def monotonic(self):
		if self.readings:
			self.value = self.readings.pop(0)

		return self.value

	def use_readings(self, readings):
		self.readings = list(readings)


class RecordingRetentionLogger:
	"""Captures retention and workflow cleanup logs at the injected logger boundary."""

	def __init__(self, logging_error=None, info_callback=None):
		self.logging_error = logging_error
		self.info_callback = info_callback
		self.messages = []

	def info(self, message):
		self.messages.append(message)
		if self.info_callback:
			self.info_callback(message)

	def error(self, message):
		self.messages.append(message)
		if self.logging_error:
			raise self.logging_error

	def clear(self):
		self.messages.clear()

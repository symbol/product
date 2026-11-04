"""Real PostgreSQL coverage for bounded retention timeout and retry behavior."""
import asyncio
import threading

from common.tests.AccountRefreshTestUtils import seed_account_refresh_state
from psycopg2 import Error

from puller.db.AccountRetentionConfiguration import AccountRetentionConfiguration
from puller.db.SymbolDatabase import SymbolDatabase

from .account_retention_test_utils import (
	AccountRetentionDeleteGate,
	AccountRetentionReleaseGate,
	ManualRetentionClock,
	RecordingRetentionLogger
)
from .puller_test_utils import FakeConnector, RecordingCleanupLogger, SymbolPullerTestBase, create_node_block, set_symbol_connector


class AccountRetentionAdaptiveTimeoutsTest(SymbolPullerTestBase):
	def setUp(self):
		self.retention_clock = ManualRetentionClock()
		self.retention_logger = RecordingRetentionLogger()
		self.cleanup_logger = RecordingCleanupLogger()
		self.retention_time_source = self.retention_clock.monotonic
		super().setUp()

	def _seed_generations(self, size):
		database = self.puller.symbol_db
		database.retention_config = AccountRetentionConfiguration(1200, 800)
		seed_account_refresh_state(database, {
			'last_successful_run_id': 'z-published', 'previous_successful_run_id': 'z-previous',
			'running_run_id': 'z-running', 'is_retention_ready': True, 'status': 'healthy'
		})
		cursor = database.connection.cursor()
		cursor.execute('''
			INSERT INTO symbol_account_list_ranks (refresh_run_id, rank_scope, rank, address)
			SELECT 'b-target', 'ID', n, decode(lpad(to_hex(n), 48, '0'), 'hex') FROM generate_series(1,%s) n
		''', (size,))
		cursor.execute('''
			INSERT INTO symbol_account_refresh_accounts
			(refresh_run_id, address, address_text, account_search_order, importance, snapshot_height, snapshot_at)
			SELECT run_id, decode(lpad(to_hex(n), 48, '0'), 'hex'), run_id, 0, 1, 1, CURRENT_TIMESTAMP
			FROM unnest(ARRAY['z-previous','z-published','z-running']) WITH ORDINALITY AS protected(run_id, n)
		''')
		cursor.execute('''
			INSERT INTO symbol_account_refresh_mosaics
			(refresh_run_id, address, mosaic_id, amount, snapshot_height, snapshot_at)
			SELECT refresh_run_id, address, '1', 1, 1, CURRENT_TIMESTAMP FROM symbol_account_refresh_accounts
		''')
		cursor.execute('''
			INSERT INTO symbol_account_list_ranks (refresh_run_id, rank_scope, rank, address)
			SELECT refresh_run_id, 'ID', 0, address FROM symbol_account_refresh_accounts
		''')

		database.connection.commit()
		return database

	@staticmethod
	def _create_statement_delay(database, threshold, delay_seconds=1.4):
		cursor = database.connection.cursor()
		cursor.execute('CREATE TABLE retention_statement_audit (deleted int NOT NULL)')
		cursor.execute('CREATE TABLE retention_statement_threshold (size int NOT NULL)')
		cursor.execute('INSERT INTO retention_statement_threshold VALUES (%s)', (threshold,))
		cursor.execute(f'''
			CREATE FUNCTION retention_statement_delay() RETURNS trigger LANGUAGE plpgsql AS $$
			DECLARE affected int;
			BEGIN
				SELECT count(*) INTO affected FROM deleted_rows;
				IF affected > (SELECT size FROM retention_statement_threshold) THEN
					PERFORM pg_sleep({delay_seconds});
				END IF;
				INSERT INTO retention_statement_audit VALUES (affected);
				RETURN NULL;
			END $$
		''')
		cursor.execute('''
			CREATE TRIGGER retention_statement_delay AFTER DELETE ON symbol_account_list_ranks
			REFERENCING OLD TABLE AS deleted_rows FOR EACH STATEMENT EXECUTE FUNCTION retention_statement_delay()
		''')
		database.connection.commit()

	def _assert_protected_and_timeout_reset(self, database):
		state = database.get_account_refresh_state()
		self.assertEqual(('z-published', 'z-previous', 'z-running'), (
			state['last_successful_run_id'], state['previous_successful_run_id'], state['running_run_id']))
		cursor = database.connection.cursor()
		for table in ('symbol_account_refresh_accounts', 'symbol_account_refresh_mosaics', 'symbol_account_list_ranks'):
			cursor.execute(f"SELECT refresh_run_id FROM {table} WHERE refresh_run_id LIKE 'z-%' ORDER BY refresh_run_id")
			self.assertEqual([('z-previous',), ('z-published',), ('z-running',)], cursor.fetchall())

		cursor.execute('SHOW statement_timeout')
		self.assertEqual(('0',), cursor.fetchone())
		cursor.execute('SHOW lock_timeout')
		self.assertEqual(('0',), cursor.fetchone())
		database.connection.commit()

	@staticmethod
	def _create_sensitive_error_trigger(database):
		cursor = database.connection.cursor()
		cursor.execute('''
			CREATE FUNCTION retention_sensitive_error() RETURNS trigger LANGUAGE plpgsql AS $$
			BEGIN
				RAISE EXCEPTION USING ERRCODE = '22000', MESSAGE = 'account-message-sentinel',
					DETAIL = 'account-detail-sentinel';
			END $$
		''')
		cursor.execute('''
			CREATE TRIGGER retention_sensitive_error BEFORE DELETE ON symbol_account_list_ranks
			FOR EACH ROW EXECUTE FUNCTION retention_sensitive_error()
		''')
		database.connection.commit()

	def test_delete_timeouts_retry_at_minimum_and_each_pass_restarts_at_initial_batch(  # pylint: disable=too-many-statements,too-many-locals
		self):
		# Arrange: a one-row generation commits before two DELETEs time out in each pass.
		database = self._seed_generations(8000)
		initial_refresh_state = database.get_account_refresh_state()
		database.retention_config = AccountRetentionConfiguration(2000, 200)
		self._create_statement_delay(database, 500, delay_seconds=2.2)
		cursor = database.connection.cursor()
		cursor.execute('''
			INSERT INTO symbol_account_list_ranks (refresh_run_id, rank_scope, rank, address)
			VALUES ('a-committed', 'ID', 0, %s)
		''', (bytes([42]) * 24,))
		cursor.execute('CREATE SEQUENCE retention_statement_timeout_attempt_seq')
		cursor.execute('CREATE TABLE retention_test_pass_state (pass_no int NOT NULL)')
		cursor.execute('INSERT INTO retention_test_pass_state VALUES (1)')
		sequence_names = ['retention_timeout_prior_ms_seq'] + [
			f'retention_timeout_pass{pass_no}_{batch_size}_ms_seq'
			for pass_no in (1, 2) for batch_size in (5000, 2500, 500)
		]
		for sequence_name in sequence_names:
			cursor.execute(f'CREATE SEQUENCE {sequence_name}')
		cursor.execute('''
			CREATE OR REPLACE FUNCTION retention_statement_delay() RETURNS trigger LANGUAGE plpgsql AS $$
			DECLARE affected int;
				timeout_ms bigint;
				timeout_attempt int;
				current_pass int;
			BEGIN
				SELECT count(*) INTO affected FROM deleted_rows;
				timeout_ms := (extract(epoch FROM current_setting('statement_timeout')::interval) * 1000)::bigint;
				SELECT pass_no INTO current_pass FROM retention_test_pass_state;
				IF affected = 1 THEN
					PERFORM setval('retention_timeout_prior_ms_seq', timeout_ms, true);
				ELSIF affected > 2500 THEN
					IF current_pass = 1 THEN
						PERFORM setval('retention_timeout_pass1_5000_ms_seq', timeout_ms, true);
					ELSE
						PERFORM setval('retention_timeout_pass2_5000_ms_seq', timeout_ms, true);
					END IF;
				ELSIF affected > 500 THEN
					IF current_pass = 1 THEN
						PERFORM setval('retention_timeout_pass1_2500_ms_seq', timeout_ms, true);
					ELSE
						PERFORM setval('retention_timeout_pass2_2500_ms_seq', timeout_ms, true);
					END IF;
				ELSIF affected = 500 THEN
					IF current_pass = 1 THEN
						PERFORM setval('retention_timeout_pass1_500_ms_seq', timeout_ms, true);
					ELSE
						PERFORM setval('retention_timeout_pass2_500_ms_seq', timeout_ms, true);
					END IF;
				END IF;
				IF affected > 500 THEN
					timeout_attempt := nextval('retention_statement_timeout_attempt_seq');
					IF timeout_attempt <= 2 THEN
						PERFORM pg_sleep(2.2);
					END IF;
				END IF;
				INSERT INTO retention_statement_audit VALUES (affected);
				RETURN NULL;
			END $$
		''')
		database.connection.commit()

		# Advance the manual clock only after PostgreSQL has timed out a DELETE and
		# the production handler reports that timeout at its injected logger boundary.
		clock_advances = iter((1.7, 2.9, 6.7, 7.9))
		self.retention_logger.info_callback = lambda message: setattr(
			self.retention_clock, 'value', next(clock_advances)
		) if 'reason=statement_timeout' in message and 'next_batch_size=' in message else None

		# Act: each invocation times out at 5000 and 2500, then commits one 500-row batch.
		pass_messages = []
		for pass_index in range(2):
			if pass_index:
				previous_pass_clock = self.retention_clock.value
				self.retention_clock.value = 5
				self.assertGreater(self.retention_clock.value, previous_pass_clock)
				cursor.execute('ALTER SEQUENCE retention_statement_timeout_attempt_seq RESTART WITH 1')
				cursor.execute('UPDATE retention_test_pass_state SET pass_no = 2')
				database.connection.commit()
			self.retention_logger.clear()
			with database.workflow_lock():
				database.prune_account_refresh_generations(max_batches=4 if pass_index == 0 else 3)

			pass_messages.append(self.retention_logger.messages.copy())
			cursor.execute("SELECT count(*) FROM symbol_account_list_ranks WHERE refresh_run_id = 'b-target'")
			self.assertEqual((7500 - 500 * pass_index,), cursor.fetchone())
			cursor.execute("SELECT count(*) FROM symbol_account_list_ranks WHERE refresh_run_id = 'a-committed'")
			self.assertEqual((0,), cursor.fetchone())
			cursor.execute('SELECT deleted FROM retention_statement_audit ORDER BY ctid')
			self.assertEqual([(1,), *((500,) for _ in range(pass_index + 1))], cursor.fetchall())
			database.connection.commit()
			self.assertEqual(2.9 if pass_index == 0 else 7.9, self.retention_clock.value)

		# Assert: the trigger observed PostgreSQL's active GUCs, including the 500-row timeout.
		cursor.execute('SELECT last_value FROM retention_timeout_prior_ms_seq')
		self.assertEqual((1666,), cursor.fetchone())
		for pass_no in (1, 2):
			for batch_size, expected in ((5000, 1666), (2500, 1100), (500, 2000)):
				cursor.execute(f'SELECT last_value FROM retention_timeout_pass{pass_no}_{batch_size}_ms_seq')
				self.assertEqual((expected,), cursor.fetchone())

		# Assert: each pass timed out twice and committed one minimum-size batch.
		self.assertEqual(2, len(pass_messages))
		for messages in pass_messages:
			timeouts = [message for message in messages if 'reason=statement_timeout' in message]
			self.assertEqual(2, len(timeouts))
			self.assertIn('batch_size=5000', timeouts[0])
			self.assertIn('batch_size=2500', timeouts[1])
			self.assertTrue(any('next_batch_size=500' in message for message in messages))
			self.assertTrue(any('table=symbol_account_list_ranks batch_size=5000' in message for message in messages))
		cursor.execute("SELECT count(*) FROM symbol_account_list_ranks WHERE refresh_run_id = 'b-target'")
		self.assertEqual((7000,), cursor.fetchone())
		cursor.execute('SELECT deleted FROM retention_statement_audit ORDER BY ctid')
		self.assertEqual([(1,), (500,), (500,)], cursor.fetchall())
		self._assert_protected_and_timeout_reset(database)
		self.assertEqual(initial_refresh_state, database.get_account_refresh_state())

		# A separate database session can acquire the workflow lock after both passes.
		with SymbolDatabase(self.db_config) as observer:
			with observer.workflow_lock():
				pass

	def test_delete_timeout_halves_batch_then_commits_and_next_pass_resets(self):  # pylint: disable=too-many-statements
		# Arrange: a committed old run precedes a large generation whose first batch is slow.
		database = self._seed_generations(7500)
		cursor = database.connection.cursor()
		cursor.execute('''
			INSERT INTO symbol_account_list_ranks (refresh_run_id, rank_scope, rank, address)
			VALUES ('a-committed', 'ID', 0, %s)
		''', (bytes([42]) * 24,))
		database.connection.commit()
		self._create_statement_delay(database, 2500)
		self.retention_logger.clear()

		# Act: timeout shrinks the batch; subsequent statements commit within the configured timeout.
		with database.workflow_lock():
			database.prune_account_refresh_generations(max_batches=4)

		# Assert: timeout rollback preserved the target while reduced batches made durable progress.
		cursor.execute("SELECT count(*) FROM symbol_account_list_ranks WHERE refresh_run_id = 'b-target'")
		self.assertEqual((2500,), cursor.fetchone())
		cursor.execute('SELECT deleted FROM retention_statement_audit ORDER BY ctid')
		self.assertEqual([(1,), (2500,), (2500,)], cursor.fetchall())
		messages = self.retention_logger.messages
		self.assertTrue(any('reason=statement_timeout' in message and 'batch_size=5000' in message for message in messages))
		self.assertTrue(any('next_batch_size=2500' in message for message in messages))
		self._assert_protected_and_timeout_reset(database)

		# Arrange: add another target segment and turn off the delay for a later pass.
		cursor.execute('UPDATE retention_statement_threshold SET size = 999999')
		cursor.execute('''
			INSERT INTO symbol_account_list_ranks (refresh_run_id, rank_scope, rank, address)
			SELECT 'b-target', 'ID', n, decode(lpad(to_hex(n), 48, '0'), 'hex') FROM generate_series(7501,10000) n
		''')
		database.connection.commit()

		# Act: the next pass starts from the configured initial batch size again.
		with database.workflow_lock():
			database.prune_account_refresh_generations(max_batches=1)

		# Assert: the fresh 5000-row batch commits on the same database session.
		cursor.execute("SELECT count(*) FROM symbol_account_list_ranks WHERE refresh_run_id = 'b-target'")
		self.assertEqual((0,), cursor.fetchone())
		cursor.execute('SELECT deleted FROM retention_statement_audit ORDER BY ctid')
		self.assertEqual([(1,), (2500,), (2500,), (5000,)], cursor.fetchall())
		self._assert_protected_and_timeout_reset(database)

	def test_external_cancel_is_not_retried_as_statement_timeout(self):
		# Arrange: the trigger polls a flag so observation does not wait on lock_timeout.
		self._set_retention_time_budget(60)
		database = self._seed_generations(5)
		database.retention_config = AccountRetentionConfiguration(30000, 200)
		gate = self.exit_stack.enter_context(AccountRetentionReleaseGate(database, self.db_config, 'b-target'))
		errors = []

		def cleanup():
			try:
				with database.workflow_lock():
					database.prune_account_refresh_generations()
			except Exception as error:  # pylint: disable=broad-exception-caught
				errors.append(error)

		worker = threading.Thread(target=cleanup, daemon=True)
		try:
			# Act: cancel the active PostgreSQL statement only after the gate confirms contention.
			worker.start()
			gate.wait_for_worker_sleep(database.connection.get_backend_pid())
			with gate.observer.connection.cursor() as cursor:
				cursor.execute('SELECT pg_cancel_backend(%s)', (database.connection.get_backend_pid(),))
				self.assertEqual((True,), cursor.fetchone())

			gate.observer.connection.commit()
			worker.join(timeout=10)
		finally:
			gate.stop_worker(worker, database.connection)

		# Assert: the original cancellation propagates and did not trigger batch shrinkage.
		self.assertFalse(worker.is_alive())
		self.assertEqual(1, len(errors))
		self.assertIsInstance(errors[0], Error)
		self.assertEqual('57014', errors[0].pgcode)
		self.assertFalse(any('next_batch_size=' in message for message in self.retention_logger.messages))
		self.assertTrue(any('reason=database_error' in message and 'sqlstate=57014' in message for message in self.retention_logger.messages))
		cursor = database.connection.cursor()
		cursor.execute("SELECT count(*) FROM symbol_account_list_ranks WHERE refresh_run_id = 'b-target'")
		self.assertEqual((5,), cursor.fetchone())
		self._assert_protected_and_timeout_reset(database)

		# Act: after the flag is open, a separate session can reacquire the workflow lock and finish cleanup.
		with gate.observer.workflow_lock():
			gate.observer.prune_account_refresh_generations()

		# Assert: the interrupted generation was removed while protected generations remain.
		cursor.execute("SELECT count(*) FROM symbol_account_list_ranks WHERE refresh_run_id = 'b-target'")
		self.assertEqual((0,), cursor.fetchone())
		self._assert_protected_and_timeout_reset(database)

	def test_unknown_lock_error_propagates_and_later_cleanup_can_resume(self):
		# Arrange: a real trigger emits SQLSTATE 55P03 for a reason other than lock timeout.
		database = self._seed_generations(5)
		gate = self.exit_stack.enter_context(AccountRetentionDeleteGate(database, self.db_config, 'never-gate-a-row'))
		gate.release()
		cursor = database.connection.cursor()
		cursor.execute('''
			CREATE FUNCTION retention_raise_lock_error() RETURNS trigger LANGUAGE plpgsql AS $$
			BEGIN
				RAISE EXCEPTION USING ERRCODE = '55P03', MESSAGE = 'injected non-timeout lock error';
			END $$
		''')
		cursor.execute('''
			CREATE TRIGGER retention_raise_lock_error BEFORE DELETE ON symbol_account_list_ranks
			FOR EACH ROW EXECUTE FUNCTION retention_raise_lock_error()
		''')
		database.connection.commit()

		# Act: the failed real DELETE crosses the cleanup transaction boundary.
		with self.assertRaises(Error) as context:
			with database.workflow_lock():
				database.prune_account_refresh_generations()

		# Assert: the original error propagates, the DELETE rolls back, and no shrink is scheduled.
		self.assertEqual('55P03', context.exception.pgcode)
		self.assertEqual('injected non-timeout lock error', context.exception.diag.message_primary)
		messages = self.retention_logger.messages
		self.assertFalse(any('next_batch_size=' in message or 'reason=lock_timeout' in message for message in messages))
		self.assertTrue(any('reason=database_error' in message and 'sqlstate=55P03' in message for message in messages))
		cursor.execute("SELECT count(*) FROM symbol_account_list_ranks WHERE refresh_run_id = 'b-target'")
		self.assertEqual((5,), cursor.fetchone())
		self._assert_protected_and_timeout_reset(database)

		# Act: remove the injected error and retry through the separate session.
		cursor.execute('DROP TRIGGER retention_raise_lock_error ON symbol_account_list_ranks')
		cursor.execute('DROP FUNCTION retention_raise_lock_error()')
		database.connection.commit()
		with gate.observer.workflow_lock():
			gate.observer.prune_account_refresh_generations()

		# Assert: the abandoned generation is collected and the protected state remains intact.
		cursor.execute("SELECT count(*) FROM symbol_account_list_ranks WHERE refresh_run_id = 'b-target'")
		self.assertEqual((0,), cursor.fetchone())
		self._assert_protected_and_timeout_reset(database)

	def _assert_delete_timeout_stops_without_commit(self, size, batch_size, max_batches, threshold):
		# Arrange: a statement-level trigger stalls the real DELETE after its rows are selected.
		database = self._seed_generations(size)
		self._create_statement_delay(database, threshold)
		self.retention_logger.clear()

		# Act: PostgreSQL's statement timeout rolls the DELETE back.
		with database.workflow_lock():
			database.prune_account_refresh_generations(batch_size=batch_size, max_batches=max_batches)

		# Assert: the bounded pass stopped without committing or retrying the timed-out DELETE.
		cursor = database.connection.cursor()
		cursor.execute("SELECT count(*) FROM symbol_account_list_ranks WHERE refresh_run_id = 'b-target'")
		self.assertEqual((size,), cursor.fetchone())
		cursor.execute('SELECT deleted FROM retention_statement_audit')
		self.assertEqual([], cursor.fetchall())
		messages = self.retention_logger.messages
		self.assertEqual(1, sum('reason=statement_timeout' in message for message in messages))
		self._assert_protected_and_timeout_reset(database)
		return messages

	def test_minimum_batch_timeout_stops_the_retention_pass(self):
		messages = self._assert_delete_timeout_stops_without_commit(600, 500, 3, 0)

		# Assert: the minimum size terminates the pass without a further reduction.
		self.assertTrue(any('stop_reason=minimum_batch' in message for message in messages))
		self.assertFalse(any('next_batch_size=' in message for message in messages))

	def test_failed_delete_consumes_the_attempt_budget(self):
		messages = self._assert_delete_timeout_stops_without_commit(5000, 5000, 1, 2500)

		# Assert: the timeout exhausted the budget before any reduction was scheduled.
		self.assertTrue(any('stop_reason=attempt_limit' in message for message in messages))
		self.assertFalse(any('next_batch_size=' in message for message in messages))

	def _assert_workflow_survives_minimum_batch_timeout(self, is_refresh):  # pylint: disable=too-many-statements
		# Arrange: every DELETE times out, including the real 500-row minimum batch.
		database = self._seed_generations(600)
		database.retention_config = AccountRetentionConfiguration(500, 400)
		if is_refresh:
			set_symbol_connector(self.puller, FakeConnector(1, {}, account_pages={1: []}))
		else:
			seed_account_refresh_state(database, {'running_run_id': None})
			set_symbol_connector(self.puller, FakeConnector(1, {0: [create_node_block(1)]}))

		self._create_statement_delay(database, 0)
		self.retention_logger.clear()

		# Act: invoke the public workflow; the real DELETE reaches statement timeout.
		operation = self.puller.refresh_accounts() if is_refresh else self.puller.sync_block_headers()
		asyncio.run(operation)

		# Assert: the workflow remains successful and no rolled-back deletion was committed.
		messages = self.retention_logger.messages
		self.assertTrue(any('reason=statement_timeout' in message and 'batch_size=500' in message for message in messages))
		cursor = database.connection.cursor()
		cursor.execute("SELECT count(*) FROM symbol_account_list_ranks WHERE refresh_run_id = 'b-target'")
		self.assertEqual((600,), cursor.fetchone())
		cursor.execute('SELECT deleted FROM retention_statement_audit')
		# Finalization deletes an empty rank scope in the refresh case before cleanup starts.
		self.assertEqual([(0,)] if is_refresh else [], cursor.fetchall())
		state = database.get_account_refresh_state()
		if is_refresh:
			self.assertEqual(('z-published', None, 'healthy'), (
				state['previous_successful_run_id'], state['running_run_id'], state['status']))
			self.assertNotEqual('z-published', state['last_successful_run_id'])
		else:
			self.assertEqual(('z-published', 'z-previous', None), (
				state['last_successful_run_id'], state['previous_successful_run_id'], state['running_run_id']))
			self.assertEqual('healthy', database.get_sync_state()['status'])

		cursor.execute('SHOW statement_timeout')
		self.assertEqual(('0',), cursor.fetchone())
		cursor.execute('SHOW lock_timeout')
		self.assertEqual(('0',), cursor.fetchone())
		database.connection.commit()

		# Act: once the delay is disabled, the same DB connection retries cleanup.
		cursor.execute('UPDATE retention_statement_threshold SET size = 999999')
		database.connection.commit()
		with database.workflow_lock():
			database.prune_account_refresh_generations()

		# Assert: the failed generation was removed while the successful publication is retained.
		cursor.execute("SELECT count(*) FROM symbol_account_list_ranks WHERE refresh_run_id = 'b-target'")
		self.assertEqual((0,), cursor.fetchone())
		self.assertEqual(state['last_successful_run_id'], database.get_account_refresh_state()['last_successful_run_id'])

	def test_refresh_succeeds_when_minimum_delete_times_out(self):
		self._assert_workflow_survives_minimum_batch_timeout(True)

	def test_sync_succeeds_when_minimum_delete_times_out(self):
		self._assert_workflow_survives_minimum_batch_timeout(False)

	def _assert_workflow_redacts_database_error(self, is_refresh):
		# Arrange: the real DELETE fails with sentinel data in PostgreSQL's MESSAGE and DETAIL.
		database = self._seed_generations(5)
		if is_refresh:
			set_symbol_connector(self.puller, FakeConnector(1, {}, account_pages={1: []}))
		else:
			seed_account_refresh_state(database, {'running_run_id': None})
			set_symbol_connector(self.puller, FakeConnector(1, {0: [create_node_block(1)]}))

		cursor = database.connection.cursor()
		self._create_sensitive_error_trigger(database)
		self.cleanup_logger.messages.clear()
		self.retention_logger.clear()

		# Act: the public workflow succeeds even though retention encounters the real DB exception.
		operation = self.puller.refresh_accounts() if is_refresh else self.puller.sync_block_headers()
		asyncio.run(operation)

		# Assert: logs identify the error without exposing its MESSAGE or DETAIL, and DELETE rolled back.
		self.assertEqual(
			['Symbol account snapshot retention failed after successful workflow: error_type=DataException sqlstate=22000'],
			self.cleanup_logger.messages)
		messages = self.cleanup_logger.messages + self.retention_logger.messages
		self.assertTrue(all('account-message-sentinel' not in message and 'account-detail-sentinel' not in message for message in messages))
		cursor.execute("SELECT count(*) FROM symbol_account_list_ranks WHERE refresh_run_id = 'b-target'")
		self.assertEqual((5,), cursor.fetchone())
		state = database.get_account_refresh_state()
		if is_refresh:
			self.assertEqual(('z-published', None, 'healthy'), (
				state['previous_successful_run_id'], state['running_run_id'], state['status']))
			self.assertNotEqual('z-published', state['last_successful_run_id'])
		else:
			self.assertEqual(('z-published', 'z-previous', None, 'healthy'), (
				state['last_successful_run_id'], state['previous_successful_run_id'], state['running_run_id'], state['status']))
			self.assertEqual('healthy', database.get_sync_state()['status'])

		# Act: remove the fault and reacquire workflow exclusion on the same connection.
		cursor.execute('DROP TRIGGER retention_sensitive_error ON symbol_account_list_ranks')
		cursor.execute('DROP FUNCTION retention_sensitive_error()')
		database.connection.commit()
		with database.workflow_lock():
			database.prune_account_refresh_generations()

		# Assert: retry removes the failed generation without changing the successful publication.
		cursor.execute("SELECT count(*) FROM symbol_account_list_ranks WHERE refresh_run_id = 'b-target'")
		self.assertEqual((0,), cursor.fetchone())
		self.assertEqual(state['last_successful_run_id'], database.get_account_refresh_state()['last_successful_run_id'])

	def test_refresh_redacts_retention_database_error(self):
		self._assert_workflow_redacts_database_error(True)

	def test_sync_redacts_retention_database_error(self):
		self._assert_workflow_redacts_database_error(False)

	def test_refresh_keeps_publication_when_retention_error_logging_fails(self):
		# Arrange: a real DELETE fails and the retention error logger itself also fails.
		database = self._seed_generations(5)
		set_symbol_connector(self.puller, FakeConnector(1, {}, account_pages={1: []}))
		self._create_sensitive_error_trigger(database)
		self.cleanup_logger.messages.clear()

		# Act: publish successfully and encounter both the database and logging failures.
		self.cleanup_logger.logging_error = RuntimeError('logging failure')
		asyncio.run(self.puller.refresh_accounts())

		# Assert: the public workflow still succeeds and its publication remains active.
		self.assertEqual(
			['Symbol account snapshot retention failed after successful workflow: error_type=DataException sqlstate=22000'],
			self.cleanup_logger.messages)
		state = database.get_account_refresh_state()
		self.assertEqual(('z-published', None, 'healthy'), (
			state['previous_successful_run_id'], state['running_run_id'], state['status']))
		self.assertNotEqual('z-published', state['last_successful_run_id'])
		cursor = database.connection.cursor()
		cursor.execute("SELECT count(*) FROM symbol_account_list_ranks WHERE refresh_run_id = 'b-target'")
		self.assertEqual((5,), cursor.fetchone())

		# Act: remove the fault and resume cleanup on the same connection.
		cursor.execute('DROP TRIGGER retention_sensitive_error ON symbol_account_list_ranks')
		cursor.execute('DROP FUNCTION retention_sensitive_error()')
		database.connection.commit()
		self.cleanup_logger.logging_error = None
		with database.workflow_lock():
			database.prune_account_refresh_generations()

		# Assert: cleanup resumes without reverting the published ID.
		cursor.execute("SELECT count(*) FROM symbol_account_list_ranks WHERE refresh_run_id = 'b-target'")
		self.assertEqual((0,), cursor.fetchone())
		self.assertEqual(state['last_successful_run_id'], database.get_account_refresh_state()['last_successful_run_id'])

	def test_delete_timeout_stops_when_remaining_budget_cannot_retry(self):
		# Arrange: stop a real DELETE on a non-locking flag before its statement timeout.
		self._set_retention_time_budget(60)
		database = self._seed_generations(5000)
		database.retention_config = AccountRetentionConfiguration(5000, 200)
		self._create_statement_delay(database, 2500, delay_seconds=5.5)
		gate = self.exit_stack.enter_context(AccountRetentionReleaseGate(database, self.db_config, 'b-target'))
		self.retention_logger.clear()
		errors = []

		def cleanup():
			try:
				with database.workflow_lock():
					database.prune_account_refresh_generations()
			except Exception as error:  # pylint: disable=broad-exception-caught
				errors.append(error)

		worker = threading.Thread(target=cleanup, daemon=True)
		try:
			# Act: advance the injected clock while DELETE is active, then let PostgreSQL time out.
			worker.start()
			gate.wait_for_worker_sleep(database.connection.get_backend_pid())
			self.retention_clock.value = 59.9
			gate.release()
			worker.join(timeout=15)
		finally:
			gate.stop_worker(worker, database.connection)

		# Assert: the SQL timed out, rolled back, and the remaining budget prevented another attempt.
		self.assertFalse(worker.is_alive())
		self.assertEqual([], errors)
		messages = self.retention_logger.messages
		self.assertTrue(any('reason=statement_timeout' in message and 'stop_reason=deadline' in message for message in messages))
		self.assertFalse(any('next_batch_size=' in message for message in messages))
		cursor = database.connection.cursor()
		cursor.execute("SELECT count(*) FROM symbol_account_list_ranks WHERE refresh_run_id = 'b-target'")
		self.assertEqual((5000,), cursor.fetchone())
		self._assert_protected_and_timeout_reset(database)

		# Act: a separate session reacquires the lock and resumes after the slow condition is removed.
		cursor.execute('UPDATE retention_statement_threshold SET size = 999999')
		database.connection.commit()
		with gate.observer.workflow_lock():
			gate.observer.prune_account_refresh_generations()

		# Assert: the later pass completes and the protected rows remain.
		cursor.execute("SELECT count(*) FROM symbol_account_list_ranks WHERE refresh_run_id = 'b-target'")
		self.assertEqual((0,), cursor.fetchone())
		self._assert_protected_and_timeout_reset(database)

	def test_state_read_timeout_stops_without_reducing_batch(self):
		# Arrange: a view delays the state SELECT itself, before candidate selection or DELETE.
		database = self._seed_generations(5)
		database.retention_config = AccountRetentionConfiguration(4000, 300)
		cursor = database.connection.cursor()
		cursor.execute('ALTER TABLE symbol_account_refresh_state RENAME TO retention_state_base')
		cursor.execute('CREATE SEQUENCE retention_state_timeout_ms_seq')
		cursor.execute('''
			CREATE FUNCTION retention_slow_state(value varchar) RETURNS varchar LANGUAGE plpgsql AS $$
			BEGIN
				PERFORM setval('retention_state_timeout_ms_seq',
					(extract(epoch FROM current_setting('statement_timeout')::interval) * 1000)::bigint, true);
				PERFORM pg_sleep(2.0);
				RETURN value;
			END $$
		''')
		cursor.execute('''
			CREATE VIEW symbol_account_refresh_state AS
			SELECT id, retention_slow_state(last_successful_run_id) AS last_successful_run_id,
				previous_successful_run_id, running_run_id, is_retention_ready
			FROM retention_state_base
		''')
		database.connection.commit()
		is_restored = [False]

		def restore_state_table():
			if is_restored[0]:
				return

			database.connection.rollback()
			with database.connection.cursor() as restore_cursor:
				restore_cursor.execute('DROP VIEW IF EXISTS symbol_account_refresh_state')
				restore_cursor.execute('ALTER TABLE retention_state_base RENAME TO symbol_account_refresh_state')
				restore_cursor.execute('DROP FUNCTION IF EXISTS retention_slow_state(varchar)')
				restore_cursor.execute('DROP SEQUENCE IF EXISTS retention_state_timeout_ms_seq')

			database.connection.commit()
			is_restored[0] = True

		self.addCleanup(restore_state_table)

		self.retention_logger.clear()
		self.retention_clock.use_readings([0, 3.25])
		# Act: the SELECT times out after its 1750ms remaining-budget cap; no lock gate is involved.
		with database.workflow_lock():
			database.prune_account_refresh_generations()

		# Assert: state-query timeout terminates the pass without an attempted shrink or DELETE.
		messages = self.retention_logger.messages
		self.assertTrue(any('reason=statement_timeout' in message and 'stop_reason=non_delete' in message for message in messages))
		self.assertFalse(any('next_batch_size=' in message for message in messages))
		cursor.execute('SELECT last_value FROM retention_state_timeout_ms_seq')
		self.assertEqual((1750,), cursor.fetchone())
		cursor.execute("SELECT count(*) FROM symbol_account_list_ranks WHERE refresh_run_id = 'b-target'")
		self.assertEqual((5,), cursor.fetchone())

		# Act: restore the normal state relation, then retry on the same DB connection.
		restore_state_table()
		self._assert_protected_and_timeout_reset(database)
		with database.workflow_lock():
			database.prune_account_refresh_generations()

		# Assert: the pending generation was removed and protected rows remain.
		cursor.execute("SELECT count(*) FROM symbol_account_list_ranks WHERE refresh_run_id = 'b-target'")
		self.assertEqual((0,), cursor.fetchone())
		self._assert_protected_and_timeout_reset(database)

	def test_cleanup_caps_timeouts_to_remaining_budget_and_resets_them(self):
		# Arrange: record PostgreSQL's actual GUC values while the retention DELETE executes.
		database = self._seed_generations(5)
		database.retention_config = AccountRetentionConfiguration(4000, 300)
		cursor = database.connection.cursor()
		cursor.execute('CREATE TABLE retention_guc_audit (statement_ms int, lock_ms int)')
		cursor.execute('''
			CREATE FUNCTION retention_capture_gucs() RETURNS trigger LANGUAGE plpgsql AS $$
			BEGIN
				INSERT INTO retention_guc_audit VALUES (
					(extract(epoch FROM current_setting('statement_timeout')::interval) * 1000)::int,
					(extract(epoch FROM current_setting('lock_timeout')::interval) * 1000)::int
				);
				RETURN NULL;
			END $$
		''')
		cursor.execute('''
			CREATE TRIGGER retention_capture_gucs AFTER DELETE ON symbol_account_list_ranks
			FOR EACH STATEMENT EXECUTE FUNCTION retention_capture_gucs()
		''')
		database.connection.commit()

		# Act: a 4000ms statement is capped to one third of the injected five-second budget.
		with database.workflow_lock():
			database.prune_account_refresh_generations()

		# Assert: the in-transaction setting is capped; both GUCs return to normal after commit.
		cursor.execute('SELECT statement_ms, lock_ms FROM retention_guc_audit')
		statement_ms, lock_ms = cursor.fetchone()
		self.assertEqual(1666, statement_ms)
		self.assertEqual(300, lock_ms)
		cursor.execute("SELECT count(*) FROM symbol_account_list_ranks WHERE refresh_run_id = 'b-target'")
		self.assertEqual((0,), cursor.fetchone())
		self._assert_protected_and_timeout_reset(database)

		# Arrange: leave 1500ms; one third is below the configured 1000ms lock timeout.
		database.retention_config = AccountRetentionConfiguration(4000, 1000)
		self.retention_clock.use_readings([0, 3.5, 3.5, 3.5])
		cursor.execute('DELETE FROM retention_guc_audit')
		cursor.execute('''
			INSERT INTO symbol_account_list_ranks (refresh_run_id, rank_scope, rank, address)
			VALUES ('b-target', 'ID', 0, %s)
		''', (bytes([42]) * 24,))
		database.connection.commit()

		# Act: observe the timeout while an actual DELETE executes.
		with database.workflow_lock():
			database.prune_account_refresh_generations(max_batches=1)

		# Assert: the statement timeout is exactly one millisecond above the maximum lock timeout.
		cursor.execute('SELECT statement_ms, lock_ms FROM retention_guc_audit')
		self.assertEqual((1001, 1000), cursor.fetchone())
		self._assert_protected_and_timeout_reset(database)

	def test_minimum_delete_timeout_is_capped_by_remaining_budget(self):
		# Arrange: a 500-row batch observes the remaining budget inside its real DELETE trigger.
		database = self._seed_generations(5)
		database.retention_config = AccountRetentionConfiguration(4000, 300)
		cursor = database.connection.cursor()
		cursor.execute("DELETE FROM symbol_account_list_ranks WHERE refresh_run_id = 'b-target'")
		cursor.execute('''
			INSERT INTO symbol_account_list_ranks (refresh_run_id, rank_scope, rank, address)
			SELECT 'b-target', 'ID', n, decode(lpad(to_hex(n), 48, '0'), 'hex') FROM generate_series(1,500) n
		''')
		cursor.execute('CREATE TABLE retention_minimum_delete_guc_audit (statement_ms int, lock_ms int)')
		cursor.execute('''
			CREATE FUNCTION retention_capture_minimum_delete_gucs() RETURNS trigger LANGUAGE plpgsql AS $$
			BEGIN
				INSERT INTO retention_minimum_delete_guc_audit VALUES (
					(extract(epoch FROM current_setting('statement_timeout')::interval) * 1000)::int,
					(extract(epoch FROM current_setting('lock_timeout')::interval) * 1000)::int
				);
				RETURN NULL;
			END $$
		''')
		cursor.execute('''
			CREATE TRIGGER retention_capture_minimum_delete_gucs AFTER DELETE ON symbol_account_list_ranks
			FOR EACH STATEMENT EXECUTE FUNCTION retention_capture_minimum_delete_gucs()
		''')
		database.connection.commit()
		self.retention_clock.use_readings([0, 0, 0, 3.25])

		# Act: leave 1750ms for the 500-row DELETE under a 4000ms configured timeout.
		with database.workflow_lock():
			database.prune_account_refresh_generations(batch_size=500, max_batches=1)

		# Assert: PostgreSQL observed the capped GUC during DELETE, then transaction-local settings reset.
		cursor.execute('SELECT statement_ms, lock_ms FROM retention_minimum_delete_guc_audit')
		self.assertEqual((1750, 300), cursor.fetchone())
		cursor.execute("SELECT count(*) FROM symbol_account_list_ranks WHERE refresh_run_id = 'b-target'")
		self.assertEqual((0,), cursor.fetchone())
		self._assert_protected_and_timeout_reset(database)

	def test_cleanup_stops_before_delete_when_candidate_search_exhausts_budget(self):
		# Arrange: the injected clock leaves less than the lock timeout after candidate search.
		database = self._seed_generations(5)
		database.retention_config = AccountRetentionConfiguration(1200, 1000)
		self.retention_logger.clear()
		self.retention_clock.use_readings([0, 0, 0, 4.3])

		# Act: candidate selection completes, but insufficient time remains to start DELETE.
		with database.workflow_lock():
			database.prune_account_refresh_generations()

		# Assert: no deletion occurs and the runtime deadline is a normal stop, not a configuration error.
		self.assertTrue(any('reason=deadline' in message for message in self.retention_logger.messages))
		cursor = database.connection.cursor()
		cursor.execute("SELECT count(*) FROM symbol_account_list_ranks WHERE refresh_run_id = 'b-target'")
		self.assertEqual((5,), cursor.fetchone())
		self._assert_protected_and_timeout_reset(database)

		# Act: a new workflow pass completes the postponed cleanup.
		self.retention_clock.use_readings([0])
		with database.workflow_lock():
			database.prune_account_refresh_generations()

		# Assert: the eligible generation is removed while protected state is unchanged.
		cursor.execute("SELECT count(*) FROM symbol_account_list_ranks WHERE refresh_run_id = 'b-target'")
		self.assertEqual((0,), cursor.fetchone())
		self._assert_protected_and_timeout_reset(database)

	def test_cleanup_stops_when_runtime_budget_expires_during_delete(self):
		# Arrange: use constructor-injected readings to expire after the real DELETE completes.
		database = self._seed_generations(5)
		database.retention_config = AccountRetentionConfiguration(2000, 200)
		self.retention_logger.clear()
		self.retention_clock.use_readings([0, 0, 0, 0, 6])

		# Act: the injected deadline is observed after DELETE, forcing a transaction rollback.
		with database.workflow_lock():
			database.prune_account_refresh_generations()

		# Assert: timeout reaches the deadline, rolls back, and leaves session GUCs reset.
		self.assertTrue(any('reason=deadline' in message for message in self.retention_logger.messages))
		cursor = database.connection.cursor()
		cursor.execute("SELECT count(*) FROM symbol_account_list_ranks WHERE refresh_run_id = 'b-target'")
		self.assertEqual((5,), cursor.fetchone())
		self._assert_protected_and_timeout_reset(database)

		# Act: the pending deletion is retried with a fresh injected budget.
		self.retention_clock.use_readings([0])
		with database.workflow_lock():
			database.prune_account_refresh_generations()

		# Assert: the postponed generation is collected while protected rows remain.
		cursor.execute("SELECT count(*) FROM symbol_account_list_ranks WHERE refresh_run_id = 'b-target'")
		self.assertEqual((0,), cursor.fetchone())
		self._assert_protected_and_timeout_reset(database)

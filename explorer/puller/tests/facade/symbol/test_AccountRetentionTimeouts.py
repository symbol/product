"""Integration tests for partially committed account retention passes."""
import asyncio
import threading

from common.tests.AccountRefreshTestUtils import seed_account_refresh_state

from puller.db.AccountRetentionConfiguration import AccountRetentionConfiguration

from .account_retention_test_utils import (
	AccountRetentionDeleteGate,
	AccountRetentionReleaseGate,
	ManualRetentionClock,
	RecordingRetentionLogger
)
from .puller_test_utils import FakeConnector, SymbolPullerTestBase, create_node_block, set_symbol_connector


class AccountRetentionTimeoutsTest(SymbolPullerTestBase):
	def setUp(self):
		self.retention_clock = ManualRetentionClock()
		self.retention_logger = RecordingRetentionLogger()
		self.retention_time_source = self.retention_clock.monotonic
		self.cleanup_logger = self.retention_logger
		super().setUp()

	def _seed_rows(self):
		database = self.puller.symbol_db
		seed_account_refresh_state(database, {
			'last_successful_run_id': 'z-published', 'previous_successful_run_id': 'z-previous',
			'running_run_id': 'z-running', 'is_retention_ready': True, 'status': 'healthy'
		})
		cursor = database.connection.cursor()
		for index, run_id in enumerate(('a-old', 'b-old', 'z-published', 'z-previous', 'z-running')):
			address = bytes([index + 1]) * 24
			cursor.execute('''
				INSERT INTO symbol_account_list_ranks (refresh_run_id, rank_scope, rank, address)
				VALUES (%s, 'ID', 0, %s)
			''', (run_id, address))
			if run_id.startswith('z-'):
				cursor.execute('''
					INSERT INTO symbol_account_refresh_accounts
					(refresh_run_id, address, address_text, account_search_order, importance, snapshot_height, snapshot_at)
					VALUES (%s, %s, %s, 0, 1, 1, CURRENT_TIMESTAMP)
				''', (run_id, address, run_id))
				cursor.execute('''
					INSERT INTO symbol_account_refresh_mosaics
					(refresh_run_id, address, mosaic_id, amount, snapshot_height, snapshot_at)
					VALUES (%s, %s, '1', 1, 1, CURRENT_TIMESTAMP)
				''', (run_id, address))

		database.connection.commit()
		return database

	def _seed_rows_and_gate(self):
		database = self._seed_rows()
		return self.exit_stack.enter_context(AccountRetentionDeleteGate(database, self.db_config, 'b-old'))

	def _assert_rollback_and_retry_completes_on_another_connection(self, gate, protected, retained_before):
		# Assert: the second DELETE rolled back, and every protected row is intact.
		cursor = gate.observer.connection.cursor()
		cursor.execute('SELECT refresh_run_id FROM symbol_account_list_ranks ORDER BY refresh_run_id')
		self.assertEqual([('b-old',), *[(run_id,) for run_id in retained_before]], cursor.fetchall())
		cursor.execute('SELECT attempts FROM retention_test_gate_state')
		self.assertEqual((0,), cursor.fetchone())
		for table in ('symbol_account_refresh_accounts', 'symbol_account_refresh_mosaics'):
			cursor.execute(f'SELECT refresh_run_id FROM {table} ORDER BY refresh_run_id')
			self.assertEqual([(run_id,) for run_id in retained_before], cursor.fetchall())

		gate.observer.connection.commit()

		# Act: a separate connection acquires the lock and resumes cleanup.
		with gate.observer.workflow_lock():
			gate.observer.prune_account_refresh_generations()

		# Assert: cleanup completed without deleting protected data.
		cursor.execute('SELECT refresh_run_id FROM symbol_account_list_ranks ORDER BY refresh_run_id')
		self.assertEqual([(run_id,) for run_id in protected], cursor.fetchall())
		for table in ('symbol_account_refresh_accounts', 'symbol_account_refresh_mosaics'):
			cursor.execute(f'SELECT refresh_run_id FROM {table} ORDER BY refresh_run_id')
			self.assertEqual([(run_id,) for run_id in protected], cursor.fetchall())

		gate.observer.connection.commit()

	def test_deadline_rolls_back_inflight_delete_and_retries(self):
		# Arrange: commit the first old generation, then wait inside the second DELETE without a lock gate.
		self._set_retention_time_budget(60)
		database = self._seed_rows()
		database.retention_config = AccountRetentionConfiguration(30000, 200)
		with database.workflow_lock():
			database.prune_account_refresh_generations(max_batches=1)

		gate = self.exit_stack.enter_context(AccountRetentionReleaseGate(database, self.db_config, 'b-old'))
		worker_errors = []

		def cleanup():
			try:
				with database.workflow_lock():
					database.prune_account_refresh_generations(max_batches=1)
			except Exception as error:  # pylint: disable=broad-exception-caught
				worker_errors.append(error)

		worker = threading.Thread(target=cleanup, daemon=True)
		try:
			worker.start()
			gate.wait_for_worker_sleep(database.connection.get_backend_pid())
			cursor = gate.observer.connection.cursor()
			cursor.execute("SELECT count(*) FROM symbol_account_list_ranks WHERE refresh_run_id = 'a-old'")
			self.assertEqual((0,), cursor.fetchone())
			gate.observer.connection.commit()

			# Act: expire the injected budget while DELETE is active, then release the flag gate.
			self.retention_clock.value = 61
			gate.release()
			worker.join(timeout=10)
		finally:
			gate.stop_worker(worker, database.connection)

		# Assert: the active DELETE rolled back for deadline, not lock timeout.
		self.assertFalse(worker.is_alive())
		self.assertEqual([], worker_errors)
		self.assertTrue(any('reason=deadline' in message for message in self.retention_logger.messages))
		self.assertFalse(any('reason=lock_timeout' in message for message in self.retention_logger.messages))
		state = database.get_account_refresh_state()
		self.assertEqual(('z-published', 'z-previous', 'z-running'), (
			state['last_successful_run_id'], state['previous_successful_run_id'], state['running_run_id']))
		protected = ('z-previous', 'z-published', 'z-running')
		cursor = database.connection.cursor()
		cursor.execute('SELECT refresh_run_id FROM symbol_account_list_ranks ORDER BY refresh_run_id')
		self.assertEqual([('b-old',), *[(run_id,) for run_id in protected]], cursor.fetchall())

		# Act: retry from the observer connection after restoring a non-expired injected clock.
		self.retention_clock.value = 0
		with gate.observer.workflow_lock():
			gate.observer.prune_account_refresh_generations()

		# Assert: the remaining old generation is deleted and all protected rows remain.
		cursor.execute('SELECT refresh_run_id FROM symbol_account_list_ranks ORDER BY refresh_run_id')
		self.assertEqual([(run_id,) for run_id in protected], cursor.fetchall())
		for table in ('symbol_account_refresh_accounts', 'symbol_account_refresh_mosaics'):
			cursor.execute(f'SELECT refresh_run_id FROM {table} ORDER BY refresh_run_id')
			self.assertEqual([(run_id,) for run_id in protected], cursor.fetchall())

	def _assert_workflow_survives_lock_timeout(self, is_refresh):
		# Arrange: use the actual workflow entrypoint and stall the second cleanup DELETE on a lock.
		gate = self._seed_rows_and_gate()
		database = self.puller.symbol_db
		database.retention_config = AccountRetentionConfiguration(2000, 1000)
		if is_refresh:
			set_symbol_connector(self.puller, FakeConnector(1, {}, account_pages={1: []}))
		else:
			seed_account_refresh_state(database, {'running_run_id': None})
			set_symbol_connector(self.puller, FakeConnector(1, {0: [create_node_block(1)]}))

		worker_errors = []

		def run_workflow():
			try:
				operation = self.puller.refresh_accounts() if is_refresh else self.puller.sync_block_headers()
				asyncio.run(operation)
			except Exception as error:  # pylint: disable=broad-exception-caught
				worker_errors.append(error)

		worker = threading.Thread(target=run_workflow, daemon=True)
		try:
			# Act: start the workflow and hold its second DELETE until lock timeout.
			worker.start()
			gate.wait_for_advisory_wait(database.connection.get_backend_pid())

			# Assert: the first DELETE already committed.
			cursor = gate.observer.connection.cursor()
			cursor.execute("SELECT count(*) FROM symbol_account_list_ranks WHERE refresh_run_id = 'a-old'")
			self.assertEqual((0,), cursor.fetchone())
			gate.observer.connection.commit()

			# Act: wait for the lock timeout and workflow completion.
			worker.join(timeout=10)
		finally:
			gate.stop_worker(worker, database.connection)

		# Assert: the workflow succeeded and the timeout did not leak into the session.
		self.assertFalse(worker.is_alive())
		self.assertEqual([], worker_errors)
		self.assertEqual(1, sum('reason=lock_timeout' in message for message in self.retention_logger.messages))
		self.assertFalse(any('next_batch_size=' in message for message in self.retention_logger.messages))
		state = database.get_account_refresh_state()
		if is_refresh:
			self.assertEqual(('z-published', None, 'healthy'), (
				state['previous_successful_run_id'], state['running_run_id'], state['status']))
			self.assertNotEqual('z-published', state['last_successful_run_id'])
			protected = ('z-published',)
		else:
			self.assertEqual(('z-published', 'z-previous', None), (
				state['last_successful_run_id'], state['previous_successful_run_id'], state['running_run_id']))
			self.assertEqual('healthy', database.get_sync_state()['status'])
			protected = ('z-previous', 'z-published')

		cursor = database.connection.cursor()
		cursor.execute('SHOW statement_timeout')
		self.assertEqual(('0',), cursor.fetchone())
		cursor.execute('SHOW lock_timeout')
		self.assertEqual(('0',), cursor.fetchone())
		self._assert_rollback_and_retry_completes_on_another_connection(gate, protected, ('z-previous', 'z-published', 'z-running'))

	def test_refresh_succeeds_when_retention_lock_times_out(self):
		self._assert_workflow_survives_lock_timeout(True)

	def test_sync_succeeds_when_retention_lock_times_out(self):
		self._assert_workflow_survives_lock_timeout(False)

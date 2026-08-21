import asyncio
import json

from symbolchain.sc import ReceiptType
from symbollightapi.model.Exceptions import NodeException

from puller.facade.SymbolPuller import SymbolRollbackError

from .puller_test_utils import (
	FakeConnector,
	NoOpRateLimiter,
	SymbolPullerTestBase,
	create_amount_statement_item,
	create_complete_aggregate_pair,
	create_node_block,
	create_sync_state,
	set_symbol_connector,
	set_symbol_rate_limiter,
	statement_path,
	transaction_path
)


class RecordingLogger:
	def __init__(self):
		self.messages = []

	def info(self, message):
		self.messages.append(message)


class FailingLogger:
	def info(self, message):  # pylint: disable=unused-argument,no-self-use
		raise RuntimeError('performance logger failed')


class RetryOnceTransactionConnector(FakeConnector):
	def __init__(self, *args, **kwargs):
		super().__init__(*args, **kwargs)
		self.transaction_attempt_count = 0

	async def get(self, url_path, *args):
		if url_path.startswith('transactions/confirmed?'):
			self.transaction_attempt_count += 1
			if 1 == self.transaction_attempt_count:
				self.paths.append(url_path)
				raise NodeException('retry-only test error')

		return await super().get(url_path, *args)


class FailingSecondBatchConnector(FakeConnector):
	async def get(self, url_path, *args):
		if url_path.startswith('blocks?pageSize=100&offset=1000'):
			self.paths.append(url_path)
			raise ValueError('second batch block fetch failed')

		return await super().get(url_path, *args)


class FailingChainInfoConnector(FakeConnector):
	def __init__(self, *args, **kwargs):
		super().__init__(*args, **kwargs)
		self.failure = ValueError('chain info fetch failed')

	async def get(self, url_path, *args):
		if 'chain/info' == url_path:
			self.paths.append(url_path)
			raise self.failure

		return await super().get(url_path, *args)


class FailingSyncStateDatabase:
	def __init__(self, database, failure):
		self.database = database
		self.failure = failure

	def __getattr__(self, name):
		return getattr(self.database, name)

	def upsert_sync_state(self, sync_state):
		if 'healthy' == sync_state['status']:
			raise self.failure

		return self.database.upsert_sync_state(sync_state)


class FailingFinalizationDatabase:
	def __init__(self, database, failure):
		self.database = database
		self.failure = failure

	def __getattr__(self, name):
		return getattr(self.database, name)

	def apply_finalization_lock_entries(self, hash_lock_entries, secret_lock_entries):  # pylint: disable=unused-argument
		raise self.failure


class FailingPerformance:
	def __init__(self):
		self.call_count = 0

	def record_request_attempt(self, method, category):  # pylint: disable=unused-argument
		self.call_count += 1
		raise RuntimeError('performance recorder failed')


class FailingEventPerformance:
	def __init__(self):
		self.call_count = 0

	def event(self, event_name, status, exception=None):  # pylint: disable=unused-argument
		self.call_count += 1
		raise RuntimeError('performance event failed')


class SymbolPullerPerformanceTest(SymbolPullerTestBase):
	def _run_sync(self, connector, performance_logger=None):
		# Arrange:
		logger = performance_logger or RecordingLogger()
		self.puller._performance_logger = logger  # pylint: disable=protected-access
		set_symbol_connector(self.puller, connector)
		set_symbol_rate_limiter(self.puller, NoOpRateLimiter())

		# Act:
		asyncio.run(self.puller.sync_block_headers())

		# Assert:
		return [json.loads(message) for message in logger.messages]

	def test_sync_block_headers_logs_one_completed_batch_and_workflow_event(self):
		# Arrange:
		connector = FakeConnector(1, {0: [create_node_block(1)]})

		# Act:
		events = self._run_sync(connector)

		# Assert:
		self.assertEqual(2, len(events))
		batch_event, workflow_event = events
		self.assertEqual('symbol_sync_batch_completed', batch_event['event'])
		self.assertEqual('completed', batch_event['status'])
		self.assertEqual(1, batch_event['start_height'])
		self.assertEqual(1, batch_event['end_height'])
		self.assertEqual(1, batch_event['block_count'])
		self.assertEqual(0, batch_event['transaction_count'])
		self.assertEqual(0, batch_event['receipt_count'])
		self.assertEqual(1, batch_event['dirty_account_count'])
		self.assertEqual(0, batch_event['dirty_namespace_count'])
		self.assertEqual(0, batch_event['dirty_mosaic_count'])
		self.assertEqual(0, batch_event['dirty_metadata_count'])
		self.assertEqual(0, batch_event['dirty_hash_lock_count'])
		self.assertEqual(0, batch_event['dirty_secret_lock_count'])
		self.assertEqual(0, batch_event['dirty_mosaic_restriction_count'])
		self.assertEqual(4, batch_event['http_get_attempt_count'])
		self.assertEqual(1, batch_event['http_post_attempt_count'])
		self.assertEqual(5, batch_event['http_attempt_count'])
		self.assertEqual(4, batch_event['http_success_count'])
		self.assertEqual(0, batch_event['http_retry_count'])
		self.assertEqual(0, batch_event['rate_limit_wait_ms'])
		self.assertEqual(7, batch_event['db_commit_count'])
		self.assertEqual(7, batch_event['db_commit_attempt_count'])
		self.assertIsNone(batch_event['failed_phase'])
		self.assertEqual('completed', workflow_event['status'])
		self.assertEqual(1, workflow_event['batch_count'])
		self.assertEqual(1, workflow_event['block_count'])
		self.assertEqual(8, workflow_event['http_attempt_count'])
		self.assertEqual(9, workflow_event['db_commit_count'])
		self.assertIsNone(workflow_event['failed_phase'])
		self.assertEqual(batch_event['http_attempt_count'] + 3, workflow_event['http_attempt_count'])
		self.assertEqual(batch_event['db_commit_count'] + 2, workflow_event['db_commit_count'])
		self.assertGreater(workflow_event['http_attempt_count'], batch_event['http_attempt_count'])
		self.assertGreater(workflow_event['db_commit_count'], batch_event['db_commit_count'])

	def test_sync_block_headers_logs_actual_range_for_partial_final_batch(self):
		# Arrange:
		connector = FakeConnector(2, {
			0: [create_node_block(1), create_node_block(2)]
		})

		# Act:
		batch_event = self._run_sync(connector)[0]

		# Assert:
		self.assertEqual(1, batch_event['start_height'])
		self.assertEqual(2, batch_event['end_height'])
		self.assertEqual(2, batch_event['block_count'])

	def test_sync_block_headers_reports_existing_height_when_no_new_batch_is_needed(self):
		# Arrange:
		self._seed_blocks(self.puller.symbol_db, [1])
		self.puller.symbol_db.upsert_sync_state(create_sync_state(chain_height=1, last_synced_height=1))
		connector = FakeConnector(1, {})

		# Act:
		events = self._run_sync(connector)

		# Assert:
		self.assertEqual(1, len(events))
		self.assertEqual('symbol_sync_completed', events[0]['event'])
		self.assertEqual(0, events[0]['batch_count'])
		self.assertEqual(1, events[0]['last_completed_height'])
		self.assertEqual(3, events[0]['http_attempt_count'])
		self.assertEqual(2, events[0]['db_commit_count'])
		self.assertIsNone(events[0]['failed_phase'])

	def test_sync_block_headers_counts_embedded_transactions_and_receipt_rows(self):
		# Arrange:
		transactions = create_complete_aggregate_pair(1, 'A' * 64, 0)
		connector = FakeConnector(
			1,
			{0: [create_node_block(1)]},
			transactions_by_path={transaction_path(1, 1): {'data': transactions}},
			statement_pages={statement_path(1, 1): {
				'data': [create_amount_statement_item(1, 11, ReceiptType.INFLATION.value, 'receipt-1')]
			}}
		)

		# Act:
		batch_event = self._run_sync(connector)[0]

		# Assert:
		self.assertEqual(2, batch_event['transaction_count'])
		self.assertEqual(1, batch_event['receipt_count'])

	def test_sync_block_headers_counts_retry_as_an_attempt_without_counting_initial_try_as_retry(self):
		# Arrange:
		connector = RetryOnceTransactionConnector(1, {0: [create_node_block(1)]})
		self.puller._retry_delay = 0  # pylint: disable=protected-access

		# Act:
		batch_event = self._run_sync(connector)[0]

		# Assert:
		self.assertEqual(6, batch_event['http_attempt_count'])
		self.assertEqual(5, batch_event['http_get_attempt_count'])
		self.assertEqual(1, batch_event['http_post_attempt_count'])
		self.assertEqual(1, batch_event['http_retry_count'])
		self.assertEqual(4, batch_event['http_success_count'])
		self.assertEqual(2, batch_event['http_get_attempts_by_category']['confirmed_transaction'])
		self.assertEqual(0, batch_event['rate_limit_wait_ms'])

	def test_sync_block_headers_sums_multiple_batch_events_in_workflow_event(self):
		# Arrange:
		blocks = [create_node_block(height) for height in range(1, 1002)]
		pages = {offset: blocks[offset:offset + 100] for offset in range(0, 1001, 100)}
		connector = FakeConnector(1001, pages)

		# Act:
		events = self._run_sync(connector)

		# Assert:
		batch_events = events[:2]
		workflow_event = events[2]
		self.assertEqual(2, len(batch_events))
		self.assertEqual(1000, batch_events[0]['block_count'])
		self.assertEqual(1, batch_events[1]['block_count'])
		self.assertEqual(2, workflow_event['batch_count'])
		self.assertEqual(1001, workflow_event['block_count'])
		self.assertEqual(
			sum(event['http_attempt_count'] for event in batch_events),
			workflow_event['http_attempt_count'] - 3)
		self.assertEqual(
			sum(event['db_commit_count'] for event in batch_events),
			workflow_event['db_commit_count'] - 2)
		self.assertEqual(22, workflow_event['http_attempt_count'])
		self.assertEqual(2014, workflow_event['db_commit_count'])
		self.assertIsNone(workflow_event['failed_phase'])
		self.assertEqual(1001, workflow_event['last_completed_height'])

	def test_sync_block_headers_records_last_completed_height_when_a_later_batch_fails(self):
		# Arrange:
		blocks = [create_node_block(height) for height in range(1, 1002)]
		pages = {offset: blocks[offset:offset + 100] for offset in range(0, 1001, 100)}
		connector = FailingSecondBatchConnector(1001, pages)
		logger = RecordingLogger()
		set_symbol_connector(self.puller, connector)
		set_symbol_rate_limiter(self.puller, NoOpRateLimiter())
		self.puller._performance_logger = logger  # pylint: disable=protected-access

		# Act:
		with self.assertRaisesRegex(ValueError, 'second batch block fetch failed'):
			asyncio.run(self.puller.sync_block_headers())

		# Assert:
		events = [json.loads(message) for message in logger.messages]
		self.assertEqual(3, len(events))
		self.assertEqual('symbol_sync_batch_completed', events[0]['event'])
		self.assertEqual('symbol_sync_batch_failed', events[1]['event'])
		self.assertEqual('block_fetch', events[1]['failed_phase'])
		self.assertIsNone(events[0]['failed_phase'])
		self.assertEqual('symbol_sync_failed', events[2]['event'])
		self.assertEqual(1000, events[2]['last_completed_height'])
		self.assertEqual('block_fetch', events[2]['failed_phase'])
		self.assertEqual(
			sum(event['http_attempt_count'] for event in events[:2]) + 3,
			events[2]['http_attempt_count'])
		self.assertEqual(
			sum(event['db_commit_count'] for event in events[:2]) + 1,
			events[2]['db_commit_count'])

	def test_sync_block_headers_logs_failed_phase_and_preserves_original_exception(self):
		# Arrange:
		expected_exception = ValueError('transaction fetch failed')
		connector = FakeConnector(
			1,
			{0: [create_node_block(1)]},
			transactions_by_path={transaction_path(1, 1): expected_exception})
		logger = RecordingLogger()

		# Act:
		set_symbol_connector(self.puller, connector)
		set_symbol_rate_limiter(self.puller, NoOpRateLimiter())
		self.puller._performance_logger = logger  # pylint: disable=protected-access
		with self.assertRaisesRegex(ValueError, 'transaction fetch failed') as exception_context:
			asyncio.run(self.puller.sync_block_headers())

		# Assert:
		self.assertIs(expected_exception, exception_context.exception)
		events = [json.loads(message) for message in logger.messages]
		self.assertEqual(2, len(events))
		self.assertEqual('symbol_sync_batch_failed', events[0]['event'])
		self.assertEqual('failed', events[0]['status'])
		self.assertEqual('transaction_fetch', events[0]['failed_phase'])
		self.assertEqual('ValueError', events[0]['exception_class'])
		self.assertEqual(1, events[0]['block_count'])
		self.assertEqual('symbol_sync_failed', events[1]['event'])
		self.assertIsNone(events[1]['last_completed_height'])
		self.assertEqual('transaction_fetch', events[1]['failed_phase'])

	def test_sync_block_headers_does_not_replace_original_exception_when_logging_fails(self):
		# Arrange:
		expected_exception = ValueError('transaction fetch failed')
		connector = FakeConnector(
			1,
			{0: [create_node_block(1)]},
			transactions_by_path={transaction_path(1, 1): expected_exception})
		set_symbol_connector(self.puller, connector)
		set_symbol_rate_limiter(self.puller, NoOpRateLimiter())
		self.puller._performance_logger = FailingLogger()  # pylint: disable=protected-access

		# Act:
		with self.assertRaisesRegex(ValueError, 'transaction fetch failed') as exception_context:
			asyncio.run(self.puller.sync_block_headers())

		# Assert:
		self.assertIs(expected_exception, exception_context.exception)

	def test_sync_block_headers_reports_chain_info_failure_phase_without_batch(self):
		# Arrange:
		expected_exception = ValueError('chain info fetch failed')
		connector = FailingChainInfoConnector(1, {})
		connector.failure = expected_exception
		logger = RecordingLogger()
		set_symbol_connector(self.puller, connector)
		set_symbol_rate_limiter(self.puller, NoOpRateLimiter())
		self.puller._performance_logger = logger  # pylint: disable=protected-access

		# Act:
		with self.assertRaisesRegex(ValueError, 'chain info fetch failed') as exception_context:
			asyncio.run(self.puller.sync_block_headers())

		# Assert:
		self.assertIs(expected_exception, exception_context.exception)
		event = json.loads(logger.messages[0])
		self.assertEqual('symbol_sync_failed', event['event'])
		self.assertEqual('failed', event['status'])
		self.assertEqual(0, event['batch_count'])
		self.assertEqual(1, event['http_attempt_count'])
		self.assertEqual('chain_info_fetch', event['failed_phase'])
		self.assertEqual('ValueError', event['exception_class'])

	def test_sync_block_headers_reports_rollback_failure_phase_without_batch(self):
		# Arrange:
		connector = FakeConnector(1, {})
		logger = RecordingLogger()
		set_symbol_connector(self.puller, connector)
		set_symbol_rate_limiter(self.puller, NoOpRateLimiter())
		self.puller._performance_logger = logger  # pylint: disable=protected-access
		self.puller.symbol_db.upsert_sync_state(create_sync_state())

		# Act:
		with self.assertRaisesRegex(SymbolRollbackError, 'Finalized block is missing from local database') as exception_context:
			asyncio.run(self.puller.sync_block_headers())

		# Assert:
		self.assertEqual('Finalized block is missing from local database', str(exception_context.exception))
		event = json.loads(logger.messages[0])
		self.assertEqual('symbol_sync_failed', event['event'])
		self.assertEqual(0, event['batch_count'])
		self.assertEqual(3, event['http_attempt_count'])
		self.assertEqual(1, event['db_commit_count'])
		self.assertEqual('rollback_repair', event['failed_phase'])

	def test_sync_block_headers_reports_finalization_cleanup_failure_phase_without_batch(self):
		# Arrange:
		expected_exception = ValueError('finalization cleanup failed')
		connector = FakeConnector(1, {})
		logger = RecordingLogger()
		set_symbol_connector(self.puller, connector)
		set_symbol_rate_limiter(self.puller, NoOpRateLimiter())
		self.puller._performance_logger = logger  # pylint: disable=protected-access
		self._seed_blocks(self.puller.symbol_db, [1])
		self.puller.symbol_db.upsert_sync_state(create_sync_state(chain_height=1, last_synced_height=1))
		self.puller.symbol_db = FailingFinalizationDatabase(self.puller.symbol_db, expected_exception)

		# Act:
		with self.assertRaisesRegex(ValueError, 'finalization cleanup failed') as exception_context:
			asyncio.run(self.puller.sync_block_headers())

		# Assert:
		self.assertIs(expected_exception, exception_context.exception)
		event = json.loads(logger.messages[0])
		self.assertEqual('symbol_sync_failed', event['event'])
		self.assertEqual(0, event['batch_count'])
		self.assertEqual(3, event['http_attempt_count'])
		self.assertEqual(0, event['db_commit_count'])
		self.assertEqual('finalization_lock_cleanup', event['failed_phase'])

	def test_sync_block_headers_reports_sync_state_write_failure_phase_after_batch(self):
		# Arrange:
		expected_exception = ValueError('sync state write failed')
		connector = FakeConnector(1, {0: [create_node_block(1)]})
		logger = RecordingLogger()
		set_symbol_connector(self.puller, connector)
		set_symbol_rate_limiter(self.puller, NoOpRateLimiter())
		self.puller._performance_logger = logger  # pylint: disable=protected-access
		self.puller.symbol_db = FailingSyncStateDatabase(self.puller.symbol_db, expected_exception)

		# Act:
		with self.assertRaisesRegex(ValueError, 'sync state write failed') as exception_context:
			asyncio.run(self.puller.sync_block_headers())

		# Assert:
		self.assertIs(expected_exception, exception_context.exception)
		events = [json.loads(message) for message in logger.messages]
		self.assertEqual(2, len(events))
		self.assertEqual('symbol_sync_batch_completed', events[0]['event'])
		self.assertIsNone(events[0]['failed_phase'])
		self.assertEqual('symbol_sync_failed', events[1]['event'])
		self.assertEqual('sync_state_write', events[1]['failed_phase'])
		self.assertEqual(1, events[1]['last_completed_height'])

	def test_performance_recording_failure_does_not_raise(self):
		# Arrange:
		performance = FailingPerformance()
		self.puller._active_performance = performance  # pylint: disable=protected-access

		# Act:
		self.puller._record_performance('record_request_attempt', 'GET', 'block')  # pylint: disable=protected-access

		# Assert:
		self.assertEqual(1, performance.call_count)

	def test_performance_event_generation_failure_does_not_raise(self):
		# Arrange:
		performance = FailingEventPerformance()
		self.puller._performance_logger = FailingLogger()  # pylint: disable=protected-access

		# Act:
		self.puller._log_performance_event(  # pylint: disable=protected-access
			performance, 'symbol_sync_failed', 'failed', ValueError('original'))

		# Assert:
		self.assertEqual(1, performance.call_count)

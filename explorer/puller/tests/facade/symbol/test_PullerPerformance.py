import asyncio
import json

from symbolchain.sc import ReceiptType, TransactionType
from symbolchain.symbol.Network import Address
from symbollightapi.model.Exceptions import NodeException

from puller.facade.SymbolPuller import SymbolRollbackError
from tests.test.SymbolLockTestUtils import create_secret_lock_item
from tests.test.SymbolMetadataTestUtils import SCOPED_METADATA_KEY, create_metadata_item, metadata_path
from tests.test.SymbolMosaicTestUtils import MOSAIC_ID, create_mosaic_item
from tests.test.SymbolNamespaceTestUtils import NAMESPACE_ROOT_ID, create_namespace_item
from tests.test.SymbolTestConstants import RECIPIENT_ADDRESS, SIGNER_ADDRESS

from .puller_test_utils import (
	DelegatingSymbolDatabase,
	FakeConnector,
	NoOpRateLimiter,
	SymbolPullerTestBase,
	create_amount_statement_item,
	create_complete_aggregate_pair,
	create_multi_batch_block_pages,
	create_node_block,
	create_node_transaction,
	create_sync_state,
	create_transaction_page,
	set_symbol_connector,
	set_symbol_rate_limiter,
	statement_path,
	transaction_path
)

BATCH_EVENT_KEYS = {
	'event', 'status', 'start_height', 'end_height', 'elapsed_ms', 'failed_phase', 'exception_class',
	'block_count', 'transaction_count', 'receipt_count', 'http_attempt_count', 'http_success_count',
	'http_retry_count', 'http_get_attempt_count', 'http_post_attempt_count', 'rate_limit_wait_ms',
	'db_commit_count', 'db_commit_attempt_count', 'block_fetch_ms', 'transaction_fetch_ms', 'receipt_fetch_ms',
	'resolution_fetch_ms', 'account_fetch_ms', 'namespace_fetch_ms', 'mosaic_fetch_ms', 'metadata_fetch_ms',
	'hash_lock_fetch_ms', 'secret_lock_fetch_ms', 'mosaic_restriction_fetch_ms', 'dirty_account_count',
	'dirty_namespace_count', 'dirty_mosaic_count', 'dirty_metadata_count', 'dirty_hash_lock_count',
	'dirty_secret_lock_count', 'dirty_mosaic_restriction_count', 'block_transaction_receipt_write_ms',
	'account_multisig_write_ms', 'current_state_write_ms', 'db_write_total_ms', 'db_commit_ms',
	'http_get_attempts_by_category', 'http_post_attempts_by_category'
}
WORKFLOW_EVENT_KEYS = {
	'event', 'status', 'start_height', 'target_height', 'last_completed_height', 'elapsed_ms', 'batch_count',
	'failed_phase', 'exception_class', 'block_count', 'transaction_count', 'receipt_count', 'http_attempt_count',
	'http_success_count', 'http_retry_count', 'http_get_attempt_count', 'http_post_attempt_count',
	'rate_limit_wait_ms', 'db_commit_count', 'db_commit_attempt_count', 'block_fetch_ms', 'transaction_fetch_ms',
	'receipt_fetch_ms', 'resolution_fetch_ms', 'account_fetch_ms', 'namespace_fetch_ms', 'mosaic_fetch_ms',
	'metadata_fetch_ms', 'hash_lock_fetch_ms', 'secret_lock_fetch_ms', 'mosaic_restriction_fetch_ms',
	'dirty_account_count', 'dirty_namespace_count', 'dirty_mosaic_count', 'dirty_metadata_count',
	'dirty_hash_lock_count', 'dirty_secret_lock_count', 'dirty_mosaic_restriction_count',
	'block_transaction_receipt_write_ms', 'account_multisig_write_ms', 'current_state_write_ms',
	'db_write_total_ms', 'db_commit_ms', 'http_get_attempts_by_category', 'http_post_attempts_by_category'
}
TIMING_FIELDS = {
	'elapsed_ms', 'block_fetch_ms', 'transaction_fetch_ms', 'receipt_fetch_ms', 'resolution_fetch_ms',
	'account_fetch_ms', 'namespace_fetch_ms', 'mosaic_fetch_ms', 'metadata_fetch_ms', 'hash_lock_fetch_ms',
	'secret_lock_fetch_ms', 'mosaic_restriction_fetch_ms', 'block_transaction_receipt_write_ms',
	'account_multisig_write_ms', 'current_state_write_ms', 'db_write_total_ms', 'db_commit_ms'
}


class RecordingLogger:
	def __init__(self):
		self.messages = []

	def info(self, message):
		self.messages.append(message)

	@property
	def events(self):
		return [json.loads(message) for message in self.messages]


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


class FailingSyncStateDatabase(DelegatingSymbolDatabase):
	def __init__(self, database, failure):
		super().__init__(database)
		self.failure = failure

	def upsert_sync_state(self, sync_state):
		if 'healthy' == sync_state['status']:
			raise self.failure

		return self.database.upsert_sync_state(sync_state)


class FailingFinalizationDatabase(DelegatingSymbolDatabase):
	def __init__(self, database, failure):
		super().__init__(database)
		self.failure = failure

	def apply_finalization_lock_entries(self, hash_lock_entries, secret_lock_entries):  # pylint: disable=unused-argument
		raise self.failure


class FailingSyncStateReadDatabase(DelegatingSymbolDatabase):
	def __init__(self, database, failure):
		super().__init__(database)
		self.failure = failure

	def get_sync_state(self):
		raise self.failure


class RetryOnceChainInfoConnector(FakeConnector):
	def __init__(self, *args, **kwargs):
		super().__init__(*args, **kwargs)
		self.chain_info_attempt_count = 0

	async def get(self, url_path, *args):
		if 'chain/info' == url_path:
			self.chain_info_attempt_count += 1
			if 1 == self.chain_info_attempt_count:
				self.paths.append(url_path)
				raise NodeException('chain info retry')

		return await super().get(url_path, *args)


class FailingPhaseConnector(FakeConnector):
	def __init__(self, failing_path, failure, *args, **kwargs):
		super().__init__(*args, **kwargs)
		self.failing_path = failing_path
		self.failure = failure

	async def get(self, url_path, *args):
		if self.failing_path == url_path:
			self.paths.append(url_path)
			raise self.failure

		return await super().get(url_path, *args)


class FixedRateLimiter:
	def __init__(self, first_wait_seconds, later_wait_seconds):
		self.first_wait_seconds = first_wait_seconds
		self.later_wait_seconds = later_wait_seconds
		self.call_count = 0

	async def wait_for_turn(self):
		self.call_count += 1
		return self.first_wait_seconds if 1 == self.call_count else self.later_wait_seconds


class ExtraResponseConnector(FakeConnector):
	def __init__(self, *args, responses=None, **kwargs):
		super().__init__(*args, **kwargs)
		self.responses = responses or {}

	async def get(self, url_path, *args):
		if url_path in self.responses:
			self.paths.append(url_path)
			return self.responses[url_path]

		return await super().get(url_path, *args)


class IncrementingClock:
	def __init__(self, step_seconds=0.001):
		self.value = 0
		self.step_seconds = step_seconds

	def __call__(self):
		value = self.value
		self.value += self.step_seconds
		return value


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


# pylint: disable=duplicate-code,too-many-lines,too-many-public-methods
class SymbolPullerPerformanceTest(SymbolPullerTestBase):
	def _run_sync(self, connector, performance_logger=None, rate_limiter=None):
		# Arrange:
		logger = performance_logger or RecordingLogger()
		self.puller._performance_logger = logger  # pylint: disable=protected-access
		set_symbol_connector(self.puller, connector)
		set_symbol_rate_limiter(self.puller, rate_limiter or NoOpRateLimiter())

		# Act:
		asyncio.run(self.puller.sync_block_headers())

		return logger.events

	def _assert_dirty_count(self, transaction, field, connector_class=FakeConnector, **connector_kwargs):
		# Arrange:
		connector = connector_class(
			1,
			{0: [create_node_block(1, transactions_count=1, total_transactions_count=1)]},
			transactions_by_path={transaction_path(1, 1): create_transaction_page([transaction])},
			**connector_kwargs)

		# Act:
		batch_event, workflow_event = self._run_sync(connector)[:2]

		# Assert:
		self.assertEqual(1, batch_event[field])
		self.assertEqual(1, workflow_event[field])

	def _assert_event_key_contract(self, event, expected_keys):
		# Act:
		actual_keys = set(event)

		# Assert:
		self.assertEqual(expected_keys, actual_keys)

	@staticmethod
	def _without_timing_fields(event):
		return {key: value for key, value in event.items() if key not in TIMING_FIELDS}

	@staticmethod
	def _expected_http_categories(**overrides):
		categories = {
			'block': 0,
			'confirmed_transaction': 0,
			'transaction_statement': 0,
			'address_resolution': 0,
			'mosaic_resolution': 0,
			'account_batch': 0,
			'account_multisig': 0,
			'namespace_detail': 0,
			'namespace_name': 0,
			'mosaic_batch': 0,
			'metadata_search': 0,
			'hash_lock': 0,
			'secret_lock': 0,
			'mosaic_restriction': 0,
			'chain_or_network': 0,
			'other': 0
		}
		categories.update(overrides)
		return categories

	def test_sync_block_headers_logs_one_completed_batch_and_workflow_event(self):
		# Arrange:
		connector = FakeConnector(1, {0: [create_node_block(1)]})

		# Act:
		events = self._run_sync(connector)

		# Assert:
		self.assertEqual(2, len(events))
		batch_event, workflow_event = events
		self._assert_event_key_contract(batch_event, BATCH_EVENT_KEYS)
		self._assert_event_key_contract(workflow_event, WORKFLOW_EVENT_KEYS)
		self.assertEqual({
			'event': 'symbol_sync_batch_completed',
			'status': 'completed',
			'start_height': 1,
			'end_height': 1,
			'failed_phase': None,
			'exception_class': None,
			'block_count': 1,
			'transaction_count': 0,
			'receipt_count': 0,
			'http_attempt_count': 5,
			'http_success_count': 4,
			'http_retry_count': 0,
			'http_get_attempt_count': 4,
			'http_post_attempt_count': 1,
			'rate_limit_wait_ms': 0,
			'db_commit_count': 7,
			'db_commit_attempt_count': 7,
			'dirty_account_count': 1,
			'dirty_namespace_count': 0,
			'dirty_mosaic_count': 0,
			'dirty_metadata_count': 0,
			'dirty_hash_lock_count': 0,
			'dirty_secret_lock_count': 0,
			'dirty_mosaic_restriction_count': 0,
			'http_get_attempts_by_category': self._expected_http_categories(
				block=1, confirmed_transaction=1, transaction_statement=1, account_multisig=1),
			'http_post_attempts_by_category': self._expected_http_categories(account_batch=1),
		}, self._without_timing_fields(batch_event))
		self.assertEqual({
			'event': 'symbol_sync_completed',
			'status': 'completed',
			'start_height': 1,
			'target_height': 1,
			'last_completed_height': 1,
			'batch_count': 1,
			'failed_phase': None,
			'exception_class': None,
			'block_count': 1,
			'transaction_count': 0,
			'receipt_count': 0,
			'http_attempt_count': 8,
			'http_success_count': 7,
			'http_retry_count': 0,
			'http_get_attempt_count': 7,
			'http_post_attempt_count': 1,
			'rate_limit_wait_ms': 0,
			'db_commit_count': 9,
			'db_commit_attempt_count': 9,
			'dirty_account_count': 1,
			'dirty_namespace_count': 0,
			'dirty_mosaic_count': 0,
			'dirty_metadata_count': 0,
			'dirty_hash_lock_count': 0,
			'dirty_secret_lock_count': 0,
			'dirty_mosaic_restriction_count': 0,
			'http_get_attempts_by_category': self._expected_http_categories(
				block=1, confirmed_transaction=1, transaction_statement=1, account_multisig=1,
				mosaic_batch=1, chain_or_network=2),
			'http_post_attempts_by_category': self._expected_http_categories(account_batch=1),
		}, self._without_timing_fields(workflow_event))

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
			{0: [create_node_block(1, transactions_count=1, total_transactions_count=2)]},
			transactions_by_path={transaction_path(1, 1): create_transaction_page(transactions)},
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
		connector = FakeConnector(1001, create_multi_batch_block_pages())

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
		connector = FailingSecondBatchConnector(1001, create_multi_batch_block_pages())
		logger = RecordingLogger()

		# Act:
		with self.assertRaisesRegex(ValueError, 'second batch block fetch failed'):
			self._run_sync(connector, logger)

		# Assert:
		events = logger.events
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
		with self.assertRaisesRegex(ValueError, 'transaction fetch failed') as exception_context:
			self._run_sync(connector, logger)

		# Assert:
		self.assertIs(expected_exception, exception_context.exception)
		events = logger.events
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

		# Act:
		with self.assertRaisesRegex(ValueError, 'transaction fetch failed') as exception_context:
			self._run_sync(connector, FailingLogger())

		# Assert:
		self.assertIs(expected_exception, exception_context.exception)

	def test_sync_block_headers_reports_chain_info_failure_phase_without_batch(self):
		# Arrange:
		expected_exception = ValueError('chain info fetch failed')
		connector = FailingChainInfoConnector(1, {})
		connector.failure = expected_exception
		logger = RecordingLogger()

		# Act:
		with self.assertRaisesRegex(ValueError, 'chain info fetch failed') as exception_context:
			self._run_sync(connector, logger)

		# Assert:
		self.assertIs(expected_exception, exception_context.exception)
		event = logger.events[0]
		self.assertEqual('symbol_sync_failed', event['event'])
		self.assertEqual('failed', event['status'])
		self.assertEqual(0, event['batch_count'])
		self.assertEqual(1, event['http_attempt_count'])
		self.assertEqual('chain_info_fetch', event['failed_phase'])
		self.assertEqual('ValueError', event['exception_class'])

	def test_sync_block_headers_counts_batch_external_chain_info_retry_only_in_workflow(self):
		# Arrange:
		connector = RetryOnceChainInfoConnector(1, {0: [create_node_block(1)]})

		# Act:
		events = self._run_sync(connector)

		# Assert:
		batch_event, workflow_event = events
		self.assertEqual(5, batch_event['http_attempt_count'])
		self.assertEqual(4, batch_event['http_success_count'])
		self.assertEqual(0, batch_event['http_retry_count'])
		self.assertEqual(4, batch_event['http_get_attempt_count'])
		self.assertEqual(1, batch_event['http_post_attempt_count'])
		self.assertEqual(9, workflow_event['http_attempt_count'])
		self.assertEqual(7, workflow_event['http_success_count'])
		self.assertEqual(1, workflow_event['http_retry_count'])
		self.assertEqual(8, workflow_event['http_get_attempt_count'])
		self.assertEqual(1, workflow_event['http_post_attempt_count'])
		self.assertEqual(3, workflow_event['http_get_attempts_by_category']['chain_or_network'])

	def test_sync_block_headers_counts_batch_external_rate_limit_wait_only_in_workflow(self):
		# Arrange:
		connector = FakeConnector(1, {0: [create_node_block(1)]})
		rate_limiter = FixedRateLimiter(0.125, 0.25)

		# Act:
		batch_event, workflow_event = self._run_sync(connector, rate_limiter=rate_limiter)[:2]

		# Assert:
		self.assertEqual(8, rate_limiter.call_count)
		self.assertEqual(1250, batch_event['rate_limit_wait_ms'])
		self.assertEqual(1875, workflow_event['rate_limit_wait_ms'])
		self.assertEqual(625, workflow_event['rate_limit_wait_ms'] - batch_event['rate_limit_wait_ms'])
		self.assertEqual(0, batch_event['http_retry_count'])

	def test_sync_block_headers_records_positive_deduplicated_account_dirty_count(self):
		# Arrange:
		connector = FakeConnector(2, {
			0: [create_node_block(1), create_node_block(2)]
		})

		# Act:
		batch_event, workflow_event = self._run_sync(connector)[:2]

		# Assert:
		self.assertEqual(1, batch_event['dirty_account_count'])
		self.assertEqual(1, workflow_event['dirty_account_count'])

	def test_sync_block_headers_records_positive_namespace_dirty_count(self):
		# Arrange:
		transaction = create_node_transaction(
			1,
			transaction_hash='A' * 64,
			transaction_id='namespace-registration',
			type=TransactionType.NAMESPACE_REGISTRATION.value,
			id=NAMESPACE_ROOT_ID,
			name='root',
			registrationType=0)

		# The helper performs the shared Act and Assert.
		self._assert_dirty_count(
			transaction,
			'dirty_namespace_count',
			namespace_by_id={NAMESPACE_ROOT_ID: create_namespace_item()},
			namespace_names={NAMESPACE_ROOT_ID: 'root'})

	def test_sync_block_headers_records_positive_mosaic_dirty_count(self):
		# Arrange:
		transaction = create_node_transaction(
			1,
			transaction_hash='A' * 64,
			transaction_id='mosaic-definition',
			type=TransactionType.MOSAIC_DEFINITION.value,
			id=MOSAIC_ID,
			duration='0',
			flags=2,
			divisibility=6)

		# The helper performs the shared Act and Assert.
		self._assert_dirty_count(
			transaction,
			'dirty_mosaic_count',
			mosaics_by_id={MOSAIC_ID: create_mosaic_item()})

	def test_sync_block_headers_records_positive_metadata_dirty_count(self):
		# Arrange:
		transaction = create_node_transaction(
			1,
			transaction_hash='A' * 64,
			transaction_id='account-metadata',
			type=TransactionType.ACCOUNT_METADATA.value,
			targetAddress=RECIPIENT_ADDRESS,
			scopedMetadataKey=SCOPED_METADATA_KEY,
			valueSizeDelta=5,
			value='68656C6C6F')
		transaction['transaction'].pop('recipientAddress')
		transaction['transaction'].pop('mosaics')
		metadata_response_path = metadata_path(
			0,
			source_address=SIGNER_ADDRESS,
			target_address=RECIPIENT_ADDRESS,
			scoped_metadata_key=SCOPED_METADATA_KEY)

		# The helper performs the shared Act and Assert.
		self._assert_dirty_count(
			transaction,
			'dirty_metadata_count',
			metadata_by_query={metadata_response_path: {
				'data': [create_metadata_item(
					metadata_type=0,
					target_id='0000000000000000',
					source_address=SIGNER_ADDRESS,
					target_address=RECIPIENT_ADDRESS)
				]}})

	def test_sync_block_headers_records_positive_hash_lock_dirty_count(self):
		# Arrange:
		lock_hash = 'AA' * 32
		transaction = create_node_transaction(
			1,
			transaction_hash='A' * 64,
			transaction_id='hash-lock',
			type=TransactionType.HASH_LOCK.value,
			hash=lock_hash,
			mosaicId=MOSAIC_ID,
			amount='1234')

		# The helper performs the shared Act and Assert.
		self._assert_dirty_count(
			transaction,
			'dirty_hash_lock_count',
			connector_class=ExtraResponseConnector,
			responses={
				f'lock/hash/{lock_hash}': {
					'lock': {
						'hash': lock_hash,
						'ownerAddress': SIGNER_ADDRESS,
						'mosaicId': MOSAIC_ID,
						'amount': '1234',
						'endHeight': '100',
						'status': 0
					},
					'id': 'hash-lock'
				}
			})

	def test_sync_block_headers_records_positive_secret_lock_dirty_count(self):
		# Arrange:
		secret = 'CC' * 32
		transaction = create_node_transaction(
			1,
			transaction_hash='A' * 64,
			transaction_id='secret-lock',
			type=TransactionType.SECRET_LOCK.value,
			secret=secret,
			hashAlgorithm=1,
			mosaicId=MOSAIC_ID,
			amount='1234')
		secret_path = (
			f'lock/secret?address={Address(bytes.fromhex(SIGNER_ADDRESS))}&secret={secret}'
			'&pageSize=100&pageNumber=1')

		# The helper performs the shared Act and Assert.
		self._assert_dirty_count(
			transaction,
			'dirty_secret_lock_count',
			connector_class=ExtraResponseConnector,
			responses={secret_path: {'data': [create_secret_lock_item(
				owner_address=SIGNER_ADDRESS,
				recipient_address=RECIPIENT_ADDRESS,
				secret=secret,
				mosaic_id=MOSAIC_ID)]}})

	def test_sync_block_headers_records_positive_mosaic_restriction_dirty_count(self):
		# Arrange:
		transaction = create_node_transaction(
			1,
			transaction_hash='A' * 64,
			transaction_id='mosaic-address-restriction',
			type=TransactionType.MOSAIC_ADDRESS_RESTRICTION.value,
			mosaicId=MOSAIC_ID,
			targetAddress=RECIPIENT_ADDRESS)
		restriction_path = (
			f'restrictions/mosaic?mosaicId={MOSAIC_ID}&entryType=0&pageSize=100&pageNumber=1'
			f'&targetAddress={Address(bytes.fromhex(RECIPIENT_ADDRESS))}')

		# The helper performs the shared Act and Assert.
		self._assert_dirty_count(
			transaction,
			'dirty_mosaic_restriction_count',
			connector_class=ExtraResponseConnector,
			responses={restriction_path: {
				'pagination': {'pageNumber': 1, 'pageSize': 100},
				'data': [{
					'id': 'BB' * 12,
					'mosaicRestrictionEntry': {
						'version': 1,
						'compositeHash': 'AA' * 32,
						'entryType': 0,
						'mosaicId': MOSAIC_ID,
						'targetAddress': RECIPIENT_ADDRESS,
						'restrictions': [{'key': '1', 'value': '2'}]
					}
				}]
			}})

	def test_sync_block_headers_connects_fetch_and_db_measurements_to_batch_and_workflow_events(self):
		# Arrange:
		clock = IncrementingClock()
		self.puller._time_source = clock  # pylint: disable=protected-access
		self.puller.symbol_db._time_source = clock  # pylint: disable=protected-access
		connector = FakeConnector(1, {0: [create_node_block(1)]})

		# Act:
		batch_event, workflow_event = self._run_sync(connector)[:2]

		# Assert:
		expected_batch_fetch_times = {
			'block_fetch_ms': 1,
			'transaction_fetch_ms': 1,
			'receipt_fetch_ms': 1,
			'resolution_fetch_ms': 1,
			'account_fetch_ms': 1,
			'namespace_fetch_ms': 1,
			'mosaic_fetch_ms': 1,
			'metadata_fetch_ms': 1,
			'hash_lock_fetch_ms': 1,
			'secret_lock_fetch_ms': 1,
			'mosaic_restriction_fetch_ms': 1
		}
		expected_workflow_fetch_times = {
			'block_fetch_ms': 1,
			'transaction_fetch_ms': 1,
			'receipt_fetch_ms': 1,
			'resolution_fetch_ms': 1,
			'account_fetch_ms': 1,
			'namespace_fetch_ms': 1,
			'mosaic_fetch_ms': 1,
			'metadata_fetch_ms': 1,
			'hash_lock_fetch_ms': 1,
			'secret_lock_fetch_ms': 1,
			'mosaic_restriction_fetch_ms': 1
		}
		self.assertEqual(expected_batch_fetch_times, {field: batch_event[field] for field in (
			'block_fetch_ms', 'transaction_fetch_ms', 'receipt_fetch_ms', 'resolution_fetch_ms', 'account_fetch_ms',
			'namespace_fetch_ms', 'mosaic_fetch_ms', 'metadata_fetch_ms', 'hash_lock_fetch_ms',
			'secret_lock_fetch_ms', 'mosaic_restriction_fetch_ms')})
		self.assertEqual(expected_workflow_fetch_times, {field: workflow_event[field] for field in (
			'block_fetch_ms', 'transaction_fetch_ms', 'receipt_fetch_ms', 'resolution_fetch_ms', 'account_fetch_ms',
			'namespace_fetch_ms', 'mosaic_fetch_ms', 'metadata_fetch_ms', 'hash_lock_fetch_ms',
			'secret_lock_fetch_ms', 'mosaic_restriction_fetch_ms')})
		self.assertEqual(7, batch_event['db_commit_ms'])
		self.assertEqual(7, batch_event['db_commit_count'])
		self.assertEqual(9, workflow_event['db_commit_ms'])
		self.assertEqual(9, workflow_event['db_commit_count'])
		self.assertEqual(2, workflow_event['db_commit_ms'] - batch_event['db_commit_ms'])
		self.assertEqual(2, workflow_event['db_commit_count'] - batch_event['db_commit_count'])
		expected_batch_db_write_times = {
			'block_transaction_receipt_write_ms': 7,
			'account_multisig_write_ms': 5,
			'current_state_write_ms': 3,
			'db_write_total_ms': 21
		}
		expected_workflow_db_write_times = {
			'block_transaction_receipt_write_ms': 7,
			'account_multisig_write_ms': 5,
			'current_state_write_ms': 3,
			'db_write_total_ms': 21
		}
		self.assertEqual(expected_batch_db_write_times, {field: batch_event[field] for field in (
			'block_transaction_receipt_write_ms', 'account_multisig_write_ms', 'current_state_write_ms', 'db_write_total_ms')})
		self.assertEqual(expected_workflow_db_write_times, {field: workflow_event[field] for field in (
			'block_transaction_receipt_write_ms', 'account_multisig_write_ms', 'current_state_write_ms', 'db_write_total_ms')})

	def test_sync_block_headers_reports_sync_state_read_failure_without_batch(self):
		# Arrange:
		expected_exception = RuntimeError('sync state read failed')
		connector = FakeConnector(1, {})
		logger = RecordingLogger()
		self.puller.symbol_db = FailingSyncStateReadDatabase(self.puller.symbol_db, expected_exception)

		# Act:
		with self.assertRaisesRegex(RuntimeError, 'sync state read failed') as exception_context:
			self._run_sync(connector, logger)

		# Assert:
		self.assertIs(expected_exception, exception_context.exception)
		self.assertEqual(1, len(logger.events))
		event = logger.events[0]
		self._assert_event_key_contract(event, WORKFLOW_EVENT_KEYS)
		self.assertEqual('symbol_sync_failed', event['event'])
		self.assertEqual('sync_state_read', event['failed_phase'])
		self.assertEqual('RuntimeError', event['exception_class'])
		self.assertEqual(0, event['batch_count'])
		self.assertEqual(0, event['block_count'])
		self.assertEqual(0, event['db_commit_count'])

	def test_sync_block_headers_reports_network_properties_fetch_failure_phase_without_batch(self):
		# Arrange:
		expected_exception = ValueError('network properties fetch failed')
		connector = FailingPhaseConnector('network/properties', expected_exception, 1, {})
		logger = RecordingLogger()

		# Act:
		with self.assertRaisesRegex(ValueError, 'network properties fetch failed'):
			self._run_sync(connector, logger)

		# Assert:
		event = logger.events[0]
		self.assertEqual('network_properties_fetch', event['failed_phase'])
		self.assertEqual(0, event['batch_count'])

	def test_sync_block_headers_reports_native_mosaic_fetch_failure_phase_without_batch(self):
		# Arrange:
		expected_exception = ValueError('native mosaic fetch failed')
		connector = FailingPhaseConnector(
			'mosaics/72C0212E67A08BCE', expected_exception, 1, {})
		logger = RecordingLogger()

		# Act:
		with self.assertRaisesRegex(ValueError, 'native mosaic fetch failed'):
			self._run_sync(connector, logger)

		# Assert:
		event = logger.events[0]
		self.assertEqual('native_mosaic_fetch', event['failed_phase'])
		self.assertEqual(0, event['batch_count'])

	def test_sync_block_headers_reports_rollback_failure_phase_without_batch(self):
		# Arrange:
		connector = FakeConnector(1, {})
		logger = RecordingLogger()
		self.puller.symbol_db.upsert_sync_state(create_sync_state())

		# Act:
		with self.assertRaisesRegex(SymbolRollbackError, 'Finalized block is missing from local database') as exception_context:
			self._run_sync(connector, logger)

		# Assert:
		self.assertEqual('Finalized block is missing from local database', str(exception_context.exception))
		event = logger.events[0]
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
		self._seed_blocks(self.puller.symbol_db, [1])
		self.puller.symbol_db.upsert_sync_state(create_sync_state(chain_height=1, last_synced_height=1))
		self.puller.symbol_db = FailingFinalizationDatabase(self.puller.symbol_db, expected_exception)

		# Act:
		with self.assertRaisesRegex(ValueError, 'finalization cleanup failed') as exception_context:
			self._run_sync(connector, logger)

		# Assert:
		self.assertIs(expected_exception, exception_context.exception)
		event = logger.events[0]
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
		self.puller.symbol_db = FailingSyncStateDatabase(self.puller.symbol_db, expected_exception)

		# Act:
		with self.assertRaisesRegex(ValueError, 'sync state write failed') as exception_context:
			self._run_sync(connector, logger)

		# Assert:
		self.assertIs(expected_exception, exception_context.exception)
		events = logger.events
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

	def test_performance_event_generation_failure_does_not_log_or_raise(self):
		# Arrange:
		performance = FailingEventPerformance()
		logger = RecordingLogger()
		self.puller._performance_logger = logger  # pylint: disable=protected-access

		# Act:
		self.puller._log_performance_event(  # pylint: disable=protected-access
			performance, 'symbol_sync_failed', 'failed', ValueError('original'))

		# Assert:
		self.assertEqual(1, performance.call_count)
		self.assertEqual([], logger.events)

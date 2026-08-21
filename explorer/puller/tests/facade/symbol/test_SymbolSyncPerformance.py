import json
from unittest import TestCase

from puller.facade.SymbolSyncPerformance import BatchPerformance, SyncPerformance, request_category


class MutableClock:
	def __init__(self):
		self.value = 0

	def __call__(self):
		return self.value


class FailingClock:
	def __call__(self):  # pylint: disable=no-self-use
		raise RuntimeError('clock failed')


# pylint: disable=duplicate-code,too-many-public-methods
class SymbolSyncPerformanceTest(TestCase):
	def _assert_request_category(self, method, path, expected_category):
		# Act:
		category = request_category(method, path)

		# Assert:
		self.assertEqual(expected_category, category)

	def test_request_category_classifies_chain_info_as_chain_or_network(self):
		self._assert_request_category('GET', 'chain/info', 'chain_or_network')

	def test_request_category_classifies_network_properties_as_chain_or_network(self):
		self._assert_request_category('GET', 'network/properties', 'chain_or_network')

	def test_request_category_classifies_block_list_as_block(self):
		self._assert_request_category('GET', 'blocks?pageSize=100&offset=0', 'block')

	def test_request_category_classifies_block_detail_as_block(self):
		self._assert_request_category('GET', 'blocks/123', 'block')

	def test_request_category_classifies_confirmed_transactions(self):
		self._assert_request_category('GET', 'transactions/confirmed', 'confirmed_transaction')

	def test_request_category_classifies_transaction_statements(self):
		self._assert_request_category('GET', 'statements/transaction', 'transaction_statement')

	def test_request_category_classifies_address_resolution(self):
		self._assert_request_category('GET', 'statements/resolutions/address', 'address_resolution')

	def test_request_category_classifies_mosaic_resolution(self):
		self._assert_request_category('GET', 'statements/resolutions/mosaic', 'mosaic_resolution')

	def test_request_category_classifies_account_batch_only_for_post(self):
		self._assert_request_category('POST', 'accounts', 'account_batch')

	def test_request_category_classifies_account_list_get_as_other(self):
		self._assert_request_category('GET', 'accounts', 'other')

	def test_request_category_classifies_account_multisig_detail(self):
		self._assert_request_category('GET', 'account/98ABC/multisig', 'account_multisig')

	def test_request_category_classifies_namespace_detail(self):
		self._assert_request_category('GET', 'namespaces/A95F1F8A96159516', 'namespace_detail')

	def test_request_category_classifies_namespace_names(self):
		self._assert_request_category('POST', 'namespaces/names', 'namespace_name')

	def test_request_category_classifies_mosaic_batch_only_for_post(self):
		self._assert_request_category('POST', 'mosaics', 'mosaic_batch')

	def test_request_category_classifies_mosaic_list_get_as_other(self):
		self._assert_request_category('GET', 'mosaics', 'other')

	def test_request_category_classifies_mosaic_detail_using_mosaic_batch_category(self):
		self._assert_request_category('GET', 'mosaics/72C0212E67A08BCE', 'mosaic_batch')

	def test_request_category_classifies_metadata_search(self):
		self._assert_request_category('GET', 'metadata', 'metadata_search')

	def test_request_category_classifies_hash_lock_detail(self):
		self._assert_request_category('GET', 'lock/hash/' + 'AA' * 32, 'hash_lock')

	def test_request_category_classifies_secret_lock_search(self):
		self._assert_request_category('GET', 'lock/secret', 'secret_lock')

	def test_request_category_classifies_mosaic_restriction_search(self):
		self._assert_request_category('GET', 'restrictions/mosaic', 'mosaic_restriction')

	def test_request_category_classifies_unknown_path_as_other(self):
		self._assert_request_category('GET', 'unrelated/path', 'other')

	def test_request_category_ignores_query_values_when_classifying(self):
		self._assert_request_category('GET', 'lock/hash/' + 'AA' * 32 + '?secret=SECRET_VALUE', 'hash_lock')

	def test_request_category_strips_leading_slash_before_classifying(self):
		self._assert_request_category('GET', '/network/properties', 'chain_or_network')

	def test_batch_event_uses_injected_clock_for_phase_commit_and_wait_durations(self):
		# Arrange:
		clock = MutableClock()
		clock.value = 1
		batch = BatchPerformance(clock, 10, 12)
		with batch.measure('block_fetch_ms', 'block_fetch'):
			clock.value = 1.25
		batch.record_rate_limit_wait(0.4)
		batch.record_commit(0.05, True)
		batch.record_commit(0.07, False)
		batch.set_count('receipt_count', 3)
		clock.value = 2

		# Act:
		event = batch.event('symbol_sync_batch_failed', 'failed', RuntimeError('not logged'))

		# Assert:
		self.assertEqual(1000, event['elapsed_ms'])
		self.assertEqual(250, event['block_fetch_ms'])
		self.assertEqual(400, event['rate_limit_wait_ms'])
		self.assertEqual(3, event['receipt_count'])
		self.assertEqual(1, event['db_commit_count'])
		self.assertEqual(2, event['db_commit_attempt_count'])
		self.assertEqual(120, event['db_commit_ms'])
		self.assertEqual('RuntimeError', event['exception_class'])

	def test_request_category_masks_dynamic_path_values(self):
		# Arrange:
		sensitive_path = '/lock/hash/' + 'DEADBEEF' * 8 + '?secret=SECRET_VALUE'
		batch = BatchPerformance(MutableClock(), 1, 1)
		batch.record_request_attempt('GET', request_category('GET', sensitive_path))

		# Act:
		event = batch.event('symbol_sync_batch_completed', 'completed')
		serialized_event = json.dumps(event)

		# Assert:
		self.assertEqual(1, event['http_get_attempts_by_category']['hash_lock'])
		self.assertEqual(False, 'DEADBEEF' in serialized_event)
		self.assertEqual(False, 'SECRET_VALUE' in serialized_event)
		self.assertEqual(False, sensitive_path in serialized_event)
		self.assertEqual({
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
		}, set(event))

	def test_sync_performance_state_is_not_shared_between_instances(self):
		# Arrange:
		clock = MutableClock()
		first = SyncPerformance(clock)
		second = SyncPerformance(clock)
		first_batch = first.start_batch(1, 1)
		first.record_request_attempt('GET', 'block')
		first.complete_batch(first_batch)

		# Act:
		first_event = first.event('symbol_sync_completed', 'completed')
		second_event = second.event('symbol_sync_completed', 'completed')

		# Assert:
		self.assertEqual(1, first_event['http_attempt_count'])
		self.assertEqual(0, second_event['http_attempt_count'])
		self.assertEqual(1, first_event['batch_count'])
		self.assertEqual(0, second_event['batch_count'])

	def test_workflow_phase_is_only_published_as_failed_phase_after_failure(self):
		# Arrange:
		sync = SyncPerformance(MutableClock())
		sync.set_phase('sync_state_write')

		# Act:
		completed_event = sync.event('symbol_sync_completed', 'completed')
		sync.set_failed_phase()
		failed_event = sync.event('symbol_sync_failed', 'failed', ValueError('failure'))

		# Assert:
		self.assertEqual(None, completed_event['failed_phase'])
		self.assertEqual('sync_state_write', failed_event['failed_phase'])

	def test_batch_performance_elapsed_falls_back_when_clock_fails(self):
		# Arrange:
		clock = FailingClock()
		batch = BatchPerformance(clock, 10, 12)

		# Act:
		batch_event = batch.event('symbol_sync_batch_completed', 'completed')

		# Assert:
		self.assertEqual(0, batch_event['elapsed_ms'])

	def test_sync_performance_elapsed_falls_back_when_clock_fails(self):
		# Arrange:
		clock = FailingClock()
		sync = SyncPerformance(clock)

		# Act:
		sync_event = sync.event('symbol_sync_completed', 'completed')

		# Assert:
		self.assertEqual(0, sync_event['elapsed_ms'])

	def test_batch_performance_clamps_reverse_clock_elapsed_and_phase_to_zero(self):
		# Arrange:
		clock = MutableClock()
		clock.value = 2
		batch = BatchPerformance(clock, 10, 12)

		# Act:
		clock.value = 2
		with batch.measure('block_fetch_ms', 'block_fetch'):
			clock.value = 1
		batch_event = batch.event('symbol_sync_batch_completed', 'completed')

		# Assert:
		self.assertEqual(0, batch_event['elapsed_ms'])
		self.assertEqual(0, batch_event['block_fetch_ms'])

	def test_sync_performance_clamps_reverse_clock_elapsed_to_zero(self):
		# Arrange:
		clock = MutableClock()
		clock.value = 2
		sync = SyncPerformance(clock)

		# Act:
		clock.value = 1
		sync_event = sync.event('symbol_sync_completed', 'completed')

		# Assert:
		self.assertEqual(0, sync_event['elapsed_ms'])

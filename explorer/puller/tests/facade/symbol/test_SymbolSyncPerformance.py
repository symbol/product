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


class SymbolSyncPerformanceTest(TestCase):
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

		# Act:
		category = request_category('GET', sensitive_path)

		# Assert:
		self.assertEqual('hash_lock', category)
		self.assertEqual('{"category": "hash_lock"}', json.dumps({'category': category}))
		self.assertEqual(False, 'DEADBEEF' in json.dumps({'category': category}))
		self.assertEqual(False, 'SECRET_VALUE' in json.dumps({'category': category}))

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

	def test_batch_and_workflow_measurements_fall_back_when_clock_fails(self):
		# Arrange:
		clock = FailingClock()
		batch = BatchPerformance(clock, 10, 12)
		sync = SyncPerformance(clock)

		# Act:
		batch_event = batch.event('symbol_sync_batch_completed', 'completed')
		sync_event = sync.event('symbol_sync_completed', 'completed')

		# Assert:
		self.assertEqual(0, batch_event['elapsed_ms'])
		self.assertEqual(0, sync_event['elapsed_ms'])

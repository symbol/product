import asyncio
from unittest import TestCase

from puller.facade.async_utils import gather_in_chunks, log_cleanup_failure_safely, select_exception_by_priority
from tests.facade.symbol.puller_test_utils import RecordingCleanupLogger


class AsyncUtilsTest(TestCase):
	def test_select_exception_by_priority_keeps_highest_priority_and_first_observed_instance(self):
		# Arrange:
		first_regular = RuntimeError('first regular')
		second_regular = ValueError('second regular')
		keyboard_interrupt = KeyboardInterrupt('keyboard interrupt')
		system_exit = SystemExit('system exit')
		first_cancellation = asyncio.CancelledError('first cancellation')
		second_cancellation = asyncio.CancelledError('second cancellation')
		cases = [
			(None, first_regular, first_regular),
			(first_regular, None, first_regular),
			(first_regular, second_regular, first_regular),
			(first_regular, keyboard_interrupt, keyboard_interrupt),
			(keyboard_interrupt, system_exit, keyboard_interrupt),
			(keyboard_interrupt, first_cancellation, first_cancellation),
			(first_cancellation, keyboard_interrupt, first_cancellation),
			(first_cancellation, second_cancellation, first_cancellation)
		]

		# Act / Assert:
		for current_exception, candidate_exception, expected_exception in cases:
			with self.subTest(current_exception=current_exception, candidate_exception=candidate_exception):
				selected_exception = select_exception_by_priority(current_exception, candidate_exception)
				self.assertIs(expected_exception, selected_exception)

	def test_select_exception_by_priority_preserves_selected_exception_context(self):
		# Arrange:
		current_exception = RuntimeError('operation failed')
		candidate_exception = KeyboardInterrupt('cleanup interrupted')
		context_exception = ValueError('original context')
		candidate_exception.__context__ = context_exception

		# Act:
		selected_exception = select_exception_by_priority(current_exception, candidate_exception)

		# Assert:
		self.assertIs(candidate_exception, selected_exception)
		self.assertIs(context_exception, selected_exception.__context__)

	def test_log_cleanup_failure_safely_ignores_logger_failure(self):
		# Arrange:
		cleanup_logger = RecordingCleanupLogger(RuntimeError('logger failed'))

		# Act:
		log_cleanup_failure_safely(cleanup_logger, 'cleanup failed')

		# Assert:
		self.assertEqual(['cleanup failed'], cleanup_logger.messages)

	def test_gather_in_chunks_rejects_non_positive_or_boolean_chunk_size(self):
		# Act + Assert:
		async def fetch_item(item):
			return item

		for chunk_size in (0, -1, True, '10'):
			with self.subTest(chunk_size=chunk_size), self.assertRaises(ValueError):
				asyncio.run(gather_in_chunks([], chunk_size, fetch_item))

	def test_gather_in_chunks_bounds_concurrency_and_preserves_the_explicit_non_sorted_sequence(self):
		# Arrange:
		items = [
			'k19', 'k01', 'k22', 'k03', 'k17', 'k00', 'k18', 'k04', 'k16', 'k02',
			'k15', 'k05', 'k14', 'k06', 'k13', 'k07', 'k12', 'k08', 'k11', 'k09',
			'k21', 'k10', 'k20'
		]
		active_count = 0
		maximum_active_count = 0

		async def fetch_item(item):
			nonlocal active_count, maximum_active_count
			active_count += 1
			maximum_active_count = max(maximum_active_count, active_count)
			try:
				await asyncio.sleep(0)
				return f'fetched-{item}'
			finally:
				active_count -= 1

		# Act:
		result = asyncio.run(gather_in_chunks(items, 10, fetch_item))

		# Assert:
		self.assertEqual([f'fetched-{item}' for item in items], result)
		self.assertEqual(10, maximum_active_count)

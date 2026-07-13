import asyncio
from unittest import TestCase

from puller.facade.RequestRateLimiter import RequestRateLimiter


class FakeClock:
	def __init__(self):
		self.value = 0

	def __call__(self):
		return self.value


class RecordingSleep:
	def __init__(self, clock):
		self.wait_seconds = []
		self._clock = clock

	async def __call__(self, wait_seconds):
		self.wait_seconds.append(wait_seconds)
		self._clock.value += wait_seconds


class RequestRateLimiterTest(TestCase):
	def test_wait_for_turn_does_not_sleep_on_first_call(self):
		# Arrange:
		clock = FakeClock()
		sleep = RecordingSleep(clock)
		limiter = RequestRateLimiter(10, clock, sleep)

		# Act:
		asyncio.run(limiter.wait_for_turn())

		# Assert:
		self.assertEqual([], sleep.wait_seconds)

	def test_wait_for_turn_sleeps_for_remaining_interval_on_immediate_second_call(self):
		# Arrange:
		clock = FakeClock()
		sleep = RecordingSleep(clock)
		limiter = RequestRateLimiter(10, clock, sleep)

		# Act:
		async def wait_twice():
			await limiter.wait_for_turn()
			await limiter.wait_for_turn()

		asyncio.run(wait_twice())

		# Assert:
		self.assertEqual([0.1], sleep.wait_seconds)

	def test_wait_for_turn_does_not_sleep_when_enough_time_already_elapsed(self):
		# Arrange:
		clock = FakeClock()
		sleep = RecordingSleep(clock)
		limiter = RequestRateLimiter(10, clock, sleep)

		async def wait_with_elapsed_time():
			await limiter.wait_for_turn()
			clock.value += 0.2
			await limiter.wait_for_turn()

		# Act:
		asyncio.run(wait_with_elapsed_time())

		# Assert:
		self.assertEqual([], sleep.wait_seconds)

	def test_wait_for_turn_serializes_concurrent_callers(self):
		# Arrange:
		clock = FakeClock()
		sleep = RecordingSleep(clock)
		limiter = RequestRateLimiter(10, clock, sleep)

		# Act:
		async def wait_concurrently():
			await asyncio.gather(*[limiter.wait_for_turn() for _ in range(4)])

		asyncio.run(wait_concurrently())

		# Assert:
		self.assertEqual(3, len(sleep.wait_seconds))

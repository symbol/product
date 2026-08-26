import asyncio
from unittest import TestCase

from puller.facade.RequestRateLimiter import RequestRateLimiter


class FakeClock:
	def __init__(self):
		self.value = 0

	def __call__(self):
		return self.value


class RecordingSleep:
	def __init__(self, clock, extra_seconds=0):
		self.wait_seconds = []
		self._clock = clock
		self._extra_seconds = extra_seconds

	async def __call__(self, wait_seconds):
		self.wait_seconds.append(wait_seconds)
		self._clock.value += wait_seconds + self._extra_seconds


class BlockingSleep(RecordingSleep):
	def __init__(self, clock):
		super().__init__(clock)
		self.started = asyncio.Event()
		self.release = asyncio.Event()

	async def __call__(self, wait_seconds):
		self.wait_seconds.append(wait_seconds)
		self._clock.value += wait_seconds
		self.started.set()
		await self.release.wait()


class ConcurrentClock(FakeClock):
	def __init__(self):
		super().__init__()
		self.call_count = 0
		self.second_caller_started = asyncio.Event()

	def __call__(self):
		self.call_count += 1
		if 5 == self.call_count:
			self.second_caller_started.set()

		return super().__call__()


class RequestRateLimiterTest(TestCase):
	def test_wait_for_turn_does_not_sleep_on_first_call(self):
		# Arrange:
		clock = FakeClock()
		sleep = RecordingSleep(clock)
		limiter = RequestRateLimiter(10, clock, sleep)

		# Act:
		wait_duration = asyncio.run(limiter.wait_for_turn())

		# Assert:
		self.assertEqual([], sleep.wait_seconds)
		self.assertEqual(0, wait_duration)

	def test_wait_for_turn_sleeps_for_remaining_interval_on_immediate_second_call(self):
		# Arrange:
		clock = FakeClock()
		sleep = RecordingSleep(clock)
		limiter = RequestRateLimiter(10, clock, sleep)

		# Act:
		async def wait_twice():
			return [await limiter.wait_for_turn(), await limiter.wait_for_turn()]

		wait_durations = asyncio.run(wait_twice())

		# Assert:
		self.assertEqual([0.1], sleep.wait_seconds)
		self.assertEqual([0, 0.1], wait_durations)

	def test_wait_for_turn_does_not_sleep_when_enough_time_already_elapsed(self):
		# Arrange:
		clock = FakeClock()
		sleep = RecordingSleep(clock)
		limiter = RequestRateLimiter(10, clock, sleep)

		async def wait_with_elapsed_time():
			await limiter.wait_for_turn()
			clock.value += 0.2
			return await limiter.wait_for_turn()

		# Act:
		wait_duration = asyncio.run(wait_with_elapsed_time())

		# Assert:
		self.assertEqual([], sleep.wait_seconds)
		self.assertEqual(0, wait_duration)

	def test_wait_for_turn_returns_actual_sleep_elapsed_time(self):
		# Arrange:
		clock = FakeClock()
		sleep = RecordingSleep(clock, extra_seconds=0.05)
		limiter = RequestRateLimiter(10, clock, sleep)

		# Act:
		async def wait_twice():
			return [await limiter.wait_for_turn(), await limiter.wait_for_turn()]

		wait_durations = asyncio.run(wait_twice())

		# Assert:
		self.assertEqual([0.1], sleep.wait_seconds)
		self.assertEqual([0, 0.15], [round(duration, 2) for duration in wait_durations])

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

	def test_wait_for_turn_includes_lock_wait_in_actual_elapsed_time(self):
		# Arrange:
		clock = ConcurrentClock()
		sleep = BlockingSleep(clock)
		limiter = RequestRateLimiter(10, clock, sleep)

		# Act:
		async def wait_concurrently():
			await limiter.wait_for_turn()
			first_task = asyncio.create_task(limiter.wait_for_turn())
			await sleep.started.wait()
			second_task = asyncio.create_task(limiter.wait_for_turn())
			await clock.second_caller_started.wait()
			clock.value += 0.25
			sleep.release.set()
			return await asyncio.gather(first_task, second_task)

		wait_durations = asyncio.run(wait_concurrently())

		# Assert:
		self.assertEqual([0.35, 0.35], wait_durations)

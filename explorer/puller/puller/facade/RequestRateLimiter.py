import asyncio
import time


class RequestRateLimiter:
	"""Paces async operations to a maximum requests-per-second budget."""

	def __init__(self, max_requests_per_second, time_source=time.monotonic, sleep=asyncio.sleep):
		"""Creates a request rate limiter with injectable timing dependencies."""

		self._min_interval_seconds = 1 / max_requests_per_second
		self._time_source = time_source
		self._sleep = sleep
		self._lock = asyncio.Lock()
		self._next_allowed_time = None

	async def wait_for_turn(self):
		"""Blocks until this caller's turn to dispatch a request, per the configured rate."""

		started_at = self._time_source()
		async with self._lock:
			now = self._time_source()
			if self._next_allowed_time is None:
				self._next_allowed_time = now

			required_wait_seconds = self._next_allowed_time - now
			if required_wait_seconds > 0:
				await self._sleep(required_wait_seconds)
				now = self._time_source()

			self._next_allowed_time = now + self._min_interval_seconds
			return max(0, now - started_at)

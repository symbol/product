import threading
import time
from collections import OrderedDict


class TtlCache:
	"""Keeps values for a fixed time, discarding the least recently used ones once the cache is full."""

	def __init__(self, ttl_seconds, max_entries):
		"""Creates a cache holding at most max_entries values, each for the given number of seconds."""

		self.ttl_seconds = ttl_seconds
		self.max_entries = max_entries
		self._entries = OrderedDict()
		# a write reads the size and then removes an entry, which two threads cannot interleave safely
		self._lock = threading.Lock()

	def get_or_load(self, key, load):
		"""Returns the value stored under a key, calling load when it is missing or too old."""

		with self._lock:
			stored_at, value = self._entries.get(key, (None, None))
			if stored_at is not None and time.monotonic() - stored_at < self.ttl_seconds:
				self._entries.move_to_end(key)

				return value

		# load runs outside the lock, so a slow query cannot block readers of other keys. Two threads arriving
		# on the same expired key will both load, which is harmless because these reads have no side effects.
		value = load()

		with self._lock:
			self._entries[key] = (time.monotonic(), value)
			self._entries.move_to_end(key)

			# a write adds at most one entry, so dropping one keeps the cache within its limit;
			# stale entries need no sweep because get_or_load rechecks the lifetime before returning a value
			if len(self._entries) > self.max_entries:
				self._entries.popitem(last=False)

		return value

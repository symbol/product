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
		# the eviction path reads the size and then removes entries, which two threads cannot interleave safely
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
			self._evict()

		return value

	def _evict(self):
		"""Drops stale entries, then the least recently used ones, until the cache fits."""

		now = time.monotonic()

		for key in [key for key, (stored_at, _) in self._entries.items() if now - stored_at >= self.ttl_seconds]:
			del self._entries[key]

		while len(self._entries) > self.max_entries:
			self._entries.popitem(last=False)

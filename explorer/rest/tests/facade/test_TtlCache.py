import unittest

from rest.facade.TtlCache import TtlCache


class TtlCacheTest(unittest.TestCase):

	@staticmethod
	def _counting_loader(values):
		"""Creates a loader returning the next value on each call and recording how often it ran."""

		load_calls = []

		def load():
			load_calls.append(len(load_calls))

			return values[len(load_calls) - 1]

		return load, load_calls

	def test_can_load_value_on_first_read(self):
		# Arrange:
		cache = TtlCache(60, 8)
		load, load_calls = self._counting_loader(['first'])

		# Act:
		value = cache.get_or_load('key', load)

		# Assert:
		self.assertEqual('first', value)
		self.assertEqual(1, len(load_calls))

	def test_can_reuse_value_within_ttl(self):
		# Arrange:
		cache = TtlCache(60, 8)
		load, load_calls = self._counting_loader(['first', 'second'])

		# Act:
		first_value = cache.get_or_load('key', load)
		second_value = cache.get_or_load('key', load)

		# Assert: the second read is served from the cache, so the loader ran once
		self.assertEqual('first', first_value)
		self.assertEqual('first', second_value)
		self.assertEqual(1, len(load_calls))

	def test_can_reload_value_after_ttl_expires(self):
		# Arrange: a zero lifetime makes every stored value immediately stale
		cache = TtlCache(0, 8)
		load, load_calls = self._counting_loader(['first', 'second'])

		# Act:
		first_value = cache.get_or_load('key', load)
		second_value = cache.get_or_load('key', load)

		# Assert:
		self.assertEqual('first', first_value)
		self.assertEqual('second', second_value)
		self.assertEqual(2, len(load_calls))

	def test_can_keep_values_of_different_keys_apart(self):
		# Arrange:
		cache = TtlCache(60, 8)
		load, load_calls = self._counting_loader(['first', 'second'])

		# Act:
		first_value = cache.get_or_load('one', load)
		second_value = cache.get_or_load('two', load)

		# Assert:
		self.assertEqual('first', first_value)
		self.assertEqual('second', second_value)
		self.assertEqual(2, len(load_calls))

	def test_can_cache_none(self):
		# Arrange:
		cache = TtlCache(60, 8)
		load, load_calls = self._counting_loader([None, 'second'])

		# Act:
		first_value = cache.get_or_load('key', load)
		second_value = cache.get_or_load('key', load)

		# Assert: a missing result is worth caching too, otherwise it is recomputed on every read
		self.assertIsNone(first_value)
		self.assertIsNone(second_value)
		self.assertEqual(1, len(load_calls))

	def test_can_drop_least_recently_used_entry_when_full(self):
		# Arrange: a cache holding two entries at a time
		cache = TtlCache(60, 2)
		load, load_calls = self._counting_loader(['a1', 'b1', 'c1', 'b2'])
		cache.get_or_load('a', load)
		cache.get_or_load('b', load)

		# Act: touch 'a' so 'b' becomes the least recently used, then add a third key
		cache.get_or_load('a', load)
		cache.get_or_load('c', load)

		# Assert: 'a' is still cached, so reading it does not load
		self.assertEqual('a1', cache.get_or_load('a', load))
		self.assertEqual(3, len(load_calls))

		# Assert: 'b' was evicted, so reading it loads again
		self.assertEqual('b2', cache.get_or_load('b', load))
		self.assertEqual(4, len(load_calls))

	def test_can_bound_size_when_entries_are_stale(self):
		# Arrange: a zero lifetime makes every stored value stale the moment it is written
		cache = TtlCache(0, 2)
		load, _ = self._counting_loader(['a1', 'b1', 'c1', 'd1'])

		# Act: four different keys, none of which can ever be fresh
		cache.get_or_load('a', load)
		cache.get_or_load('b', load)
		cache.get_or_load('c', load)
		cache.get_or_load('d', load)

		# Assert: a stream of distinct keys cannot grow the cache past its limit
		self.assertEqual(2, len(cache._entries))  # pylint: disable=protected-access

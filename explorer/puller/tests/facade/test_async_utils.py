import asyncio
from unittest import TestCase

from puller.facade.async_utils import gather_in_chunks


class AsyncUtilsTest(TestCase):
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

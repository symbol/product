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

	def test_gather_in_chunks_preserves_the_explicit_non_sorted_sequence(self):
		# Arrange:
		items = ['k09', 'k01', 'k10', 'k03', 'k07', 'k00', 'k08', 'k04', 'k06', 'k02', 'k05']

		async def fetch_item(item):
			return f'fetched-{item}'

		# Act:
		result = asyncio.run(gather_in_chunks(items, 10, fetch_item))

		# Assert:
		self.assertEqual([f'fetched-{item}' for item in items], result)

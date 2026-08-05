"""Small asynchronous batching helpers shared by Symbol current-state fetches."""

import asyncio


async def gather_in_chunks(items, chunk_size, fetch_item):
	"""Fetch an explicitly ordered sequence in bounded asynchronous chunks."""

	if not isinstance(chunk_size, int) or isinstance(chunk_size, bool) or chunk_size <= 0:
		raise ValueError('chunk_size must be a positive integer')

	results = []
	for start in range(0, len(items), chunk_size):
		chunk = items[start:start + chunk_size]
		results.extend(await asyncio.gather(*(fetch_item(item) for item in chunk)))
	return results

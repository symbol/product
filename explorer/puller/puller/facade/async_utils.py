"""Small asynchronous utilities shared by Symbol puller lifecycle and fetches."""

import asyncio

from puller.model.symbol.format import is_exact_integer


def select_exception_by_priority(current_exception, candidate_exception):
	"""Selects the higher-priority exception, retaining the first on ties."""

	if current_exception is None:
		return candidate_exception
	if candidate_exception is None:
		return current_exception

	if _exception_priority(candidate_exception) > _exception_priority(current_exception):
		return candidate_exception

	return current_exception


def log_cleanup_failure_safely(cleanup_logger, message):
	"""Logs a cleanup failure without replacing the exception being propagated."""

	try:
		cleanup_logger.error(message)
	except Exception:  # pylint: disable=broad-exception-caught
		# Cleanup logging must not replace an operation or cleanup exception.
		pass


def _exception_priority(exception):
	if isinstance(exception, asyncio.CancelledError):
		return 3
	if isinstance(exception, (KeyboardInterrupt, SystemExit)):
		return 2
	return 1


async def gather_in_chunks(items, chunk_size, fetch_item):
	"""Fetch an explicitly ordered sequence in bounded asynchronous chunks."""

	if not is_exact_integer(chunk_size) or chunk_size <= 0:
		raise ValueError('chunk_size must be a positive integer')

	results = []
	for start in range(0, len(items), chunk_size):
		chunk = items[start:start + chunk_size]
		results.extend(await asyncio.gather(*(fetch_item(item) for item in chunk)))
	return results

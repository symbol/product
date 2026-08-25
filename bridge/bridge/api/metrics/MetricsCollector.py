import asyncio
import logging

from prometheus_client import CollectorRegistry

from .MetricsLoader import load_collectors

# reads happen while a scrape is in flight, so an unresponsive source must never pin a worker
DEFAULT_TIMEOUT_SECONDS = 3


class MetricsCollector:
	"""Runs every collector and gathers the result into a single registry."""

	def __init__(self, config, context, timeout_seconds=DEFAULT_TIMEOUT_SECONDS):
		"""Creates a metrics collector."""

		self._collectors = load_collectors(config, context, timeout_seconds)
		self._logger = logging.getLogger(__name__)

	async def collect(self):
		"""Collects all metrics into a new registry."""

		registry = CollectorRegistry()
		await asyncio.gather(*[self._collect_safely(collector, registry) for collector in self._collectors])
		return registry

	async def _collect_safely(self, collector, registry):
		try:
			await collector.collect(registry)
		except Exception:  # pylint: disable=broad-except
			self._logger.exception('collector %s failed', type(collector).__name__)

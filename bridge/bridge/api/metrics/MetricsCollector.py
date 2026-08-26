import asyncio
import logging

from prometheus_client import CollectorRegistry


class MetricsCollector:
	"""Runs every collector and gathers the result into a single registry."""

	def __init__(self, collectors):
		"""Creates a metrics collector."""

		self._collectors = collectors
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

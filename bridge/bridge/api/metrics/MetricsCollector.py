import asyncio

from prometheus_client import CollectorRegistry


class MetricsCollector:
	"""Runs every collector and gathers the result into a single registry."""

	def __init__(self, collectors):
		"""Creates a metrics collector."""

		self._collectors = collectors

	async def collect(self):
		"""Collects all metrics into a new registry."""

		registry = CollectorRegistry()
		await asyncio.gather(*[collector.collect(registry) for collector in self._collectors])
		return registry

import pytest
from prometheus_client import Gauge

from bridge.api.metrics.MetricsCollector import MetricsCollector

# pylint: disable=invalid-name


class _ProbeCollector:
	"""Collector that publishes a single named gauge."""

	def __init__(self, name, value):
		self.name = name
		self.value = value

	async def collect(self, registry):
		Gauge(self.name, 'probe', registry=registry).set(self.value)


class _CountingCollector:
	"""Collector that publishes how many times it has been asked to collect."""

	def __init__(self, name):
		self.name = name
		self.collect_count = 0

	async def collect(self, registry):
		self.collect_count += 1
		Gauge(self.name, 'probe', registry=registry).set(self.collect_count)


class _FailingCollector:
	"""Collector that raises where it should have reported."""

	@staticmethod
	async def collect(_registry):
		raise RuntimeError('source unavailable')


async def test_metrics_of_every_collector_land_in_one_registry():
	# Arrange:
	collectors = [_ProbeCollector('bridge_probe_one', 1), _ProbeCollector('bridge_probe_two', 2)]

	# Act:
	registry = await MetricsCollector(collectors).collect()

	# Assert:
	assert 1 == registry.get_sample_value('bridge_probe_one')
	assert 2 == registry.get_sample_value('bridge_probe_two')


async def test_each_scrape_builds_a_new_registry():
	# Arrange: the value changes per scrape, so a stale registry cannot pass unnoticed
	collector = MetricsCollector([_CountingCollector('bridge_probe_one')])

	# Act: reusing one registry across scrapes would fail on the second gauge registration
	await collector.collect()
	registry = await collector.collect()

	# Assert:
	assert 2 == registry.get_sample_value('bridge_probe_one')


async def test_a_failing_collector_fails_the_scrape():
	# Arrange: a collector is expected to report the failure of its own source as a metric, so
	# anything raising here is a defect and must not be hidden behind a successful scrape
	collector = MetricsCollector([_FailingCollector(), _ProbeCollector('bridge_probe_one', 7)])

	# Act + Assert:
	with pytest.raises(RuntimeError):
		await collector.collect()

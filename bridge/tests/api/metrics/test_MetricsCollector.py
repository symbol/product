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


class _FailingCollector:
	"""Collector that raises where it should have reported."""

	@staticmethod
	async def collect(_registry):
		raise RuntimeError('source unavailable')


def _patch_collectors(monkeypatch, collectors):
	monkeypatch.setattr('bridge.api.metrics.MetricsCollector.load_collectors', lambda _context, _timeout_seconds: collectors)


async def test_metrics_of_every_collector_land_in_one_registry(monkeypatch):
	# Arrange:
	_patch_collectors(monkeypatch, [_ProbeCollector('bridge_probe_one', 1), _ProbeCollector('bridge_probe_two', 2)])

	# Act:
	registry = await MetricsCollector(None).collect()

	# Assert:
	assert 1 == registry.get_sample_value('bridge_probe_one')
	assert 2 == registry.get_sample_value('bridge_probe_two')


async def test_each_scrape_starts_from_an_empty_registry(monkeypatch):
	# Arrange:
	_patch_collectors(monkeypatch, [_ProbeCollector('bridge_probe_one', 1)])
	collector = MetricsCollector(None)

	# Act: a second scrape must not collide with the gauges registered by the first
	await collector.collect()
	registry = await collector.collect()

	# Assert:
	assert 1 == registry.get_sample_value('bridge_probe_one')


async def test_a_failing_collector_does_not_prevent_the_others(monkeypatch):
	# Arrange: one collector raises where it should have reported, the other works
	_patch_collectors(monkeypatch, [_FailingCollector(), _ProbeCollector('bridge_probe_one', 7)])

	# Act:
	registry = await MetricsCollector(None).collect()

	# Assert: the scrape still succeeds and keeps everything the healthy collector produced
	assert 7 == registry.get_sample_value('bridge_probe_one')


async def test_a_failing_collector_is_logged(monkeypatch, caplog):
	# Arrange:
	_patch_collectors(monkeypatch, [_FailingCollector()])

	# Act:
	with caplog.at_level('ERROR'):
		await MetricsCollector(None).collect()

	# Assert: a swallowed failure must still be visible somewhere
	assert '_FailingCollector' in caplog.text

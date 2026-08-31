from bridge.api.metrics.ChainCollector import ChainCollector
from bridge.api.metrics.MetricsLoader import load_collectors
from bridge.api.metrics.PriceOracleCollector import PriceOracleCollector
from bridge.api.metrics.VaultCollector import VaultCollector
from bridge.api.metrics.WrapRequestCollector import WrapRequestCollector

# pylint: disable=invalid-name


def test_every_collector_is_loaded():
	# Act:
	collectors = load_collectors(None, 3)

	# Assert:
	assert [
		ChainCollector, PriceOracleCollector, VaultCollector, WrapRequestCollector
	] == [type(collector) for collector in collectors]


def test_loaded_collectors_are_given_the_context_and_timeout():
	# Act:
	collectors = load_collectors('context', 7)

	# Assert:
	assert ['context'] * 4 == [collector.context for collector in collectors]
	assert [7, 7, 7] == [collector.timeout_seconds for collector in collectors[:3]]

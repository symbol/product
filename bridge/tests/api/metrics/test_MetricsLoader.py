from bridge.api.metrics.ChainCollector import ChainCollector
from bridge.api.metrics.MetricsLoader import load_collectors
from bridge.api.metrics.PriceOracleCollector import PriceOracleCollector
from bridge.api.metrics.VaultCollector import VaultCollector
from bridge.api.metrics.WrapRequestCollector import WrapRequestCollector

# pylint: disable=invalid-name

# collectors that read remote endpoints and are given a timeout; WrapRequestCollector reads local databases, so it is not among them
TIMEOUT_AWARE_COLLECTOR_TYPES = (ChainCollector, PriceOracleCollector, VaultCollector)

ALL_COLLECTOR_TYPES = TIMEOUT_AWARE_COLLECTOR_TYPES + (WrapRequestCollector,)


def _map_collectors_by_type(collectors):
	"""Maps collectors by type so that assertions do not depend on load order."""

	return {type(collector): collector for collector in collectors}


def test_every_collector_is_loaded():
	# Act:
	collectors = load_collectors(None, 3)

	# Assert:
	assert set(ALL_COLLECTOR_TYPES) == set(_map_collectors_by_type(collectors))
	assert len(ALL_COLLECTOR_TYPES) == len(collectors)


def test_loaded_collectors_are_given_the_context_and_timeout():
	# Act:
	collectors = _map_collectors_by_type(load_collectors('context', 7))

	# Assert:
	for collector_type in ALL_COLLECTOR_TYPES:
		assert 'context' == collectors[collector_type].context, collector_type.__name__

	for collector_type in TIMEOUT_AWARE_COLLECTOR_TYPES:
		assert 7 == collectors[collector_type].timeout_seconds, collector_type.__name__

	assert not hasattr(collectors[WrapRequestCollector], 'timeout_seconds')

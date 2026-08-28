from bridge.api.metrics.ChainCollector import ChainCollector
from bridge.api.metrics.MetricsLoader import load_collectors
from bridge.api.metrics.WrapRequestCollector import WrapRequestCollector

# pylint: disable=invalid-name


def test_every_collector_is_loaded():
	# Act:
	collectors = load_collectors(None, 3)

	# Assert:
	assert [ChainCollector, WrapRequestCollector] == [type(collector) for collector in collectors]


def test_loaded_collectors_are_given_the_context_and_timeout():
	# Act:
	collectors = load_collectors('context', 7)

	# Assert:
	assert 'context' == collectors[0].context
	assert 7 == collectors[0].timeout_seconds

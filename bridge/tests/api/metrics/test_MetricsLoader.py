from bridge.api.metrics.ChainCollector import ChainCollector
from bridge.api.metrics.MetricsLoader import load_collectors

# pylint: disable=invalid-name


def test_chain_collector_is_always_loaded():
	# Act:
	collectors = load_collectors(None, 3)

	# Assert:
	assert 1 == len(collectors)
	assert isinstance(collectors[0], ChainCollector)


def test_loaded_collectors_are_given_the_context_and_timeout():
	# Act:
	collectors = load_collectors('context', 7)

	# Assert:
	assert 'context' == collectors[0].context
	assert 7 == collectors[0].timeout_seconds

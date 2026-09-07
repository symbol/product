from collections import namedtuple

from prometheus_client import CollectorRegistry

from bridge.api.metrics.BridgeInfoCollector import BridgeInfoCollector
from bridge.models.BridgeConfiguration import StrategyMode

# pylint: disable=invalid-name

NetworkConfiguration = namedtuple('NetworkConfiguration', ['blockchain'])
Facade = namedtuple('Facade', ['config'])


# region test utils

class _Context:
	"""Stands in for BridgeContext, which only supplies configuration here."""

	def __init__(self, strategy_mode, native_blockchain, wrapped_blockchain):
		self.strategy_mode = strategy_mode
		self.native_facade = Facade(NetworkConfiguration(native_blockchain))
		self.wrapped_facade = Facade(NetworkConfiguration(wrapped_blockchain))


async def _collect(context):
	registry = CollectorRegistry()
	await BridgeInfoCollector(context).collect(registry)
	return registry


def _info(registry, **labels):
	return registry.get_sample_value('bridge_info', labels)

# endregion


async def test_configuration_is_reported():
	# Arrange:
	context = _Context(StrategyMode.WRAP, 'symbol', 'ethereum')

	# Act:
	registry = await _collect(context)

	# Assert:
	assert 1 == _info(registry, mode='wrap', native_blockchain='symbol', wrapped_blockchain='ethereum')


async def test_mode_is_reported_in_lower_case():
	# Arrange: the mode is an enum, but a label filtered on in alert rules reads better in lower case
	context = _Context(StrategyMode.SWAP, 'nem', 'ethereum')

	# Act:
	registry = await _collect(context)

	# Assert:
	assert 1 == _info(registry, mode='swap', native_blockchain='nem', wrapped_blockchain='ethereum')


async def test_exactly_one_sample_is_published():
	# Arrange:
	context = _Context(StrategyMode.STAKE, 'symbol', 'ethereum')

	# Act:
	registry = await _collect(context)

	# Assert: an info metric describes the instance, so a second sample would mean a second bridge
	family = next(family for family in registry.collect() if 'bridge_info' == family.name)
	assert 1 == len(family.samples)
	assert 'stake' == family.samples[0].labels['mode']

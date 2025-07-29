from .nem.NemNetworkFacade import NemNetworkFacade
from .symbol.SymbolNetworkFacade import SymbolNetworkFacade


async def load_network_facade(config):
	"""Loads a network facade for the specified blockchain."""

	if 'nem' == config.blockchain:
		facade = NemNetworkFacade(config)
	elif 'symbol' == config.blockchain:
		facade = SymbolNetworkFacade(config)
	else:
		raise ValueError(f'blockchain "{config.blockchain}" is unsupported')

	await facade.init()
	return facade

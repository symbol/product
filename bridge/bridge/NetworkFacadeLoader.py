from .nem.NemNetworkFacade import NemNetworkFacade
from .symbol.SymbolNetworkFacade import SymbolNetworkFacade


async def load_network_facade(config):
	"""Loads a network facade for the specified blockchain."""

	if 'nem' == config.blockchain:
		return NemNetworkFacade(config.network)

	if 'symbol' == config.blockchain:
		facade = SymbolNetworkFacade(config.network)
		await facade.load_currency_mosaic_ids(config.endpoint)
		return facade

	raise ValueError(f'blockchain "{config.blockchain}" is unsupported')

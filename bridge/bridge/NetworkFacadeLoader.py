from .ethereum.EthereumNetworkFacade import EthereumNetworkFacade
from .nem.NemNetworkFacade import NemNetworkFacade
from .symbol.SymbolNetworkFacade import SymbolNetworkFacade


async def load_network_facade(config):
	"""Loads a network facade for the specified blockchain."""

	blockchain_to_class_map = {
		'ethereum': EthereumNetworkFacade,
		'nem': NemNetworkFacade,
		'symbol': SymbolNetworkFacade
	}

	network_facade_class = blockchain_to_class_map.get(config.blockchain, None)
	if not network_facade_class:
		raise ValueError(f'blockchain "{config.blockchain}" is unsupported')

	facade = network_facade_class(config)
	await facade.init()
	return facade

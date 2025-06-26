from .nem.NemNetworkFacade import NemNetworkFacade


def load_network_facade(blockchain, network_name):
	"""Loads a network facade for the specified blockchain."""

	if 'nem' == blockchain:
		return NemNetworkFacade(network_name)

	raise ValueError(f'blockchain "{blockchain}" is unsupported')

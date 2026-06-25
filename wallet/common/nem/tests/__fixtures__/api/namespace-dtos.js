// Real NEM namespace DTO shapes from the NIS API documentation.

// A namespace entry as returned by /account/namespace/page (wrapped in meta + namespace).
export const accountNamespaceDTO = {
	meta: { id: 26264 },
	namespace: {
		fqn: 'makoto.metal.coins',
		owner: 'TD3RXTHBLK6J3UD2BH2PXSOFLPWZOTR34WCG4HXH',
		height: 13465
	}
};

// A namespace as returned by /namespace (the namespace object directly, no wrapper).
export const namespaceInfoDTO = {
	fqn: 'makoto.metal.coins',
	owner: 'TD3RXTHBLK6J3UD2BH2PXSOFLPWZOTR34WCG4HXH',
	height: 13465
};

export const networkCurrency = {
	id: 'ETH',
	name: 'ETH',
	divisibility: 18
};

export const networkProperties = {
	nodeUrl: 'https://ethereum-node-url.net',
	networkIdentifier: 'testnet',
	networkCurrency: { ...networkCurrency }
};

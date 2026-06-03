// NEM testnet network properties used across the transaction mapping fixtures.
// `networkTime` is only consumed when mapping a transaction to a NEM SDK object (transaction-to-nem);
// the from-dto mapper ignores it.
export const networkProperties = {
	nodeUrl: 'http://localhost:7890',
	networkIdentifier: 'testnet',
	networkTime: 254452058000,
	networkCurrency: {
		name: 'XEM',
		mosaicId: 'nem.xem',
		divisibility: 6
	}
};

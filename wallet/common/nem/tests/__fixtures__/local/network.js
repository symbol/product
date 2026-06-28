export const networkProperties = {
	nodeUrl: 'http://localhost:7890',
	networkIdentifier: 'testnet',
	networkTime: 254452058000,
	networkCurrency: {
		name: 'XEM',
		mosaicId: 'nem.xem',
		divisibility: 6
	},
	rentalFees: {
		rootNamespaceFee: 100000000,
		subNamespaceFee: 10000000,
		mosaicDefinitionFee: 10000000
	}
};

// The NetworkInfo assembled by NetworkService.fetchNetworkInfo.
export const networkInfo = {
	...networkProperties,
	wsUrl: 'ws://localhost:7778/w/messages',
	generationHash: '',
	chainHeight: 4368990,
	blockGenerationTargetTime: 60,
	epochAdjustment: 1427587585
};

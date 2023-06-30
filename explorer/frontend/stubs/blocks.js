import symbolSDK from 'symbol-sdk';

export const getBlocksStub = async searchCriteria => {
	const { pageNumber, pageSize } = searchCriteria;

	const blocks = new Array(pageSize).fill(null).map((_, index) => {
		const transactionCount = Math.floor(Math.random() * 20 + 2);
		const timestamp = new Date(Date.now() - 15 * index * 1000).getTime();
		const transactionFees = new Array(transactionCount).fill(null).map(() => ({
			fee: Math.floor(Math.random() * 100 + 5) / 100,
			size: Math.floor(Math.random() * 300 + 100)
		}));

		const facade = new symbolSDK.facade.NemFacade('testnet');
		const key_pair1 = new symbolSDK.facade.NemFacade.KeyPair(symbolSDK.PrivateKey.random());
		const address1 = facade.network.publicKeyToAddress(key_pair1.publicKey);

		const key_pair2 = new symbolSDK.facade.NemFacade.KeyPair(symbolSDK.PrivateKey.random());
		const address2 = facade.network.publicKeyToAddress(key_pair2.publicKey);
		const totalFee = +transactionFees.reduce((partialSum, a) => partialSum + a.fee, 0).toFixed(2);
		return {
			height: 3999820 - index - pageNumber * pageSize,
			timestamp,
			harvester: address1.toString(),
			beneficiary: address2.toString(),
			transactionCount,
			statementCount: Math.floor(Math.random() * 10),
			size: 964,
			difficulty: 107.33,
			version: 1,
			hash: '019457123FD44E5F760314C88E8BCF54EC2436C6773E03C63D4645165BED4437',
			signature:
				'e501a79f97bef4386e11e54dc52e297a180f9faece4bf0063798c56dc1e74bf1e210e31a6516cdd8e8e0cc91314502885e0f9943aa44ead26ab623bf1abafc02',
			totalFee,
			medianFee: +(totalFee / transactionFees.length).toFixed(2),
			reward: +transactionFees.reduce((partialSum, a) => partialSum + a.fee, 0).toFixed(2),
			transactionFees
		};
	});

	return Promise.resolve(pageNumber === 10 ? [] : blocks);
};

export const getBlockInfoStub = async height => {
	const transactionCount = Math.floor(Math.random() * 20 + 2);
	const timestamp = new Date(Date.now() - 15 * 60000).getTime();
	const transactionFees = new Array(transactionCount).fill(null).map(() => ({
		fee: Math.floor(Math.random() * 100 + 5) / 100,
		size: Math.floor(Math.random() * 300 + 100)
	}));

	const facade = new symbolSDK.facade.NemFacade('testnet');
	const key_pair1 = new symbolSDK.facade.NemFacade.KeyPair(symbolSDK.PrivateKey.random());
	const address1 = facade.network.publicKeyToAddress(key_pair1.publicKey);

	const key_pair2 = new symbolSDK.facade.NemFacade.KeyPair(symbolSDK.PrivateKey.random());
	const address2 = facade.network.publicKeyToAddress(key_pair2.publicKey);

	const totalFee = +transactionFees.reduce((partialSum, a) => partialSum + a.fee, 0).toFixed(2);

	return {
		height,
		timestamp,
		harvester: address1.toString(),
		beneficiary: address2.toString(),
		transactionCount,
		statementCount: Math.floor(Math.random() * 10),
		size: 964,
		difficulty: 107.33,
		version: 1,
		hash: '019457123FD44E5F760314C88E8BCF54EC2436C6773E03C63D4645165BED4437',
		signature:
			'e501a79f97bef4386e11e54dc52e297a180f9faece4bf0063798c56dc1e74bf1e210e31a6516cdd8e8e0cc91314502885e0f9943aa44ead26ab623bf1abafc02',
		totalFee,
		medianFee: +(totalFee / transactionFees.length).toFixed(2),
		reward: +transactionFees.reduce((partialSum, a) => partialSum + a.fee, 0).toFixed(2),
		transactionFees
	};
};

import symbolSDK from 'symbol-sdk';

export const getTransactionsStub = async (searchCriteria, group) => {
	const { pageNumber, pageSize } = searchCriteria;
	const transactions = new Array(pageSize).fill(null).map((_, index) => {
		const facade = new symbolSDK.facade.NemFacade('testnet');
		const key_pair1 = new symbolSDK.facade.NemFacade.KeyPair(symbolSDK.PrivateKey.random());
		const address1 = facade.network.publicKeyToAddress(key_pair1.publicKey);

		const key_pair2 = new symbolSDK.facade.NemFacade.KeyPair(symbolSDK.PrivateKey.random());
		const address2 = facade.network.publicKeyToAddress(key_pair2.publicKey);

		const timestamp =
			group === 'confirmed'
				? new Date(Date.now() - 15 * index * 60000).getTime()
				: new Date(Date.now() + 15 * 60000 + index).getTime();

		return {
			group,
			type: 'transfer',
			hash: address2.toString().toLowerCase(),
			height: 3999820 - index - pageNumber * pageSize,
			timestamp,
			deadline: timestamp,
			signer: address1.toString(),
			recipient: address2.toString(),
			fee: Math.floor(Math.random() * 100 + 5) / 100,
			amount: Math.floor(Math.random() * 4000000) / 100
		};
	});

	return Promise.resolve(transactions);
};

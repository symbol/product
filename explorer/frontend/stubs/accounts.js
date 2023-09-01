import symbolSDK from 'symbol-sdk';

export const getAccountsStub = async searchCriteria => {
	const { pageNumber, pageSize } = searchCriteria;
	const data = new Array(pageSize).fill(null).map((_, index) => {
		const facade = new symbolSDK.facade.NemFacade('testnet');
		const key_pair1 = new symbolSDK.facade.NemFacade.KeyPair(symbolSDK.PrivateKey.random());
		const address1 = facade.network.publicKeyToAddress(key_pair1.publicKey);

		return {
			address: address1.toString(),
			name: '',
			description: '',
			balance: Math.floor(1787990951624116 / (index + 1 + (pageNumber - 1) * pageSize)) / 1000000,
			importance: Math.floor(20624116 / (index + 1 + (pageNumber - 1) * pageSize)) / 1000000
		};
	});

	return Promise.resolve(data);
};

export const getAccountInfoStub = async address => {
	const key_pair1 = new symbolSDK.facade.NemFacade.KeyPair(symbolSDK.PrivateKey.random());

	return {
		address,
		publicKey: key_pair1.publicKey.toString(),
		balance: 8423.142938,
		balanceUSD: 10000,
		height: 458880,
		importance: 0.037,
		vestedBalance: 8423.142938,
		names: ['namespace.account', 'another.name'],
		namespaces: [
			{
				id: 'namespace.account',
				name: 'namespace.account',
				linkedId: address
			},
			{
				id: 'namespace.supercoin',
				name: 'namespace.supercoin',
				linkedId: 'supercoin'
			}
		],
		mosaics: [
			{
				id: '6BED913FA20223F8',
				name: 'nem.xem',
				amount: '8423.142938',
				isCreatedByAccount: false
			},
			{
				id: '5AED903FB202130B',
				name: 'namespace.supercoin',
				amount: 1,
				isCreatedByAccount: true
			}
		]
	};
};

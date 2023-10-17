import symbolSDK from 'symbol-sdk';

export const getTransactionChartStub = async filter => {
	switch (filter) {
		case 'perDay':
			return new Array(90)
				.fill(null)
				.map((_, index) => [
					new Date(Date.now() - 60 * Math.abs(index - 89) * 60000 * 24).getTime(),
					Math.floor(Math.random() * 10 + 2)
				]);
		case 'perMonth':
			return new Array(36)
				.fill(null)
				.map((_, index) => [
					new Date(Date.now() - 60 * Math.abs(index - 35) * 60000 * 24 * 31).getTime(),
					Math.floor(Math.random() * 100 + 300 + Math.log(index * 20) * 50)
				]);
		default:
			return new Array(240)
				.fill(null)
				.map((_, index) => [3999770 + index, Math.floor(Math.random() * 100 + 300 + Math.log(index * 20) * 50)]);
	}
};

const getAccountsStub = async searchCriteria => {
	const { pageNumber, pageSize } = searchCriteria;
	const data = new Array(pageSize).fill(null).map((_, index) => {
		const facade = new symbolSDK.facade.NemFacade('mainnet');
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

export const getAccountChartsStub = async () => {
	const accounts = (await getAccountsStub({ pageNumber: 1, pageSize: 10 })).slice(0, 9);

	return {
		importanceBreakdown: [...accounts.map(account => [account.importance, account.address]), [48.9, 'Rest']],
		harvestingImportance: [
			[34.54, 'Harvesting'],
			[65.46, 'Not harvesting']
		]
	};
};

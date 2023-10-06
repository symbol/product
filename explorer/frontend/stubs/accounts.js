import { getMosaicPage } from '@/pages/api/mosaics';
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
	const facade = new symbolSDK.facade.NemFacade('testnet');
	const key_pair1 = new symbolSDK.facade.NemFacade.KeyPair(symbolSDK.PrivateKey.random());
	const address1 = facade.network.publicKeyToAddress(key_pair1.publicKey);
	const key_pair2 = new symbolSDK.facade.NemFacade.KeyPair(symbolSDK.PrivateKey.random());
	const address2 = facade.network.publicKeyToAddress(key_pair2.publicKey);
	const key_pair3 = new symbolSDK.facade.NemFacade.KeyPair(symbolSDK.PrivateKey.random());
	const address3 = facade.network.publicKeyToAddress(key_pair3.publicKey);
	const key_pair4 = new symbolSDK.facade.NemFacade.KeyPair(symbolSDK.PrivateKey.random());
	const address4 = facade.network.publicKeyToAddress(key_pair4.publicKey);
	const mosaics = (await getMosaicPage({ pageSize: 10 })).data;

	let minCosignatories = 0;
	let cosignatoryOf = [];
	let cosignatories = [];

	if (address[1] === 'A') {
		minCosignatories = 2;
		cosignatories = [address2.toString(), address3.toString(), address4.toString()];
	}
	if (address[1] === 'B') {
		cosignatoryOf = [address2.toString(), address3.toString()];
	}

	return {
		remoteAddress: address1.toString(),
		address,
		publicKey: key_pair1.publicKey.toString(),
		remarkLabel: 'Lorem ipsum',
		balance: 8423.142938,
		vestedBalance: 8423.142938,
		mosaics: mosaics.map(mos => ({
			...mos,
			amount: (Math.random() * 10000).toFixed()
		})),
		importance: 0,
		harvestedBlocks: 1200,
		harvestedFees: 137,
		harvestStatus: 'locked',
		harvestRemoteStatus: 'active',
		createdHeight: 73737,
		minCosignatories,
		cosignatoryOf,
		cosignatories
	};
};

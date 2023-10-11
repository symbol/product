import { fetchMosaicPage } from '@/api/mosaics';
import symbolSDK from 'symbol-sdk';

export const getAccountsStub = async searchCriteria => {
	const { pageNumber } = searchCriteria;

	const response = await fetch('https://explorer.nemtool.com/account/accountList', {
		method: 'POST',
		body: {
			pageNumber
		}
	});

	return (await response.json()).map(item => ({
		...item,
		balance: item.balance / 1000000,
		importance: + item.importance.toFixed(5),
		description: item.remark || ''
	}));
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
	const mosaics = (await fetchMosaicPage({ pageSize: 10 })).data;

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

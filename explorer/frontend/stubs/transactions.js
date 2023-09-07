import config from '@/config';
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
			height: 3999820 - pageNumber * pageSize,
			timestamp,
			deadline: timestamp,
			signer: address1.toString(),
			recipient: address2.toString(),
			fee: Math.floor(Math.random() * 100 + 5) / 100,
			amount: Math.floor(Math.random() * 4000000) / 100,
			account: address2.toString(),
			direction: Math.random() < 0.5 ? 'incoming' : 'outgoing'
		};
	});

	return Promise.resolve(transactions);
};

export const getTransactionInfoStub = async hash => {
	const timestamp = new Date(Date.now() - 15 * 60000).getTime();

	const facade = new symbolSDK.facade.NemFacade('testnet');
	const key_pair1 = new symbolSDK.facade.NemFacade.KeyPair(symbolSDK.PrivateKey.random());
	const address1 = facade.network.publicKeyToAddress(key_pair1.publicKey);

	const key_pair2 = new symbolSDK.facade.NemFacade.KeyPair(symbolSDK.PrivateKey.random());
	const address2 = facade.network.publicKeyToAddress(key_pair2.publicKey);

	const mosaics = [
		{
			id: config.NATIVE_MOSAIC_ID,
			name: 'NEM.XEM',
			amount: Math.floor(Math.random() * 4000000) / 100
		},
		{
			id: '5AED903FB202130B',
			name: 'namespace.supercoin',
			amount: Math.floor(Math.random() * 40)
		},
		{
			id: 'BECD903AB20213AA',
			name: 'tomato.nft',
			amount: 1
		}
	].slice(0, Math.round(Math.random() * 2 + 1));

	return {
		type: 'transfer',
		group: 'confirmed',
		hash,
		timestamp,
		sender: address1.toString(),
		size: 964,
		height: 423423,
		version: 1,
		signature:
			'e501a79f97bef4386e11e54dc52e297a180f9faece4bf0063798c56dc1e74bf1e210e31a6516cdd8e8e0cc91314502885e0f9943aa44ead26ab623bf1abafc02',
		fee: Math.floor(Math.random() * 100 + 5) / 100,

		body: [
			{
				type: 'transfer',
				sender: address1.toString(),
				recipient: address2.toString(),
				mosaics,
				message: {
					text: 'Hello',
					isEncrypted: false
				}
			}
		]
	};
};

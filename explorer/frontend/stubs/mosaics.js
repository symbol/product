import symbolSDK from 'symbol-sdk';

export const getMosaicInfoStub = async id => {
	const facade = new symbolSDK.facade.NemFacade('testnet');
	const key_pair1 = new symbolSDK.facade.NemFacade.KeyPair(symbolSDK.PrivateKey.random());
	const address1 = facade.network.publicKeyToAddress(key_pair1.publicKey);

	const key_pair2 = new symbolSDK.facade.NemFacade.KeyPair(symbolSDK.PrivateKey.random());
	const address2 = facade.network.publicKeyToAddress(key_pair2.publicKey);

	const names = ['mosaic.name', 'another.name'];

	return {
		id,
		names,
		name: names[0],
		isTransferable: true,
		isSupplyMutable: false,
		description: 'Mosaic description, lorem ipsum dolor sit amet, consectur',
		supply: 7904590852.347254,
		divisibility: 6,
		creator: address1.toString(),
		revision: 1,
		registrationHeight: 1887726,
		expirationHeight: 2887726,
		expireIn: 2887726 - 1887726,

		levy: {
			type: 'absolute_fee',
			mosaic: 'nem.xem',
			fee: 0.000017,
			recipient: address2.toString()
		}
	};
};

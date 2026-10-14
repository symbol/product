export const nativeMosaic = {
	id: 'nem.xem',
	name: 'nem.xem',
	namespaceName: 'nem.xem',
	rootNamespaceName: 'nem',
	creator: 'TAUKHZ5VAUMJ7WG6CZLTVEJERBUZ3Y5EL7SXZVJP',
	description: 'network currency',
	divisibility: 6,
	initialSupply: 8999999999,
	supply: 8999999999,
	registrationHeight: 1,
	registrationTimestamp: '2015-03-29 00:06:25',
	namespaceRegistrationHeight: 1,
	namespaceExpirationHeight: 0,
	namespaceExpirationTimestamp: '2015-03-29 00:06:25',
	isUnlimitedDuration: true,
	isSupplyMutable: false,
	isTransferable: true,
	levy: null
};

export const customMosaic = {
	id: 'testnamespace1.mosaic',
	name: 'testnamespace1.mosaic',
	namespaceName: 'testnamespace1.mosaic',
	rootNamespaceName: 'testnamespace1',
	creator: 'TAYFGZ5O7HIVF3P4FDLKMBAYPN3HPINM4B6HAVTA',
	description: 'Test mosaic',
	divisibility: 3,
	initialSupply: 100000000,
	supply: 100000000,
	registrationHeight: 652325,
	registrationTimestamp: '2026-06-10 11:50:26',
	namespaceRegistrationHeight: 522115,
	namespaceExpirationHeight: 1047715,
	namespaceExpirationTimestamp: '2026-03-11 07:06:50',
	isUnlimitedDuration: false,
	isSupplyMutable: true,
	isTransferable: true,
	levy: null
};

export const customMosaicWithLevy = {
	id: 'exptst987457.sub1.levytoken',
	name: 'exptst987457.sub1.levytoken',
	namespaceName: 'exptst987457.sub1.levytoken',
	rootNamespaceName: 'exptst987457',
	creator: 'TB4ZDE2DJPB7UEG3FJXMI5EDXVW7LFBDZJAUCVIM',
	description: 'levy token',
	divisibility: 0,
	initialSupply: 10000,
	supply: 10000,
	registrationHeight: 678461,
	registrationTimestamp: '2026-06-28 19:09:32',
	namespaceRegistrationHeight: 676837,
	namespaceExpirationHeight: 1202437,
	namespaceExpirationTimestamp: '2026-06-27 15:44:09',
	isUnlimitedDuration: false,
	isSupplyMutable: true,
	isTransferable: true,
	levy: {
		fee: 0.000005,
		mosaic: 'nem.xem',
		recipient: 'TB4ZDE2DJPB7UEG3FJXMI5EDXVW7LFBDZJAUCVIM',
		type: 'absolute fee'
	}
};

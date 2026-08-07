export const mosaicCreatorAddress = 'TAWGTICRU4V7XYY25WTSKCWGY5D3OVYLH2OABNQ';
export const mosaicHolderAddress = 'TCQ3FQ6U4X3KPOGJBINSYPKOL5QHDAUTUS24NVY';

export const nativeMosaic = {
	id: '72C0212E67A08BCE',
	divisibility: 6,
	names: [
		'symbol.xym'
	],
	duration: 0,
	startHeight: 1,
	endHeight: 1,
	isUnlimitedDuration: true,
	creator: 'TCEUGLPCMO5Y72EEISSNUKGTMCN5RO4PVYMK5FI',
	supply: '8247523206.660532',
	isSupplyMutable: false,
	isTransferable: true,
	isRestrictable: false,
	isRevokable: false
};

export const multiNameMosaic = {
	id: '0E2B031D9C83906D',
	divisibility: 0,
	names: [
		'custom',
		'another'
	],
	duration: 0,
	startHeight: 1000,
	endHeight: 1000,
	isUnlimitedDuration: true,
	creator: mosaicCreatorAddress,
	supply: '1000',
	isSupplyMutable: false,
	isTransferable: true,
	isRestrictable: false,
	isRevokable: false
};

export const supplyMutableMosaic = {
	id: '78C3CDF0896248DB',
	divisibility: 2,
	names: [],
	duration: 0,
	startHeight: 1000,
	endHeight: 1000,
	isUnlimitedDuration: true,
	creator: 'TAMYTGVH3UEVZRQSD64LGSMPKNTKMASOIDNYROI',
	supply: '10',
	isSupplyMutable: true,
	isTransferable: true,
	isRestrictable: false,
	isRevokable: false
};

export const supplyImmutableMosaic = {
	id: '3FE10802C3B2DD8C',
	divisibility: 2,
	names: [],
	duration: 0,
	startHeight: 1000,
	endHeight: 1000,
	isUnlimitedDuration: true,
	creator: 'TAMYTGVH3UEVZRQSD64LGSMPKNTKMASOIDNYROI',
	supply: '10',
	isSupplyMutable: false,
	isTransferable: true,
	isRestrictable: false,
	isRevokable: false
};

export const expiringSupplyMutableMosaic = {
	id: '1213766D49458631',
	divisibility: 6,
	names: [
		'custom-3'
	],
	duration: 100,
	startHeight: 1000,
	endHeight: 1100,
	isUnlimitedDuration: false,
	creator: mosaicCreatorAddress,
	supply: '0.001',
	isSupplyMutable: true,
	isTransferable: true,
	isRestrictable: false,
	isRevokable: false
};

export const expiringSupplyImmutableMosaic = {
	id: '699E9532708D2FB8',
	divisibility: 6,
	names: [
		'custom-4'
	],
	duration: 100,
	startHeight: 1000,
	endHeight: 1100,
	isUnlimitedDuration: false,
	creator: mosaicCreatorAddress,
	supply: '0.001',
	isSupplyMutable: false,
	isTransferable: true,
	isRestrictable: false,
	isRevokable: false
};

export const revokableMosaic = {
	id: '5C4D3A2B1E9F8071',
	divisibility: 2,
	names: [
		'custom-5'
	],
	duration: 100,
	startHeight: 1000,
	endHeight: 1100,
	isUnlimitedDuration: false,
	creator: mosaicCreatorAddress,
	supply: '10',
	isSupplyMutable: true,
	isTransferable: true,
	isRestrictable: false,
	isRevokable: true
};

const mosaicList = [
	nativeMosaic,
	multiNameMosaic,
	supplyMutableMosaic,
	supplyImmutableMosaic,
	expiringSupplyMutableMosaic,
	expiringSupplyImmutableMosaic,
	revokableMosaic
];

export const mosaicInfos = Object.fromEntries(mosaicList.map(mosaic => [mosaic.id, mosaic]));

export const mosaicNames = Object.fromEntries(mosaicList.map(mosaic => [mosaic.id, mosaic.names]));

export const mosaicOwners = [
	{
		address: mosaicCreatorAddress,
		amount: '15000'
	},
	{
		address: mosaicHolderAddress,
		amount: '2500'
	}
];

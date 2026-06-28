// Real NEM mosaic DTO shapes from the NIS API documentation.

// A mosaic definition as returned by /namespace/mosaic/definition/page (and /account/mosaic/definition/page).
// Parses to mosaicInfos['test.token'] in local/mosaic.js.
export const mosaicDefinitionDTO = {
	creator: '10cfe522fe23c015b8ab24ef6a0c32c5de78eb55b2152ed07b6a092121187100',
	id: { namespaceId: 'test', name: 'token' },
	description: 'Test token',
	properties: [
		{ name: 'divisibility', value: '2' },
		{ name: 'initialSupply', value: '10000' },
		{ name: 'supplyMutable', value: 'false' },
		{ name: 'transferable', value: 'true' }
	]
};

export const subNamespaceMosaicDefinitionDTO = {
	creator: '10cfe522fe23c015b8ab24ef6a0c32c5de78eb55b2152ed07b6a092121187100',
	id: { namespaceId: 'makoto.metals', name: 'silver' },
	description: 'Silver',
	properties: [
		{ name: 'divisibility', value: '2' },
		{ name: 'initialSupply', value: '10000' },
		{ name: 'supplyMutable', value: 'false' },
		{ name: 'transferable', value: 'true' }
	]
};

// Mosaics owned by an account as returned by /account/mosaic/owned. The native currency (nem.xem) and a
// custom mosaic (test.token) resolve against known definitions; unknown.mosaic has no resolved definition.
export const ownedMosaicDTOs = [
	{ mosaicId: { namespaceId: 'nem', name: 'xem' }, quantity: 1500000 },
	{ mosaicId: { namespaceId: 'test', name: 'token' }, quantity: 250 },
	{ mosaicId: { namespaceId: 'unknown', name: 'mosaic' }, quantity: 999 }
];

import { accounts } from '../local/wallet';

// Real NEM mosaic DTO shapes from the NIS API documentation.

const { alice } = accounts;

// A mosaic definition as returned by /namespace/mosaic/definition/page (and /account/mosaic/definition/page).
// Parses to tokenInfos['test.token'] in local/mosaic.js.
export const mosaicDefinitionDTO = {
	creator: alice.publicKey,
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
	creator: alice.publicKey,
	id: { namespaceId: 'makoto.metals', name: 'silver' },
	description: 'Silver',
	properties: [
		{ name: 'divisibility', value: '2' },
		{ name: 'initialSupply', value: '10000' },
		{ name: 'supplyMutable', value: 'false' },
		{ name: 'transferable', value: 'true' }
	]
};

export const mutableMosaicDefinitionDTO = {
	creator: alice.publicKey,
	id: { namespaceId: 'test', name: 'mutable' },
	description: 'Mutable token',
	properties: [
		{ name: 'divisibility', value: '2' },
		{ name: 'initialSupply', value: '10000' },
		{ name: 'supplyMutable', value: 'true' },
		{ name: 'transferable', value: 'true' }
	]
};

export const mutableMosaicSupplyDTO = {
	mosaicId: { namespaceId: 'test', name: 'mutable' },
	supply: 15000
};

// Mosaics owned by an account as returned by /account/mosaic/owned. The native currency (nem.xem) and a
// custom mosaic (test.token) resolve against known definitions; unknown.mosaic has no resolved definition.
export const ownedMosaicDTOs = [
	{ mosaicId: { namespaceId: 'nem', name: 'xem' }, quantity: 1500000 },
	{ mosaicId: { namespaceId: 'test', name: 'token' }, quantity: 250 },
	{ mosaicId: { namespaceId: 'unknown', name: 'mosaic' }, quantity: 999 }
];

export const ownedMosaicDefinitionDTOs = [
	{
		creator: '3e82e1c1e4a75adaa3cba8c101c3cd31d9817a2eb966eb3b511fb2ed45b8e262',
		id: { namespaceId: 'nem', name: 'xem' },
		description: 'reserved xem mosaic',
		properties: [
			{ name: 'divisibility', value: '6' },
			{ name: 'initialSupply', value: '8999999999' },
			{ name: 'supplyMutable', value: 'false' },
			{ name: 'transferable', value: 'true' }
		]
	},
	mosaicDefinitionDTO
];

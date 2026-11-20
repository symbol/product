// Independently specified frontend expectations for the contract-based API fixture.
export const namespace = {
	id: 'A95F1F8A96159516',
	name: 'symbol',
	namespaceName: 'symbol',
	namespaceLevels: [{ name: 'symbol', namespaceId: 'A95F1F8A96159516', parentId: null }],
	aliasType: 'none',
	aliasMosaicId: null,
	aliasAddress: null,
	creator: 'TCEUGLPCMO5Y72EEISSNUKGTMCN5RO4PVYMK5FI',
	registrationHeight: 10,
	startTimestamp: '2026-10-20 01:02:03',
	registrationTimestamp: '2026-10-20 01:02:03',
	registrationType: 'root',
	expirationHeight: 1000,
	isUnlimitedDuration: false,
	subNamespaceCount: 0,
	subNamespaces: [],
	subNamespaceHierarchy: [],
	namespaceMosaics: []
};

const mosaic = {
	id: '72C0212E67A08BCE',
	name: '72C0212E67A08BCE',
	creator: 'TCEUGLPCMO5Y72EEISSNUKGTMCN5RO4PVYMK5FI',
	aliasNames: ['symbol.xym', 'symbol.xym.leaf'],
	supply: 8388098149704674,
	divisibility: 6,
	value: 8388098149.704674,
	registrationHeight: 15,
	expirationHeight: 900,
	namespaceExpirationHeight: 900,
	isUnlimitedDuration: false,
	isSupplyMutable: false,
	isTransferable: true,
	isRestrictable: false,
	isRevokable: true,
	startTimestamp: '2026-10-20 02:03:04',
	registrationTimestamp: '2026-10-20 02:03:04'
};

const unlimitedMosaic = {
	...mosaic,
	id: '6BED913FA20223F8',
	name: '6BED913FA20223F8',
	aliasNames: ['symbol.coin'],
	supply: 0,
	divisibility: 0,
	value: 0,
	expirationHeight: null,
	namespaceExpirationHeight: null,
	isUnlimitedDuration: true,
	isRevokable: false,
	startTimestamp: null,
	registrationTimestamp: null
};

export const namespaceWithMosaics = {
	...namespace,
	subNamespaceCount: 3,
	subNamespaces: ['symbol.coin', 'symbol.xym', 'symbol.xym.leaf'],
	subNamespaceHierarchy: [
		{ namespaceId: 'BE6A7846D58B8FB8', namespaceName: 'symbol.coin', parentId: 'A95F1F8A96159516' },
		{ namespaceId: 'E74B99BA41F4AFEE', namespaceName: 'symbol.xym', parentId: 'A95F1F8A96159516' },
		{ namespaceId: 'D4B4FEF43E949B5F', namespaceName: 'symbol.xym.leaf', parentId: 'E74B99BA41F4AFEE' }
	],
	namespaceMosaics: [
		{ namespaceId: 'BE6A7846D58B8FB8', namespaceName: 'symbol.coin', data: [unlimitedMosaic] },
		{ namespaceId: 'E74B99BA41F4AFEE', namespaceName: 'symbol.xym', data: [mosaic] },
		{ namespaceId: 'D4B4FEF43E949B5F', namespaceName: 'symbol.xym.leaf', data: [mosaic] }
	]
};

export const childNamespace = {
	...namespace,
	id: 'E74B99BA41F4AFEE',
	name: 'symbol.xym',
	namespaceName: 'symbol.xym',
	namespaceLevels: [
		...namespace.namespaceLevels,
		{ name: 'xym', namespaceId: 'E74B99BA41F4AFEE', parentId: 'A95F1F8A96159516' }
	],
	aliasType: 'mosaic',
	aliasMosaicId: '72C0212E67A08BCE',
	registrationHeight: 20,
	startTimestamp: '2026-10-20 03:04:05',
	registrationTimestamp: '2026-10-20 03:04:05',
	registrationType: 'child',
	subNamespaceCount: 1,
	subNamespaces: ['symbol.xym.leaf'],
	subNamespaceHierarchy: [namespaceWithMosaics.subNamespaceHierarchy[2]],
	namespaceMosaics: namespaceWithMosaics.namespaceMosaics.slice(1)
};

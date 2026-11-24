// Contract-based test data, not captured responses. See REST SymbolRestFacade.try_get_namespace
// and tests/test_symbol_namespaces_routes_integration.py at 1e8f075b (2026-10-22).
export const namespaceResponse = {
	id: 'A95F1F8A96159516',
	name: 'A95F1F8A96159516',
	namespaceName: 'symbol',
	namespaceLevels: [{ name: 'symbol', namespaceId: 'A95F1F8A96159516', parentId: null }],
	aliasType: 'none',
	aliasMosaicId: null,
	aliasAddress: null,
	creator: 'TCEUGLPCMO5Y72EEISSNUKGTMCN5RO4PVYMK5FI',
	registrationHeight: 10,
	startTimestamp: '2026-10-20 01:02:03',
	registrationType: 'root',
	expirationHeight: 1000,
	isUnlimitedDuration: false,
	subNamespaceCount: 0,
	subNamespaces: [],
	namespaceMosaics: []
};

const mosaicResponse = {
	id: '72C0212E67A08BCE',
	creator: 'TCEUGLPCMO5Y72EEISSNUKGTMCN5RO4PVYMK5FI',
	aliasNames: ['symbol.xym', 'symbol.xym.leaf'],
	supply: 8388098149704674,
	divisibility: 6,
	value: 8388098149.704674,
	registrationHeight: 15,
	expirationHeight: 900,
	isUnlimitedDuration: false,
	isSupplyMutable: false,
	isTransferable: true,
	isRestrictable: false,
	isRevokable: true,
	startTimestamp: '2026-10-20 02:03:04'
};

const unlimitedMosaicResponse = {
	...mosaicResponse,
	id: '6BED913FA20223F8',
	aliasNames: ['symbol.coin'],
	supply: 0,
	divisibility: 0,
	value: 0,
	expirationHeight: null,
	isUnlimitedDuration: true,
	isRevokable: false,
	startTimestamp: null
};

export const namespaceWithMosaicsResponse = {
	...namespaceResponse,
	subNamespaceCount: 3,
	subNamespaces: [
		{ namespaceId: 'BE6A7846D58B8FB8', namespaceName: 'symbol.coin', parentId: 'A95F1F8A96159516' },
		{ namespaceId: 'E74B99BA41F4AFEE', namespaceName: 'symbol.xym', parentId: 'A95F1F8A96159516' },
		{ namespaceId: 'D4B4FEF43E949B5F', namespaceName: 'symbol.xym.leaf', parentId: 'E74B99BA41F4AFEE' }
	],
	namespaceMosaics: [
		{ namespaceId: 'BE6A7846D58B8FB8', namespaceName: 'symbol.coin', data: [unlimitedMosaicResponse] },
		{ namespaceId: 'E74B99BA41F4AFEE', namespaceName: 'symbol.xym', data: [mosaicResponse] },
		{ namespaceId: 'D4B4FEF43E949B5F', namespaceName: 'symbol.xym.leaf', data: [mosaicResponse] }
	]
};

export const childNamespaceResponse = {
	...namespaceResponse,
	id: 'E74B99BA41F4AFEE',
	name: 'E74B99BA41F4AFEE',
	namespaceName: 'symbol.xym',
	namespaceLevels: [
		...namespaceResponse.namespaceLevels,
		{ name: 'xym', namespaceId: 'E74B99BA41F4AFEE', parentId: 'A95F1F8A96159516' }
	],
	aliasType: 'mosaic',
	aliasMosaicId: '72C0212E67A08BCE',
	registrationHeight: 20,
	startTimestamp: '2026-10-20 03:04:05',
	registrationType: 'child',
	subNamespaceCount: 1,
	subNamespaces: [namespaceWithMosaicsResponse.subNamespaces[2]],
	namespaceMosaics: namespaceWithMosaicsResponse.namespaceMosaics.slice(1)
};

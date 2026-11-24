export const unlimitedNamespaceResponse = {
	id: 'E74B99BA41F4AFEE',
	name: 'E74B99BA41F4AFEE',
	namespaceName: 'symbol.xym',
	rootNamespace: 'symbol',
	namespaceLevels: [
		{ name: 'symbol', namespaceId: 'A95F1F8A96159516', parentId: null },
		{ name: 'xym', namespaceId: 'E74B99BA41F4AFEE', parentId: 'A95F1F8A96159516' }
	],
	aliasType: 'mosaic',
	aliasMosaicId: '72C0212E67A08BCE',
	aliasAddress: null,
	owner: 'TCEUGLPCMO5Y72EEISSNUKGTMCN5RO4PVYMK5FI',
	registeredHeight: 1,
	registeredTimestamp: '2026-10-20 01:02:03',
	registrationType: 'child',
	expirationHeight: 0,
	subNamespaceCount: 0
};

export const finiteNamespaceResponse = {
	...unlimitedNamespaceResponse,
	expirationHeight: 1000
};

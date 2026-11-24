// Captured on 2026-10-22 (JST) from a dedicated REST instance after syncing blocks 1..20000.
// GET http://127.0.0.1:15149/api/symbol/namespaces?limit=100&offset=0&sort=DESC
// Node: https://201-sai-dual.symboltest.net:3001 (testnet).
// Namespace state is fetched from the current Node; this is not a historical height-20000 snapshot.
export const namespaceListResponse = [
	{
		aliasAddress: null,
		aliasMosaicId: '35560F7F050D47B3',
		aliasType: 'mosaic',
		creator: 'TA77LIQZ7OWKIIP5GPMLPQV7NJ27SYNA7WILGVQ',
		expirationHeight: 5194037,
		id: 'AAD57A7B49E88E51',
		isUnlimitedDuration: false,
		name: 'AAD57A7B49E88E51',
		namespaceLevels: [
			{
				name: 'pasomi',
				namespaceId: 'C440B80BCE158950',
				parentId: null
			},
			{
				name: 'ufn',
				namespaceId: 'AAD57A7B49E88E51',
				parentId: 'C440B80BCE158950'
			}
		],
		namespaceName: 'pasomi.ufn',
		registrationHeight: 6357,
		registrationType: 'child',
		startTimestamp: '2022-11-05 05:35:39',
		subNamespaceCount: 0
	},
	{
		aliasAddress: 'TBYPASOMI2FS4Z3VV6W4WPEI6I54A3GERLNEMIA',
		aliasMosaicId: null,
		aliasType: 'address',
		creator: 'TA77LIQZ7OWKIIP5GPMLPQV7NJ27SYNA7WILGVQ',
		expirationHeight: 5194037,
		id: 'C440B80BCE158950',
		isUnlimitedDuration: false,
		name: 'C440B80BCE158950',
		namespaceLevels: [
			{
				name: 'pasomi',
				namespaceId: 'C440B80BCE158950',
				parentId: null
			}
		],
		namespaceName: 'pasomi',
		registrationHeight: 6357,
		registrationType: 'root',
		startTimestamp: '2022-11-05 05:35:39',
		subNamespaceCount: 1
	},
	{
		aliasAddress: null,
		aliasMosaicId: null,
		aliasType: 'none',
		creator: 'TCEUGLPCMO5Y72EEISSNUKGTMCN5RO4PVYMK5FI',
		expirationHeight: null,
		id: 'A95F1F8A96159516',
		isUnlimitedDuration: true,
		name: 'A95F1F8A96159516',
		namespaceLevels: [
			{
				name: 'symbol',
				namespaceId: 'A95F1F8A96159516',
				parentId: null
			}
		],
		namespaceName: 'symbol',
		registrationHeight: 1,
		registrationType: 'root',
		startTimestamp: '2022-10-31 21:07:47',
		subNamespaceCount: 1
	},
	{
		aliasAddress: null,
		aliasMosaicId: '72C0212E67A08BCE',
		aliasType: 'mosaic',
		creator: 'TCEUGLPCMO5Y72EEISSNUKGTMCN5RO4PVYMK5FI',
		expirationHeight: null,
		id: 'E74B99BA41F4AFEE',
		isUnlimitedDuration: true,
		name: 'E74B99BA41F4AFEE',
		namespaceLevels: [
			{
				name: 'symbol',
				namespaceId: 'A95F1F8A96159516',
				parentId: null
			},
			{
				name: 'xym',
				namespaceId: 'E74B99BA41F4AFEE',
				parentId: 'A95F1F8A96159516'
			}
		],
		namespaceName: 'symbol.xym',
		registrationHeight: 1,
		registrationType: 'child',
		startTimestamp: '2022-10-31 21:07:47',
		subNamespaceCount: 0
	}
];

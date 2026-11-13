// Independently specified expectations for the captured API namespace-list fixture.
export const namespaceList = [
	{
		id: 'AAD57A7B49E88E51',
		name: 'pasomi.ufn',
		namespaceName: 'pasomi.ufn',
		namespaceLevels: [
			{ name: 'pasomi', namespaceId: 'C440B80BCE158950', parentId: null },
			{ name: 'ufn', namespaceId: 'AAD57A7B49E88E51', parentId: 'C440B80BCE158950' }
		],
		aliasType: 'mosaic',
		aliasMosaicId: '35560F7F050D47B3',
		aliasAddress: null,
		creator: 'TA77LIQZ7OWKIIP5GPMLPQV7NJ27SYNA7WILGVQ',
		registrationHeight: 6357,
		startTimestamp: '2022-11-05 05:35:39',
		registrationTimestamp: '2022-11-05 05:35:39',
		registrationType: 'child',
		expirationHeight: 5194037,
		isUnlimitedDuration: false,
		subNamespaceCount: 0
	},
	{
		id: 'C440B80BCE158950',
		name: 'pasomi',
		namespaceName: 'pasomi',
		namespaceLevels: [
			{ name: 'pasomi', namespaceId: 'C440B80BCE158950', parentId: null }
		],
		aliasType: 'address',
		aliasMosaicId: null,
		aliasAddress: 'TBYPASOMI2FS4Z3VV6W4WPEI6I54A3GERLNEMIA',
		creator: 'TA77LIQZ7OWKIIP5GPMLPQV7NJ27SYNA7WILGVQ',
		registrationHeight: 6357,
		startTimestamp: '2022-11-05 05:35:39',
		registrationTimestamp: '2022-11-05 05:35:39',
		registrationType: 'root',
		expirationHeight: 5194037,
		isUnlimitedDuration: false,
		subNamespaceCount: 1
	},
	{
		id: 'A95F1F8A96159516',
		name: 'symbol',
		namespaceName: 'symbol',
		namespaceLevels: [
			{ name: 'symbol', namespaceId: 'A95F1F8A96159516', parentId: null }
		],
		aliasType: 'none',
		aliasMosaicId: null,
		aliasAddress: null,
		creator: 'TCEUGLPCMO5Y72EEISSNUKGTMCN5RO4PVYMK5FI',
		registrationHeight: 1,
		startTimestamp: '2022-10-31 21:07:47',
		registrationTimestamp: '2022-10-31 21:07:47',
		registrationType: 'root',
		expirationHeight: null,
		isUnlimitedDuration: true,
		subNamespaceCount: 1
	},
	{
		id: 'E74B99BA41F4AFEE',
		name: 'symbol.xym',
		namespaceName: 'symbol.xym',
		namespaceLevels: [
			{ name: 'symbol', namespaceId: 'A95F1F8A96159516', parentId: null },
			{ name: 'xym', namespaceId: 'E74B99BA41F4AFEE', parentId: 'A95F1F8A96159516' }
		],
		aliasType: 'mosaic',
		aliasMosaicId: '72C0212E67A08BCE',
		aliasAddress: null,
		creator: 'TCEUGLPCMO5Y72EEISSNUKGTMCN5RO4PVYMK5FI',
		registrationHeight: 1,
		startTimestamp: '2022-10-31 21:07:47',
		registrationTimestamp: '2022-10-31 21:07:47',
		registrationType: 'child',
		expirationHeight: null,
		isUnlimitedDuration: true,
		subNamespaceCount: 0
	}
];

/** @typedef {import('@/contract/types/Contract').RequiredModuleExports} RequiredModuleExports */

/**
 * Required list of API modules expected for each variant.
 * @type {RequiredModuleExports[]}
 */
export const requiredApiModules = [
	{
		path: 'api/accounts',
		exportNames: [
			'fetchAccountHarvestedBlockPage',
			'fetchAccountInfo',
			'fetchAccountInfoByPublicKey',
			'fetchAccountPage'
		]
	},
	{
		path: 'api/blocks',
		exportNames: [
			'fetchBlockInfo',
			'fetchBlockPage',
			'fetchChainHight',
			'fetchChainStatus'
		]
	},
	{
		path: 'api/health',
		exportNames: ['fetchBackendHealthStatus']
	},
	{
		path: 'api/mosaics',
		exportNames: [
			'fetchMosaicInfo',
			'fetchMosaicPage'
		]
	},
	{
		path: 'api/namespaces',
		exportNames: [
			'fetchNamespaceInfo',
			'fetchNamespacePage'
		]
	},
	{
		path: 'api/nodes',
		exportNames: ['fetchNodeList']
	},
	{
		path: 'api/search',
		exportNames: ['search']
	},
	{
		path: 'api/stats',
		exportNames: [
			'fetchAccountStats',
			'fetchBlockStats',
			'fetchMarketData',
			'fetchNodeStats',
			'fetchPriceByDate',
			'fetchTransactionChart',
			'fetchTransactionStats'
		]
	},
	{
		path: 'api/transactions',
		exportNames: [
			'fetchTransactionInfo',
			'fetchTransactionPage'
		]
	}
];

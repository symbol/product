// Contract enforced by __tests__/variants/contract.test.js.

/**
 * @typedef {object} VariantApi - Per-domain API namespaces exported by a variant.
 * @property {object} accounts - accounts API.
 * @property {object} blocks - blocks API.
 * @property {object} health - health API.
 * @property {object} mosaics - mosaics API.
 * @property {object} namespaces - namespaces API.
 * @property {object} nodes - nodes API.
 * @property {object} search - search API.
 * @property {object} stats - stats API.
 * @property {object} transactions - transactions API.
 */

/**
 * @typedef {object} VariantStyleVariables - Theme tokens exposed to JavaScript.
 */

/**
 * @typedef {object} VariantHomePageConfig
 * @property {boolean} showSupernodeCount - Whether the home page shows the supernode count.
 * @property {Array<{component: string}>} additionalSections - Variant-only sections to inject.
 */

// Required exports for each API domain.
export const API_CONTRACT = {
	accounts: ['fetchAccountPage', 'fetchAccountInfo', 'fetchAccountInfoByPublicKey'],
	blocks: ['fetchBlockPage', 'fetchChainHight', 'fetchBlockInfo'],
	health: ['fetchBackendHealthStatus'],
	mosaics: ['fetchMosaicPage', 'fetchMosaicInfo'],
	namespaces: ['fetchNamespacePage', 'fetchNamespaceInfo'],
	nodes: ['fetchNodeList'],
	search: ['search'],
	stats: [
		'fetchAccountStats',
		'fetchTransactionChart',
		'fetchTransactionStats',
		'fetchBlockStats',
		'fetchNodeStats',
		'fetchMarketData',
		'fetchPriceByDate'
	],
	transactions: ['fetchTransactionPage', 'fetchTransactionInfo']
};

// Theme tokens consumed from JavaScript.
export const STYLE_VARIABLES_CONTRACT = [
	'colorChartLine',
	'colorChartColumns',
	'colorChartDonutMain',
	'colorChartDonutBackground',
	'colorChartDonutStroke',
	'colorTransactionSquare',
	'colorTransactionSquareText',
	'colorProgressDefault',
	'colorProgressDanger'
];

// Required config keys by page.
export const PAGE_CONFIG_CONTRACT = {
	home: ['showSupernodeCount', 'additionalSections']
};

// Required variant-local runtime config keys, named per config/index.js.
export const CONFIG_CONTRACT = {
	nem: [
		'PUBLIC_NEM_BLOCKCHAIN_UNWIND_LIMIT',
		'PUBLIC_NEM_HISTORICAL_PRICE_URL',
		'PUBLIC_NEM_SUPERNODE_API_URL',
		'PUBLIC_NEM_MARKET_DATA_URL'
	],
	symbol: []
};

// Shared stylesheet roots whose $tokens must exist in every variant theme.
export const THEME_STYLESHEET_DIRS = ['styles'];

/**
 * Required list of env config keys (config/env-config.js) expected for each variant.
 * Each variant reads only its own keys.
 * @type {Record<string, string[]>}
 */
export const envKeysByVariant = {
	nem: [
		'PUBLIC_NEM_BLOCKCHAIN_UNWIND_LIMIT',
		'PUBLIC_NEM_HISTORICAL_PRICE_URL',
		'PUBLIC_NEM_MARKET_DATA_URL',
		'PUBLIC_NEM_SUPERNODE_API_URL'
	],
	symbol: []
};

export { default as pageConfig } from './pages';

const env = name => process.env[`NEXT_PUBLIC_${name}`];
const listEnv = name => (env(name) || '').split(',').map(value => value.trim()).filter(Boolean);

export const config = {
	SYMBOL_STATISTIC_SERVICE_URL: env('SYMBOL_STATISTIC_SERVICE_URL'),
	SYMBOL_NODE_URL: env('SYMBOL_NODE_URL') || env('API_BASE_URL'),
	SYMBOL_MARKET_DATA_URL: env('SYMBOL_MARKET_DATA_URL') || env('MARKET_DATA_URL'),
	SYMBOL_HISTORICAL_PRICE_URL: env('SYMBOL_HISTORICAL_PRICE_URL') || env('HISTORICAL_PRICE_URL'),
	SYMBOL_NETWORK_IDENTIFIER: env('SYMBOL_NETWORK_IDENTIFIER') || 104,
	SYMBOL_EPOCH_ADJUSTMENT: +(env('SYMBOL_EPOCH_ADJUSTMENT') || 1615853185),
	SYMBOL_NATIVE_MOSAIC_ALIAS_IDS: listEnv('SYMBOL_NATIVE_MOSAIC_ALIAS_IDS')
};

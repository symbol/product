export { default as pageConfig } from './pages';

const env = name => process.env[`NEXT_PUBLIC_${name}`] || process.env[name];

export const config = {
	NEM_BLOCKCHAIN_UNWIND_LIMIT: +env('NEM_BLOCKCHAIN_UNWIND_LIMIT'),
	NEM_SUPERNODE_API_URL: env('NEM_SUPERNODE_API_URL') || env('SUPERNODE_API_URL'),
	NEM_NODELIST_URL: env('NEM_NODELIST_URL') || env('NODELIST_URL'),
	NEM_MARKET_DATA_URL: env('NEM_MARKET_DATA_URL') || env('MARKET_DATA_URL'),
	NEM_HISTORICAL_PRICE_URL: env('NEM_HISTORICAL_PRICE_URL') || env('HISTORICAL_PRICE_URL')
};

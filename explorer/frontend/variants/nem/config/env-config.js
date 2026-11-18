// NEM variant env config. Merged into @/app/config (config/index.js).
// PUBLIC_NEM_* keys reach the client; NEM_* keys stay server-only. Only variant code should read them.
export const envConfig = {
	PUBLIC_NEM_BLOCKCHAIN_UNWIND_LIMIT: Number(process.env.PUBLIC_NEM_BLOCKCHAIN_UNWIND_LIMIT),
	PUBLIC_NEM_HISTORICAL_PRICE_URL: process.env.PUBLIC_NEM_HISTORICAL_PRICE_URL,
	PUBLIC_NEM_SUPERNODE_API_URL: process.env.PUBLIC_NEM_SUPERNODE_API_URL,
	PUBLIC_NEM_MARKET_DATA_URL: process.env.PUBLIC_NEM_MARKET_DATA_URL
};

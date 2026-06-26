// NEM variant config. Merged into @/app/config through variants/configs.js.
// PUBLIC_NEM_* keys reach the client; NEM_* keys stay server-only. Only variant code should read them.
const config = {
	PUBLIC_NEM_BLOCKCHAIN_UNWIND_LIMIT: Number(process.env.PUBLIC_NEM_BLOCKCHAIN_UNWIND_LIMIT),
	PUBLIC_NEM_HISTORICAL_PRICE_URL: process.env.PUBLIC_NEM_HISTORICAL_PRICE_URL,
	PUBLIC_NEM_SUPERNODE_API_URL: process.env.PUBLIC_NEM_SUPERNODE_API_URL,
	PUBLIC_NEM_MARKET_DATA_URL: process.env.PUBLIC_NEM_MARKET_DATA_URL
};

export default config;

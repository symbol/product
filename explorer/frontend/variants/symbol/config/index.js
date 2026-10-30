// Runtime public configuration follows the window.appConfig delivery contract.
const marketDataUrl = typeof window === 'undefined'
	? process.env.PUBLIC_SYMBOL_MARKET_DATA_URL
	: window.appConfig?.PUBLIC_SYMBOL_MARKET_DATA_URL;

let parsedMarketDataUrl;
try {
	parsedMarketDataUrl = new URL(marketDataUrl);
} catch {
	throw new Error('PUBLIC_SYMBOL_MARKET_DATA_URL must be a valid HTTP(S) URL');
}

if (!['http:', 'https:'].includes(parsedMarketDataUrl.protocol))
	throw new Error('PUBLIC_SYMBOL_MARKET_DATA_URL must be a valid HTTP(S) URL');

const config = {
	PUBLIC_SYMBOL_MARKET_DATA_URL: marketDataUrl
};

export default config;

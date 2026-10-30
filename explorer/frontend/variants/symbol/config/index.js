// Runtime public configuration follows the window.appConfig delivery contract.
const config = {
	PUBLIC_SYMBOL_MARKET_DATA_URL: typeof window === 'undefined'
		? process.env.PUBLIC_SYMBOL_MARKET_DATA_URL
		: window.appConfig?.PUBLIC_SYMBOL_MARKET_DATA_URL,
	PUBLIC_SYMBOL_HISTORICAL_PRICE_URL: typeof window === 'undefined'
		? process.env.PUBLIC_SYMBOL_HISTORICAL_PRICE_URL
		: window.appConfig?.PUBLIC_SYMBOL_HISTORICAL_PRICE_URL
};

Object.entries(config).forEach(([name, value]) => {
	let url;
	try {
		url = new URL(value);
	} catch {
		throw new Error(`${name} must be a valid HTTP(S) URL`);
	}

	if (!['http:', 'https:'].includes(url.protocol))
		throw new Error(`${name} must be a valid HTTP(S) URL`);
});

export default config;

const env = name => process.env[`NEXT_PUBLIC_${name}`];

const platform = env('PLATFORM') || 'nem';

const getVariantConfig = () => {
	try {
		// eslint-disable-next-line import/no-dynamic-require, global-require
		return require(`../variants/${platform}/config`).config || {};
	} catch {
		return {};
	}
};

const publicAppConfig = {
	PLATFORM: platform,
	NATIVE_MOSAIC_ID: env('NATIVE_MOSAIC_ID'),
	NATIVE_MOSAIC_TICKER: env('NATIVE_MOSAIC_TICKER'),
	NATIVE_MOSAIC_DIVISIBILITY: +env('NATIVE_MOSAIC_DIVISIBILITY'),
	BLOCKCHAIN_UNWIND_LIMIT: +env('BLOCKCHAIN_UNWIND_LIMIT'),
	REQUEST_TIMEOUT: +env('REQUEST_TIMEOUT'),
	API_BASE_URL: env('API_BASE_URL'),
	SUPERNODE_API_URL: env('SUPERNODE_API_URL'),
	NODELIST_URL: env('NODELIST_URL'),
	MARKET_DATA_URL: env('MARKET_DATA_URL'),
	HISTORICAL_PRICE_URL: env('HISTORICAL_PRICE_URL'),
	SOCIAL_URL_TWITTER: env('SOCIAL_URL_TWITTER'),
	SOCIAL_URL_GITHUB: env('SOCIAL_URL_GITHUB'),
	SOCIAL_URL_DISCORD: env('SOCIAL_URL_DISCORD'),
	FOOTER_URL_DOCS: env('FOOTER_URL_DOCS'),
	FOOTER_URL_TECHNICAL_REFERENCE: env('FOOTER_URL_TECHNICAL_REFERENCE'),
	FOOTER_URL_FAUCET: env('FOOTER_URL_FAUCET'),
	FOOTER_URL_SUPERNODE_PROGRAM: env('FOOTER_URL_SUPERNODE_PROGRAM'),
	...getVariantConfig()
};

const isClientSide = typeof window !== 'undefined';

export default isClientSide ? window.appConfig : publicAppConfig;

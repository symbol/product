import { config as nemConfig } from '@/variants/nem/config';
import { config as symbolConfig } from '@/variants/symbol/config';

const publicEnv = {
	PLATFORM: process.env.NEXT_PUBLIC_PLATFORM || process.env.PLATFORM,
	NATIVE_MOSAIC_ID: process.env.NEXT_PUBLIC_NATIVE_MOSAIC_ID || process.env.NATIVE_MOSAIC_ID,
	NATIVE_MOSAIC_TICKER: process.env.NEXT_PUBLIC_NATIVE_MOSAIC_TICKER || process.env.NATIVE_MOSAIC_TICKER,
	NATIVE_MOSAIC_DIVISIBILITY: process.env.NEXT_PUBLIC_NATIVE_MOSAIC_DIVISIBILITY || process.env.NATIVE_MOSAIC_DIVISIBILITY,
	BLOCKCHAIN_UNWIND_LIMIT: process.env.NEXT_PUBLIC_BLOCKCHAIN_UNWIND_LIMIT || process.env.BLOCKCHAIN_UNWIND_LIMIT,
	REQUEST_TIMEOUT: process.env.NEXT_PUBLIC_REQUEST_TIMEOUT || process.env.REQUEST_TIMEOUT,
	API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL,
	SUPERNODE_API_URL: process.env.NEXT_PUBLIC_SUPERNODE_API_URL || process.env.SUPERNODE_API_URL,
	NODELIST_URL: process.env.NEXT_PUBLIC_NODELIST_URL || process.env.NODELIST_URL,
	MARKET_DATA_URL: process.env.NEXT_PUBLIC_MARKET_DATA_URL || process.env.MARKET_DATA_URL,
	HISTORICAL_PRICE_URL: process.env.NEXT_PUBLIC_HISTORICAL_PRICE_URL || process.env.HISTORICAL_PRICE_URL,
	SOCIAL_URL_TWITTER: process.env.NEXT_PUBLIC_SOCIAL_URL_TWITTER || process.env.SOCIAL_URL_TWITTER,
	SOCIAL_URL_GITHUB: process.env.NEXT_PUBLIC_SOCIAL_URL_GITHUB || process.env.SOCIAL_URL_GITHUB,
	SOCIAL_URL_DISCORD: process.env.NEXT_PUBLIC_SOCIAL_URL_DISCORD || process.env.SOCIAL_URL_DISCORD,
	FOOTER_URL_DOCS: process.env.NEXT_PUBLIC_FOOTER_URL_DOCS || process.env.FOOTER_URL_DOCS,
	FOOTER_URL_TECHNICAL_REFERENCE: process.env.NEXT_PUBLIC_FOOTER_URL_TECHNICAL_REFERENCE || process.env.FOOTER_URL_TECHNICAL_REFERENCE,
	FOOTER_URL_FAUCET: process.env.NEXT_PUBLIC_FOOTER_URL_FAUCET || process.env.FOOTER_URL_FAUCET,
	FOOTER_URL_SUPERNODE_PROGRAM: process.env.NEXT_PUBLIC_FOOTER_URL_SUPERNODE_PROGRAM || process.env.FOOTER_URL_SUPERNODE_PROGRAM
};

const env = name => publicEnv[name];

const variantConfigs = {
	nem: nemConfig,
	symbol: symbolConfig
};

const getPlatform = () => env('PLATFORM');

const getVariantConfig = () => {
	const platform = getPlatform();
	const selectedConfig = variantConfigs[platform];

	if (!selectedConfig)
		throw new Error('NEXT_PUBLIC_PLATFORM or PLATFORM must be set to either "nem" or "symbol".');

	return selectedConfig;
};

export const createPublicAppConfig = () => ({
	PLATFORM: getPlatform(),
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
});

export const serializeAppConfig = appConfig => JSON.stringify(appConfig).replace(/</g, '\\u003c');

const publicAppConfig = createPublicAppConfig();

const isClientSide = typeof window !== 'undefined';
const getClientAppConfig = () => window.appConfig || window['__NEXT_DATA__']?.props?.appConfig || publicAppConfig;

export default isClientSide ? getClientAppConfig() : publicAppConfig;

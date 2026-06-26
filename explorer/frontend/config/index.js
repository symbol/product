import { variantConfig } from '@/app/variants/configs';

// Environment variable naming scheme (see README "Environment Variables"):
//   NEXT_PUBLIC_NAME      build-time, client-visible, common
//   PUBLIC_NAME           runtime, client-visible, common
//   NAME                  runtime, server-only, common
//   PUBLIC_<VARIANT>_NAME runtime, client-visible, variant-scoped
//   <VARIANT>_NAME        runtime, server-only, variant-scoped
// `@/app/config` is the single entry point. It merges the active variant's config onto the
// common config and serializes only PUBLIC_*/NEXT_PUBLIC_* keys into window.appConfig.

const serverAppConfig = {
	...variantConfig,
	PUBLIC_API_BASE_URL: process.env.PUBLIC_API_BASE_URL,
	PUBLIC_REQUEST_TIMEOUT: Number(process.env.PUBLIC_REQUEST_TIMEOUT),
	PUBLIC_NATIVE_MOSAIC_ID: process.env.PUBLIC_NATIVE_MOSAIC_ID,
	PUBLIC_NATIVE_MOSAIC_TICKER: process.env.PUBLIC_NATIVE_MOSAIC_TICKER,
	PUBLIC_NATIVE_MOSAIC_DIVISIBILITY: Number(process.env.PUBLIC_NATIVE_MOSAIC_DIVISIBILITY),
	PUBLIC_SOCIAL_URL_TWITTER: process.env.PUBLIC_SOCIAL_URL_TWITTER,
	PUBLIC_SOCIAL_URL_GITHUB: process.env.PUBLIC_SOCIAL_URL_GITHUB,
	PUBLIC_SOCIAL_URL_DISCORD: process.env.PUBLIC_SOCIAL_URL_DISCORD,
	PUBLIC_FOOTER_URL_DOCS: process.env.PUBLIC_FOOTER_URL_DOCS,
	PUBLIC_FOOTER_URL_TECHNICAL_REFERENCE: process.env.PUBLIC_FOOTER_URL_TECHNICAL_REFERENCE,
	PUBLIC_FOOTER_URL_FAUCET: process.env.PUBLIC_FOOTER_URL_FAUCET,
	PUBLIC_FOOTER_URL_SUPERNODE_PROGRAM: process.env.PUBLIC_FOOTER_URL_SUPERNODE_PROGRAM
};

// Filter out bare, NEM_*, and SYMBOL_* keys so they never reach window.appConfig.
const isPublicKey = key => key.startsWith('PUBLIC_') || key.startsWith('NEXT_PUBLIC_');

export const publicAppConfig = Object.fromEntries(Object.entries(serverAppConfig).filter(([key]) => isPublicKey(key)));

const isClientSide = typeof window !== 'undefined';

export default isClientSide ? (window.appConfig ?? publicAppConfig) : serverAppConfig;

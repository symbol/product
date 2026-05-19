const i18nConfig = require('./next-i18next.config.js'); // eslint-disable-line import/extensions
const path = require('path');
const { loadEnvConfig } = require('@next/env');

loadEnvConfig(__dirname);

const PLATFORM = process.env.NEXT_PUBLIC_PLATFORM || 'nem';

module.exports = {
	output: 'standalone',
	reactStrictMode: true,
	transpilePackages: ['symbol-sdk'],
	experimental: {
		scrollRestoration: true
	},
	// Redirect symbol-crypto-wasm-node to a no-op stub.
	// We only use Address/Network/NetworkTimestamp (pure JS) — never KeyPair/Verifier (WASM).
	// Turbopack uses project-root-relative paths; webpack uses absolute paths.
	turbopack: {
		resolveAlias: {
			'symbol-crypto-wasm-node': './utils/symbol-wasm-stub.js',
			'bitcore-mnemonic': './utils/bitcore-mnemonic-stub.js'
		}
	},
	webpack: (config, { isServer }) => {
		if (!isServer)
			config.resolve.alias['symbol-crypto-wasm-node'] = path.resolve(__dirname, 'utils/symbol-wasm-stub.js');
		config.resolve.alias['bitcore-mnemonic'] = path.resolve(__dirname, 'utils/bitcore-mnemonic-stub.js');
		return config;
	},
	i18n: i18nConfig.i18n,
	eslint: {
		ignoreDuringBuilds: true
	},
	sassOptions: {
		includePaths: [path.join(__dirname, 'styles')],
		additionalData: (content, loaderContext) => {
			const resourcePath = loaderContext.resourcePath || '';
			const normalizedPath = resourcePath.replace(/\\/g, '/');

			if (normalizedPath.endsWith('/styles/variables.scss') || normalizedPath.includes('/variants/'))
				return content;

			return `@import "variants/${PLATFORM}/styles/variables.scss";\n${content}`;
		}
	}
};

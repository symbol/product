const webpack = require('webpack');
const i18nConfig = require('./next-i18next.config.js');

module.exports = {
	distDir: 'build',
	reactStrictMode: true,
	experimental: {
		appDir: true
	},
	i18n: i18nConfig.i18n,
	webpack: (config, { isServer }) => {
		// use a browser-optimized wasm for Ed25519 crypto operations
		const moduleRegExp = /symbol-crypto-wasm-node/;
		const newPath = '../../../symbol-crypto-wasm-web/symbol_crypto_wasm.js';
		config.plugins.push(new webpack.NormalModuleReplacementPlugin(moduleRegExp, newPath));

		// enable async loading of wasm files
		config.experiments = { asyncWebAssembly: true, topLevelAwait: true, layers: true };

		return config;
	}
};

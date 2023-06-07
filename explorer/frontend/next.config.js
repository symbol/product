import webpack from 'webpack';

const nextConfig = {
	distDir: 'build',
	reactStrictMode: true,
	experimental: {
		appDir: true
	},
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

export default nextConfig;

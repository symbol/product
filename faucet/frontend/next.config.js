import webpack from 'webpack';

const nextConfig = {
	output: 'export',
	distDir: 'build',
	reactStrictMode: true,
	experimental: {
		appDir: true
	},
	webpack: (config, { isServer }) => {
		// use a browser-optimized wasm for Ed25519 crypto operations
		config.plugins.push(new webpack.NormalModuleReplacementPlugin(
			/symbol-crypto-wasm-node/,
			'../../../symbol-crypto-wasm-web/symbol_crypto_wasm.js'
		));

		// enable async loading of wasm files
		config.experiments = { asyncWebAssembly: true, topLevelAwait: true, layers: true };

		return config;
	}
};

export default nextConfig;

import webpack from 'webpack';

const nextConfig = {
	webpack: config => {
		config.plugins.push(new webpack.NormalModuleReplacementPlugin(
			/symbol-crypto-wasm-node/,
			'empty-module'
		));

		config.experiments = { asyncWebAssembly: true, topLevelAwait: true, layers: true };

		return config;
	}
};

export default nextConfig;

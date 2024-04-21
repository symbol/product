import webpack from 'webpack';

const config = {
	bundler: 'webpack',
	input: 'src/index.js',
	server: {
		port: 8080
	},
	polyfills: true,
	customizeWebpackConfig(webpackConfig) {
		// Disable the `symbol-crypto-wasm-node` package, which is not compatible
		webpackConfig.plugins.push(
			new webpack.NormalModuleReplacementPlugin(
				/symbol-crypto-wasm-node/,
				'empty-module'
			),
			new webpack.ProvidePlugin({
				process: 'process/browser'
			})
		);
		return webpackConfig;
	}
};

export default config;

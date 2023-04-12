const webpack = require('webpack');

module.exports = config => {
	const fallback = config.resolve.fallback || {};
	Object.assign(fallback, {
		'crypto': require.resolve('crypto-browserify'),
		'stream': require.resolve('stream-browserify'),
		'url': require.resolve('url'),
		'assert': require.resolve('assert')
	});
	config.resolve.fallback = fallback;
	config.plugins = (config.plugins || []).concat([
		new webpack.ProvidePlugin({
			process: 'process/browser',
			Buffer: ['buffer', 'Buffer']
		})
	]);

	return config;
};

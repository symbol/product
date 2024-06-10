const i18nConfig = require('./next-i18next.config.js'); // eslint-disable-line import/extensions
const webpack = require('webpack');

module.exports = {
	distDir: 'build',
	reactStrictMode: true,
	experimental: {
		scrollRestoration: true
	},
	i18n: i18nConfig.i18n,
	eslint: {
		ignoreDuringBuilds: true
	}
};

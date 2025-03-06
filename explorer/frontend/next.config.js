const i18nConfig = require('./next-i18next.config.js'); // eslint-disable-line import/extensions

module.exports = {
	output: 'standalone',
	reactStrictMode: true,
	experimental: {
		scrollRestoration: true
	},
	i18n: i18nConfig.i18n,
	eslint: {
		ignoreDuringBuilds: true
	}
};

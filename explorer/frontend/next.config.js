const i18nConfig = require('./next-i18next.config.js'); // eslint-disable-line import/extensions
const path = require('path');

const PLATFORM = process.env.NEXT_PUBLIC_PLATFORM;

module.exports = {
	output: 'standalone',
	reactStrictMode: true,
	experimental: {
		scrollRestoration: true
	},
	i18n: i18nConfig.i18n,
	eslint: {
		ignoreDuringBuilds: true
	},
	webpack(config) {
		// Inject SCSS global variables
		const scssRule = config.module.rules.find(rule => rule.oneOf)
			?.oneOf?.find(r => Array.isArray(r.use) 
			&& r.use.find(u => u.loader?.includes('sass-loader')));

		if (scssRule) {
			const sassLoader = scssRule.use.find(u => u.loader?.includes('sass-loader'));
			sassLoader.options.additionalData = `@import "styles/app/${PLATFORM}/variables.scss";`;
			sassLoader.options.sassOptions = {
				includePaths: [path.join(__dirname, 'styles')]
			};
		}

		return config;
	}
};

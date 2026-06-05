const i18nConfig = require('./next-i18next.config.js'); // eslint-disable-line import/extensions
const path = require('path');
const { loadEnvConfig } = require('@next/env');

loadEnvConfig(__dirname);

const PLATFORM = process.env.NEXT_PUBLIC_PLATFORM || process.env.PLATFORM;
const VALID_PLATFORMS = ['nem', 'symbol'];

const getPlatform = () => {
	if (!VALID_PLATFORMS.includes(PLATFORM))
		throw new Error('NEXT_PUBLIC_PLATFORM or PLATFORM must be set to either "nem" or "symbol".');

	return PLATFORM;
};

const normalizeResourcePath = loaderContext => (loaderContext.resourcePath || '').replace(/\\/g, '/');
const sharedVariablesImportPattern = /^(@import\s+['"](?:\.\.?\/)?variables['"];\s*)/;

const injectVariantVariables = content => {
	const variantVariablesImport = `@import "variants/${getPlatform()}/styles/variables.scss";\n`;
	const sharedVariablesImportMatch = content.match(sharedVariablesImportPattern);

	if (!sharedVariablesImportMatch)
		return `${variantVariablesImport}${content}`;

	return content.replace(sharedVariablesImportPattern, `$1${variantVariablesImport}`);
};

const additionalData = function (content, loaderContext) {
	const normalizedPath = normalizeResourcePath(loaderContext);
	if (normalizedPath.endsWith('/styles/variables.scss') || normalizedPath.includes('/variants/'))
		return content;

	return injectVariantVariables(content);
};

module.exports = {
	output: 'standalone',
	reactStrictMode: true,
	experimental: {
		scrollRestoration: true
	},
	images: {
		localPatterns: [
			{
				pathname: '/images/**'
			},
			{
				pathname: '/symbol/images/**'
			}
		]
	},
	i18n: i18nConfig.i18n,
	eslint: {
		ignoreDuringBuilds: true
	},
	sassOptions: {
		includePaths: [path.join(__dirname, 'styles')],
		additionalData
	}
};

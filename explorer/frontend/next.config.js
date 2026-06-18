const i18nConfig = require('./next-i18next.config.js'); // eslint-disable-line import/extensions
const path = require('path');
const { loadEnvConfig } = require('@next/env');

// next.config.js runs before Next loads .env files, so load them here first.
loadEnvConfig(__dirname);

// The active variant is a build-time switch because aliases and SCSS tokens are compiled per variant.
const VARIANT = process.env.NEXT_PUBLIC_EXPLORER_VARIANT;
const variantStylesPath = path.join(__dirname, 'variants', VARIANT, 'styles');
const variantVariablesPath = path.join(variantStylesPath, 'variables.scss').split(path.sep).join('/');
// Turbopack resolveAlias entries are project-root relative.
const variantAlias = `./variants/${VARIANT}`;

module.exports = {
	output: 'standalone',
	reactStrictMode: true,
	experimental: {
		scrollRestoration: true
	},
	i18n: i18nConfig.i18n,
	turbopack: {
		// Resolve the @/app/active-variant/* indirection to the selected variant's modules at build
		// time, so only the active variant is pulled into the app graph and the inactive variant is
		// left out of the bundle. Mirrored in jest.config.js (moduleNameMapper) for tests; the
		// contract test reaches every variant through variants/manifest.js, not this alias.
		resolveAlias: {
			'@/app/active-variant/styles/variables.json': `${variantAlias}/styles/variables.json`,
			'@/app/active-variant/config/pages': `${variantAlias}/config/pages`,
			'@/app/active-variant/config': `${variantAlias}/config`,
			'@/app/active-variant/api': `${variantAlias}/api`,
			'@/app/active-variant/DocumentHead': `${variantAlias}/DocumentHead`,
			'@/app/active-variant/components': `${variantAlias}/components`
		}
	},
	sassOptions: {
		// Inject the selected variant's SCSS tokens into every stylesheet.
		additionalData: `@import "${variantVariablesPath}";`,
		includePaths: [__dirname, variantStylesPath, path.join(__dirname, 'styles')]
	},
	eslint: {
		ignoreDuringBuilds: true
	}
};

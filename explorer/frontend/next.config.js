const i18nConfig = require('./next-i18next.config.js'); // eslint-disable-line import/extensions
const path = require('path');
const { loadEnvConfig } = require('@next/env');

// next.config.js runs before Next loads .env files, so load them here first.
loadEnvConfig(__dirname);

// Shared tokens imported into every variant theme.
const commonStylesPath = path.join(__dirname, 'styles');
const commonVariablesPath = path.join(commonStylesPath, 'variables.scss').split(path.sep).join('/');

// The active variant is selected at build time because aliases and SCSS tokens are compiled per variant.
const VARIANT = process.env.NEXT_PUBLIC_EXPLORER_VARIANT;
const variantStylesPath = path.join(__dirname, 'variants', VARIANT, 'styles');
const variantVariablesPath = path.join(variantStylesPath, 'variables.scss').split(path.sep).join('/');

// Turbopack aliases are resolved relative to the project root.
const variantAlias = `./variants/${VARIANT}`;

module.exports = {
	output: 'standalone',
	reactStrictMode: true,
	experimental: {
		scrollRestoration: true
	},
	i18n: i18nConfig.i18n,
	turbopack: {
		// Resolve @/app/active-variant/* to the selected variant's modules at build time so inactive
		// variants stay out of the bundle. Mirrored in jest.config.js for tests.
		resolveAlias: {
			'@/app/active-variant/styles/variables.json': `${variantAlias}/styles/variables.json`,
			'@/app/active-variant/config/pages': `${variantAlias}/config/pages`,
			'@/app/active-variant/config': `${variantAlias}/config`,
			'@/app/active-variant/api': `${variantAlias}/api`,
			'@/app/active-variant/utils': `${variantAlias}/utils`,
			'@/app/active-variant/DocumentHead': `${variantAlias}/DocumentHead`,
			'@/app/active-variant/components': `${variantAlias}/components`
		}
	},
	sassOptions: {
		// Inject shared SCSS tokens first, then the active variant's tokens, into every stylesheet.
		additionalData: `@import "${commonVariablesPath}"; @import "${variantVariablesPath}";`,
		includePaths: [__dirname, commonStylesPath, variantStylesPath]
	},
	eslint: {
		ignoreDuringBuilds: true
	}
};

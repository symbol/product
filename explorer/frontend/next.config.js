const VARIANTS = require('./contract/variants.json');
const i18nConfig = require('./next-i18next.config.js'); // eslint-disable-line import/extensions
const { loadEnvConfig } = require('@next/env');
const path = require('path');

// next.config.js runs before Next loads .env files, so load them here first.
loadEnvConfig(__dirname);

// Shared tokens imported into every variant theme.
const commonStylesPath = path.join(__dirname, 'styles');
const commonVariablesPath = path.join(commonStylesPath, 'variables.scss').split(path.sep).join('/');

/**
 * Reads the variant for this build from NEXT_PUBLIC_EXPLORER_VARIANT.
 * Throws on a missing or unknown variant, so a build never silently falls back to another variant.
 * @returns {string} Variant id.
 */
const getVariant = () => {
	const variant = process.env.NEXT_PUBLIC_EXPLORER_VARIANT;

	if (!VARIANTS.includes(variant))
		throw new Error(`Unknown variant "${variant}" in NEXT_PUBLIC_EXPLORER_VARIANT. Available options: ${VARIANTS.join(', ')}.`);

	return variant;
};

// The active variant is selected at build time because aliases and SCSS tokens are compiled per variant.
const VARIANT = getVariant();

const variantStylesPath = path.join(__dirname, 'variants', VARIANT, 'styles');
const variantVariablesPath = path.join(variantStylesPath, 'variables.scss').split(path.sep).join('/');

// Turbopack aliases are resolved relative to the project root.
const variantAlias = `./variants/${VARIANT}`;

module.exports = {
	output: 'standalone',
	reactStrictMode: true,
	// `/api/*` on a deployed origin is proxied to the REST backend, so the runtime config script is
	// exposed outside that namespace.
	rewrites: async () => [{ source: '/runtime-config.js', destination: '/api/config' }],
	experimental: {
		scrollRestoration: true
	},
	i18n: i18nConfig.i18n,
	turbopack: {
		// Resolve @/variant/* to the selected variant's modules at build time so inactive
		// variants stay out of the bundle. Mirrored in jest.config.js for tests.
		resolveAlias: {
			'@/variant/*': `${variantAlias}/*`
		}
	},
	sassOptions: {
		// Inject shared SCSS tokens first, then the active variant's tokens, into every stylesheet.
		additionalData: `@import "${commonVariablesPath}"; @import "${variantVariablesPath}";`,
		includePaths: [__dirname, commonStylesPath, variantStylesPath]
	}
};

import sharedDefaultConfig from '../../_symbol/linters/javascript/default.mjs';

/**
 * Builds the ESLint flat config blocks shared by every wallet package.
 *
 * Each package passes in the plugin modules it already declares in devDependencies.
 * @param {object} plugins - Plugin modules supplied by the calling package.
 * @param {object} plugins.js - `@eslint/js`.
 * @param {object} plugins.importPlugin - `eslint-plugin-import-x`.
 * @param {object} plugins.jsdoc - `eslint-plugin-jsdoc`.
 * @param {object} plugins.globals - `globals`.
 * @param {Function} plugins.createNodeResolver - `createNodeResolver` from `eslint-plugin-import-x`.
 * @param {object} [options] - Per-package adjustments.
 * @param {string[]} [options.ignores] - Extra ignore patterns appended to the base list.
 * @param {object} [options.rules] - Rule overrides merged after the wallet rules and before the config-file override.
 * @param {string[]} [options.testFiles] - Globs that receive the jest globals.
 * @returns {object[]} Config blocks to spread into `defineConfig`.
 */
export const createWalletConfig = (
	{ js, importPlugin, jsdoc, globals, createNodeResolver },
	{ ignores = [], rules = {}, testFiles = ['tests/**/*.js', 'jest.config.js'] } = {}
) => [
	{ ignores: ['build/', 'dist/', 'coverage/', ...ignores] },
	{
		plugins: { import: importPlugin, jsdoc },
		languageOptions: {
			globals: { ...globals.browser, ...globals.node }
		},
		settings: {
			'import-x/resolver-next': [createNodeResolver({ extensions: ['.js', '.mjs', '.cjs', '.json'] })]
		}
	},
	js.configs.recommended,
	sharedDefaultConfig,
	{
		rules: {
			// rules previously supplied by plugin:import/recommended
			'import/default': 'error',
			'import/export': 'error',
			'import/no-duplicates': 'warn',
			'import/no-named-as-default': 'warn',
			'import/no-named-as-default-member': 'warn',
			'import/named': 'off',
			'import/namespace': 'off',
			// the wallet packages use named exports throughout; single-export modules are intentional
			'import/prefer-default-export': 'off',
			'jsdoc/no-undefined-types': 'warn',
			yoda: 'off',
			'no-underscore-dangle': 'off',
			'prefer-destructuring': ['error', {
				VariableDeclarator: { array: false, object: true },
				AssignmentExpression: { array: false, object: false }
			}],
			...rules
		}
	},
	{
		files: testFiles,
		languageOptions: { globals: { ...globals.jest } }
	},
	{
		// ESM config files: the shared .mjs imports need their extension
		files: ['eslint.config.mjs', '**/eslint.shared.mjs'],
		rules: {
			'import/extensions': 'off',
			'import/no-named-as-default': 'off'
		}
	}
];

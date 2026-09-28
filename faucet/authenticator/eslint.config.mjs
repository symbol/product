import sharedDefaultConfig from '../../_symbol/linters/javascript/default.mjs';
import sharedTestConfig from '../../_symbol/linters/javascript/test.mjs';
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import importPlugin, { createNodeResolver } from 'eslint-plugin-import-x';
import jsdoc from 'eslint-plugin-jsdoc';
import globals from 'globals';

export default defineConfig([
	{ ignores: ['coverage/'] },
	{
		plugins: { import: importPlugin, jsdoc },
		settings: {
			'import-x/resolver-next': [createNodeResolver({ extensions: ['.js', '.cjs', '.json'] })]
		}
	},
	js.configs.recommended,
	sharedDefaultConfig,
	{
		// this package is CommonJS (require/module.exports); default.mjs sets sourceType: 'module'
		languageOptions: { sourceType: 'commonjs', globals: { ...globals.node } },
		rules: {
			// airbnb allowed `const { omitted, ...rest } = obj`
			'no-unused-vars': ['error', { ignoreRestSiblings: true }]
		}
	},
	{
		files: ['test/**/*.js'],
		languageOptions: { globals: { ...globals.mocha } },
		...sharedTestConfig
	}
]);

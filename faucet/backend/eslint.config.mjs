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
		languageOptions: { globals: { ...globals.nodeBuiltin } },
		settings: {
			'import-x/resolver-next': [createNodeResolver({ extensions: ['.js', '.mjs', '.cjs', '.json'] })]
		}
	},
	js.configs.recommended,
	sharedDefaultConfig,
	{
		rules: { 'import/extensions': ['error', 'ignorePackages'] }
	},
	{
		files: ['test/**/*.js'],
		languageOptions: { globals: { ...globals.mocha } },
		...sharedTestConfig
	}
]);

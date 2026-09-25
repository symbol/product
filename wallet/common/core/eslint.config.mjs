import sharedDefaultConfig from '../../../_symbol/linters/javascript/default.mjs';
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import importPlugin, { createNodeResolver } from 'eslint-plugin-import-x';
import jsdocPlugin from 'eslint-plugin-jsdoc';
import globals from 'globals';

export default defineConfig([
	{ ignores: ['build/', 'dist/', 'coverage/'] },
	{
		plugins: { import: importPlugin, jsdoc: jsdocPlugin },
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
			'jsdoc/no-undefined-types': 'warn',
			yoda: 'off',
			'no-underscore-dangle': 'off',
			'prefer-destructuring': ['error', {
				VariableDeclarator: { array: false, object: true },
				AssignmentExpression: { array: false, object: false }
			}]
		}
	},
	{
		files: ['tests/**/*.js', 'jest.config.js'],
		languageOptions: { globals: { ...globals.jest } }
	},
	{
		rules: {
			// this package uses named exports throughout; single-export modules are intentional
			'import/prefer-default-export': 'off'
		}
	},
	{
		// ESM config file: the shared .mjs import needs its extension
		files: ['eslint.config.mjs'],
		rules: {
			'import/extensions': 'off'
		}
	}
]);

import sharedDefaultConfig from '../../_symbol/linters/javascript/default.mjs';
import js from '@eslint/js';
import eslintReact from '@eslint-react/eslint-plugin';
import nextPlugin from '@next/eslint-plugin-next';
import { defineConfig } from 'eslint/config';
import importPlugin, { createNodeResolver } from 'eslint-plugin-import-x';
import jsdoc from 'eslint-plugin-jsdoc';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default defineConfig([
	{ ignores: ['.next/', 'build/', 'coverage/'] },
	{
		// include .jsx files (ESLint's default file set is only .js/.mjs/.cjs)
		files: ['**/*.jsx'],
		languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } }
	},
	{
		plugins: { import: importPlugin, jsdoc, 'react-hooks': reactHooks, '@next/next': nextPlugin },
		languageOptions: {
			parserOptions: { ecmaFeatures: { jsx: true } },
			globals: { ...globals.browser, ...globals.node, $t: 'readonly' }
		},
		settings: {
			'import-x/extensions': ['.js', '.jsx'],
			'import-x/resolver-next': [createNodeResolver({ extensions: ['.js', '.jsx', '.mjs', '.cjs', '.json'] })]
		}
	},
	js.configs.recommended,
	eslintReact.configs.recommended,
	sharedDefaultConfig,
	{
		rules: {
			...nextPlugin.configs.recommended.rules,
			'react-hooks/rules-of-hooks': 'error',
			'react-hooks/exhaustive-deps': 'warn',
			// previously supplied by plugin:import/react (+ recommended)
			'import/default': 'error',
			'import/export': 'error',
			'import/no-duplicates': 'warn',
			'import/no-named-as-default': 'warn',
			'import/no-named-as-default-member': 'warn',
			'import/extensions': ['error', 'always', { json: 'always', js: 'never', jsx: 'never', ts: 'never' }]
		}
	},
	{
		files: ['**/*.spec.{js,jsx}', '__mocks__/**', 'setupTests.js', 'jest.config.js'],
		languageOptions: { globals: { ...globals.jest } }
	},
	{
		// ESM config file: the shared .mjs import needs its extension
		files: ['eslint.config.mjs'],
		rules: {
			'import/extensions': 'off',
			'import/no-named-as-default': 'off'
		}
	},
	{
		rules: {
			// eslint-plugin-react-hooks already reports this
			'@eslint-react/exhaustive-deps': 'off',
			// this project uses named exports throughout; single-export modules are intentional
			'import/prefer-default-export': 'off'
		}
	}
]);

import sharedDefaultConfig from '../../../_symbol/linters/javascript/default.mjs';
import js from '@eslint/js';
import eslintReact from '@eslint-react/eslint-plugin';
import { defineConfig } from 'eslint/config';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import importPlugin, { createNodeResolver } from 'eslint-plugin-import-x';
import jsdoc from 'eslint-plugin-jsdoc';
import globals from 'globals';
import path from 'node:path';

export default defineConfig([
	{ ignores: ['android/', 'ios/', 'build/', 'dist/', 'coverage/', 'flow-typed/', '.bundle/', 'vendor/', 'bundle.js', '**/*.jsbundle'] },
	{
		// include .jsx files (ESLint's default file set is only .js/.mjs/.cjs)
		files: ['**/*.jsx']
	},
	{
		plugins: { import: importPlugin, jsdoc },
		languageOptions: {
			parserOptions: { ecmaFeatures: { jsx: true } },
			globals: { ...globals.browser, ...globals.node, __DEV__: 'readonly' }
		},
		settings: {
			'import-x/extensions': ['.js', '.jsx'],
			// react-native's entry point is Flow-typed and unparsable; symbol-sdk deep imports are aliased
			'import-x/ignore': ['react-native', 'symbol-sdk'],
			'import-x/resolver-next': [
				createTypeScriptImportResolver({ project: path.join(import.meta.dirname, 'jsconfig.json') }),
				// no .json here: json imports must keep their extension (import/extensions)
				createNodeResolver({ extensions: ['.js', '.jsx', '.mjs', '.cjs'] })
			]
		}
	},
	js.configs.recommended,
	eslintReact.configs.recommended,
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
			// json imports keep their extension (the ESLint 8 resolver could not resolve .json, so this was implicit)
			'import/extensions': ['error', 'never', { json: 'always' }],
			// this app uses named exports throughout; single-export modules are intentional
			'import/prefer-default-export': 'off',
			'jsdoc/no-undefined-types': 'warn',
			'jsdoc/require-description': 'warn',
			'jsdoc/require-description-complete-sentence': 'warn',
			'jsdoc/require-param-description': 'warn',
			'jsdoc/check-types': ['warn', { unifyParentAndChildTypeChecks: true }],
			yoda: 'off',
			'no-underscore-dangle': 'off',
			'prefer-destructuring': ['error', {
				VariableDeclarator: { array: false, object: true },
				AssignmentExpression: { array: false, object: false }
			}]
		}
	},
	{
		// the entry point polyfills `process` for React Native
		files: ['index.js'],
		languageOptions: { globals: { process: 'writable' } }
	},
	{
		files: ['__tests__/**', '__mocks__/**', '__fixtures__/**', 'setupTests.js', 'jest.config.js'],
		// tests toggle __DEV__
		languageOptions: { globals: { ...globals.jest, __DEV__: 'writable' } },
		rules: {
			// test steps are sequential by nature
			'no-await-in-loop': 'off'
		}
	},
	{
		// ESM config file: the shared .mjs import needs its extension
		files: ['eslint.config.mjs'],
		rules: {
			'import/extensions': 'off',
			'import/no-named-as-default': 'off'
		}
	}
]);

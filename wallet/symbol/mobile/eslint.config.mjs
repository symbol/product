import { createWalletConfig } from '../../linter/eslint.shared.mjs';
import js from '@eslint/js';
import eslintReact from '@eslint-react/eslint-plugin';
import { defineConfig } from 'eslint/config';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import importPlugin, { createNodeResolver } from 'eslint-plugin-import-x';
import jsdoc from 'eslint-plugin-jsdoc';
import globals from 'globals';
import path from 'node:path';

const TEST_FILES = ['__tests__/**', '__mocks__/**', '__fixtures__/**', 'setupTests.js', 'jest.config.js'];

export default defineConfig([
	...createWalletConfig({ js, importPlugin, jsdoc, globals, createNodeResolver }, {
		ignores: ['android/', 'ios/', 'flow-typed/', '.bundle/', 'vendor/', 'bundle.js', '**/*.jsbundle'],
		rules: {
			// json imports keep their extension
			'import/extensions': ['error', 'never', { json: 'always' }],
			'jsdoc/require-description': 'warn',
			'jsdoc/require-description-complete-sentence': 'warn',
			'jsdoc/require-param-description': 'warn',
			'jsdoc/check-types': ['warn', { unifyParentAndChildTypeChecks: true }]
		},
		testFiles: TEST_FILES
	}),
	{
		// include .jsx files (ESLint's default file set is only .js/.mjs/.cjs)
		files: ['**/*.jsx']
	},
	{
		languageOptions: {
			parserOptions: { ecmaFeatures: { jsx: true } },
			globals: { __DEV__: 'readonly' }
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
	eslintReact.configs.recommended,
	{
		// the entry point polyfills `process` for React Native
		files: ['index.js'],
		languageOptions: { globals: { process: 'writable' } }
	},
	{
		files: TEST_FILES,
		// tests toggle __DEV__
		languageOptions: { globals: { __DEV__: 'writable' } },
		rules: {
			// test steps are sequential by nature
			'no-await-in-loop': 'off'
		}
	}
]);

import { createWalletConfig } from '../../linter/eslint.shared.mjs';
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import importPlugin, { createNodeResolver } from 'eslint-plugin-import-x';
import jsdoc from 'eslint-plugin-jsdoc';
import globals from 'globals';

export default defineConfig(createWalletConfig({ js, importPlugin, jsdoc, globals, createNodeResolver }));

/**
 * Required module to be defined per variant - React component, config file, etc.
 * @typedef {object} RequiredModule
 * @property {string} path - Module path without extension.
 * @property {string} exportName - Named export (const name).
 * @property {string} [typeName] - Named export typedef (the one above the `export const ...`). Not set for a component without props.
 */

/**
 * Required module with several named exports to be defined per variant - API module, utils module, etc.
 * @typedef {object} RequiredModuleExports
 * @property {string} path - Module path without extension.
 * @property {string[]} exportNames - Named exports (function names).
 */

export {};

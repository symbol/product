const path = require('path');

const commonPackagesRoot = path.resolve(__dirname, '../../common');

/**
 * Jest module resolver. Two jobs:
 * 1. Resolve Software Mansion animation packages to their non-native builds (mirrors
 *    "react-native-worklets/jest/resolver"). Reanimated's "initializers" is included: its
 *    ".native" variant registers CSS event handlers that throw under jest. Reanimated 4.7+
 *    ships its own resolver that will replace this.
 * 2. Resolve imports from the symlinked wallet-common-* packages against the app's
 *    node_modules, so tests load a single copy of each (mirrors metro.config.js).
 * @param {string} request Requested module path.
 * @param {object} options Jest resolver options.
 * @returns {string} Resolved module path.
 */
module.exports = (request, options) => {
	const isWorkletsModule = options.basedir.includes('react-native-worklets') || request.includes('react-native-worklets');
	const isReanimatedInitializers = options.basedir.includes('react-native-reanimated') && request.endsWith('/initializers');
	const isCommonPackageImport = options.basedir.startsWith(commonPackagesRoot + path.sep)
		&& !request.startsWith('.')
		&& !path.isAbsolute(request);
	const resolverOptions = isWorkletsModule || isReanimatedInitializers
		? { ...options, extensions: options.extensions?.filter(extension => !extension.includes('native')) }
		: options;
	const basedir = isCommonPackageImport ? __dirname : options.basedir;

	return options.defaultResolver(request, { ...resolverOptions, basedir });
};

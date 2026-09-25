/**
 * Resolves Software Mansion animation packages to their non-native builds under jest.
 * Mirrors "react-native-worklets/jest/resolver" and additionally redirects reanimated's
 * "initializers" module: its ".native" variant registers CSS event handlers that throw on
 * the JS fallback module jest uses. Reanimated 4.7+ ships an own jest resolver replacing this.
 * @param {string} request Requested module path.
 * @param {object} options Jest resolver options.
 * @returns {string} Resolved module path.
 */
module.exports = (request, options) => {
	const isWorkletsModule = options.basedir.includes('react-native-worklets') || request.includes('react-native-worklets');
	const isReanimatedInitializers = options.basedir.includes('react-native-reanimated') && request.endsWith('/initializers');
	const resolverOptions = isWorkletsModule || isReanimatedInitializers
		? { ...options, extensions: options.extensions?.filter(extension => !extension.includes('native')) }
		: options;

	return options.defaultResolver(request, resolverOptions);
};

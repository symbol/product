const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

const defaultConfig = getDefaultConfig(__dirname);

// wallet-common-* packages are symlinked from wallet/common. 
// Block their nested node_modules so imports resolve against the app's node_modules instead (a single copy of each dependency).
const commonPackagesRoot = path.resolve(__dirname, '../../common');
const commonPackagesNodeModules = /wallet\/common\/[^/]+\/node_modules\/.*/;

const BRANDS = ['symbol', 'nem'];
const BRAND_IMPORT = '@/brand';
const brandsRoot = path.resolve(__dirname, 'src/brands');

/**
 * Resolves the brand for this bundle from the "brand" resolver option.
 * The debug app sends it in the bundle URL.
 * Release bundling passes it as "--resolver-option".
 * Throws on a missing or unknown brand, so a build never silently falls back to another brand.
 * @param {object} customResolverOptions Metro custom resolver options.
 * @returns {string} Brand id.
 */
const getBrand = customResolverOptions => {
	const brand = customResolverOptions?.brand;

	if (!BRANDS.includes(brand))
		throw new Error(`Unknown brand "${brand}". Available options: ${BRANDS.join(', ')}.`);

	return brand;
};

/**
 * Custom Metro resolver. Redirects "@/brand" imports to the current brand's folder
 * ("src/brands/<brand>/..."); every other import falls through to Metro's default resolver.
 * @param {object} context Metro resolution context.
 * @param {string} moduleName Requested module path.
 * @param {string|null} platform Target platform.
 * @returns {object} Metro resolution.
 */
const resolveBrandRequest = (context, moduleName, platform) => {
	const isBrandImport = moduleName === BRAND_IMPORT || moduleName.startsWith(`${BRAND_IMPORT}/`);

	if (!isBrandImport)
		return context.resolveRequest(context, moduleName, platform);

	const brand = getBrand(context.customResolverOptions);
	const brandModulePath = path.join(brandsRoot, brand, moduleName.slice(BRAND_IMPORT.length));

	return context.resolveRequest(context, brandModulePath, platform);
};

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro.
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
	watchFolders: [commonPackagesRoot],
	transformer: {
		getTransformOptions: async () => ({
			transform: {
				experimentalImportSupport: false,
				inlineRequires: true
			}
		})
	},
	resolver: {
		blockList: [defaultConfig.resolver.blockList, commonPackagesNodeModules],
		nodeModulesPaths: [path.resolve(__dirname, 'node_modules')],
		resolveRequest: resolveBrandRequest,
		extraNodeModules: {
			assert: require.resolve('assert'),
			buffer: require.resolve('buffer'),
			crypto: require.resolve('react-native-crypto'),
			randombytes: require.resolve('react-native-randombytes'),
			stream: require.resolve('stream-browserify'),
			path: require.resolve('path-browserify'),
			process: require.resolve('process/browser.js'),
			url: require.resolve('react-native-url-polyfill'),
			util: require.resolve('util'),
			zlib: require.resolve('browserify-zlib'), 
			'symbol-crypto-wasm-node': require.resolve('symbol-crypto-wasm-web/symbol_crypto_wasm.js')
		},
		assetExts: [...defaultConfig.resolver.assetExts, 'wasm']
	}
};

module.exports = mergeConfig(defaultConfig, config);

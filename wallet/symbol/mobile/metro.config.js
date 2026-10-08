const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

const defaultConfig = getDefaultConfig(__dirname);

// wallet-common-* packages are symlinked from wallet/common. 
// Block their nested node_modules so imports resolve against the app's node_modules instead (a single copy of each dependency).
const commonPackagesRoot = path.resolve(__dirname, '../../common');
const commonPackagesNodeModules = /wallet\/common\/[^/]+\/node_modules\/.*/;

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

const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const defaultConfig = getDefaultConfig(__dirname);
/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = {
    transformer: {
        getTransformOptions: async () => ({
            transform: {
                experimentalImportSupport: false,
                inlineRequires: true,
            },
        }),
    },
    resolver: {
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
            'symbol-crypto-wasm-node': require.resolve('symbol-crypto-wasm-web/symbol_crypto_wasm.js'),
        },
        assetExts: [...defaultConfig.resolver.assetExts, 'wasm'],
    },
};

module.exports = mergeConfig(defaultConfig, config);

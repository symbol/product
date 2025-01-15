/**
 * Metro configuration for React Native
 * https://github.com/facebook/react-native
 *
 * @format
 */
const { getDefaultConfig } = require('metro-config');

module.exports = (async () => {
    const defaultConfig = await getDefaultConfig();

    return {
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
})();

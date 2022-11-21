/**
 * Metro configuration for React Native
 * https://github.com/facebook/react-native
 *
 * @format
 */

module.exports = {
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
            process: require.resolve('process/browser.js'),
            util: require.resolve('util'),
            zlib: require.resolve('browserify-zlib'),
        }
    }
};

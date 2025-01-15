const createAlias = () => {
    const alias = {
        config: './src/config',
        src: './src',
        '@': './src',
        'symbol-sdk/symbol': './node_modules/symbol-sdk-v3/src/symbol/index.js',
        'symbol-sdk-v3/symbol': './node_modules/symbol-sdk-v3/src/symbol/index.js',
    }

    if (process.env.NODE_ENV !== 'test')
        alias['symbol-crypto-wasm-node'] = './node_modules/symbol-crypto-wasm-web/symbol_crypto_wasm.js';

    return alias;
}

const config = {
    presets: ['module:metro-react-native-babel-preset'],
    plugins: [
        '@babel/plugin-proposal-export-default-from',
        'react-native-reanimated/plugin',
        [
            require.resolve('babel-plugin-module-resolver'),
            {
                root: ['./'],
                alias: createAlias(),
            },
        ],
    ],
};

module.exports = config;

const createAlias = () => {
	const alias = {
		'@/app': './src',
		'symbol-sdk/symbol': './node_modules/symbol-sdk/src/symbol/index.js',
		'wallet-common-symbol/utils': './node_modules/wallet-common-symbol/src/utils'
	};

	if (process.env.NODE_ENV !== 'test') 
		alias['symbol-crypto-wasm-node'] = './node_modules/symbol-crypto-wasm-web/symbol_crypto_wasm.js';

	return alias;
};

const config = {
	presets: ['module:@react-native/babel-preset'],
	plugins: [
		'@babel/plugin-proposal-export-default-from',
		'react-native-reanimated/plugin',
		[
			require.resolve('babel-plugin-module-resolver'),
			{
				root: ['./'],
				alias: createAlias()
			}
		]
	]
};

module.exports = config;

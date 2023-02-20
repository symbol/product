/**
 * Check faucet configuration.
 * @param {{faucetPrivateKey: string, endpoint: string}} faucetObject protocol faucet config.
 * @param {string} name protocol name.
 */
const checkFaucetConfiguration = (faucetObject, name) => {
	if (!(faucetObject.faucetPrivateKey && faucetObject.endpoint))
		throw Error(`provided ${name} faucet private key or endpoint configuration is incomplete`);
};

export const config = {
	port: parseInt(process.env.PORT, 10) || 5001,
	mosaicDivisibility: parseInt(process.env.MOSAIC_DIVISIBILITY, 10) || 6,
	minFollowers: parseInt(process.env.MIN_FOLLOWERS_COUNT, 10) || 10,
	minAccountAge: parseInt(process.env.MIN_ACCOUNT_AGE, 10) || 30,
	receiptMaxBalance: parseInt(process.env.RECEIPT_MAX_BALANCE, 10) || 200000000,
	sendOutMaxAmount: parseInt(process.env.SEND_OUT_MAX_AMOUNT, 10) || 500000000,
	network: 'testnet',
	jwtSecret: process.env.JWT_SECRET,
	nem: {
		faucetPrivateKey: process.env.NEM_FAUCET_PRIVATE_KEY,
		endpoint: process.env.NEM_ENDPOINT
	},
	symbol: {
		faucetPrivateKey: process.env.SYMBOL_FAUCET_PRIVATE_KEY,
		endpoint: process.env.SYMBOL_ENDPOINT
	}
};

export const validateConfiguration = configParams => {
	const { nem, symbol, jwtSecret } = configParams;

	checkFaucetConfiguration(nem, 'nem');

	checkFaucetConfiguration(symbol, 'symbol');

	if (!jwtSecret)
		throw Error('provided jwt configuration is incomplete');
};

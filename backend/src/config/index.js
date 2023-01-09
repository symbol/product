export const config = {
	port: parseInt(process.env.PORT, 10) || 5001,
	mosaicDivisibility: parseInt(process.env.MOSAIC_DIVISIBILITY, 10) || 6,
	minFollowers: parseInt(process.env.MIN_FOLLOWERS_COUNT, 10) || 10,
	minAccountAge: parseInt(process.env.MIN_ACCOUNT_AGE, 10) || 30,
	receiptMaxBalance: parseInt(process.env.RECEIPT_MAX_BALANCE, 10) || 200000000,
	sendOutMaxAmount: parseInt(process.env.SEND_OUT_MAX_AMOUNT, 10) || 500000000,
	network: 'testnet',
	nemFaucetPrivateKey: process.env.NEM_FAUCET_PRIVATE_KEY,
	nemEndpoint: process.env.NEM_ENDPOINT,
	jwtSecret: process.env.JWT_SECRET
};

export const validateConfiguration = configParams => {
	if (!(configParams.nemFaucetPrivateKey && configParams.nemEndpoint))
		throw Error('provided nem faucet private key or endpoint configuration is incomplete');

	if (!configParams.jwtSecret)
		throw Error('provided jwt configuration is incomplete');
};

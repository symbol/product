const { config } = require('../config');
const nemController = require('../controllers/nem');
const {
	nemFaucetValidation, toAbsoluteAmount, toRelativeAmount
} = require('../utils/helper');
const restifyErrors = require('restify-errors');
const { CryptoTypes } = require('symbol-sdk');
const { NemFacade } = require('symbol-sdk').facade;

const facade = new NemFacade(config.network);

const handleRoute = async (res, next, handler) => {
	try {
		const result = await handler();

		if (result instanceof Error)
			return next(result);

		res.send(result);
		return next(false);
	} catch (error) {
		return next(error);
	}
};

const faucetRoute = server => {
	server.post('/claim/xem', (req, res, next) => {
		const receiptAddress = req.body.address;
		const transferAmount = toAbsoluteAmount((parseInt(req.body.amount, 10) || 0));

		const privateKey = new CryptoTypes.PrivateKey(config.nemFaucetPrivateKey);
		const keyPair = new NemFacade.KeyPair(privateKey);
		const faucetAddress = facade.network.publicKeyToAddress(keyPair.publicKey).toString();

		const handler = async () => {
			const [
				{ balance: receiptBalance },
				{ balance: faucetBalance },
				unconfirmedTransactions
			] = await Promise.all([
				nemController.getAccountBalance(receiptAddress),
				nemController.getAccountBalance(faucetAddress),
				nemController.getUnconfirmedTransactions(receiptAddress)
			]);

			const error = nemFaucetValidation({
				receiptAddress,
				transferAmount,
				receiptBalance,
				faucetBalance,
				unconfirmedTransactions
			});

			if ('' !== error)
				return new restifyErrors.BadRequestError(error);

			// Announce Transfer Transaction
			const { code, type, transactionHash } = await nemController.transferXem(transferAmount, receiptAddress);

			return {
				code,
				type,
				transactionHash: transactionHash.data,
				amount: toRelativeAmount(transferAmount),
				receiptAddress
			};
		};

		handleRoute(res, next, handler);
	});

	// Todo
	// server.post('/claim/xym', (req, res, next) => {});
};

module.exports = faucetRoute;

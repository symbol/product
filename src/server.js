const nemController = require('./controllers/nem');
const { nemFaucetValidation, toAbsoluteAmount, toRelativeAmount } = require('./utils/helper');
const dotenv = require('dotenv');
const restify = require('restify');
const restifyErrors = require('restify-errors');

dotenv.config();

const server = restify.createServer();

server.use(restify.plugins.bodyParser());

server.post('/claim/xem', async (req, res, next) => {
	const receiptAddress = req.body.address;
	const transferAmount = toAbsoluteAmount((parseInt(req.body.amount, 10) || 0));
	const faucetAddress = process.env.NEM_FAUCET_ADDRESS;

	try {
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
			return next(new restifyErrors.BadRequestError(error));

		// Announce Transfer Transaction
		const result = await nemController.transferXem(transferAmount, receiptAddress);

		res.send({
			code: result.code,
			type: result.type,
			transactionHash: result.transactionHash.data,
			amount: toRelativeAmount(transferAmount),
			receiptAddress
		});

		return next(false);
	} catch (error) {
		return next(error);
	}
});

// Todo
// server.post('/claim/xym', (req, res, next) => {});

server.listen(process.env.PORT, () => {
	console.info('%s listening at %s', server.name, server.url);
});

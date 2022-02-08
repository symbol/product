import NemController from './controllers/nem';
import Helper from './utils/helper';
import dotenv from 'dotenv';
import restify from 'restify';
import restifyErrors from 'restify-errors';

dotenv.config();

const server = restify.createServer();

server.use(restify.plugins.bodyParser());

server.post('/claim/xem', async (req, res, next) => {
	const receiptAddress = req.body.address;
	const transferAmount = Helper.toAbsoluteAmount((parseInt(req.body.amount, 10) || 0));
	const faucetAddress = process.env.NEM_FAUCET_ADDRESS;

	try {
		const [
			{ balance: receiptBalance },
			{ balance: faucetBalance },
			unconfirmedTransactions
		] = await Promise.all([
			NemController.getAccountBalance(receiptAddress),
			NemController.getAccountBalance(faucetAddress),
			NemController.getUnconfirmedTransactions(receiptAddress)
		]);

		const error = Helper.nemFaucetValidation({
			receiptAddress,
			transferAmount,
			receiptBalance,
			faucetBalance,
			unconfirmedTransactions
		});

		if ('' !== error)
			return next(new restifyErrors.BadRequestError(error));

		// Announce Transfer Transaction
		const result = await NemController.transferXem(transferAmount, receiptAddress);

		res.send({
			code: result.code,
			type: result.type,
			transactionHash: result.transactionHash.data,
			amount: Helper.toRelativeAmount(transferAmount),
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

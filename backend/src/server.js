const nemController = require('./controllers/nem');
const {
	nemFaucetValidation, toAbsoluteAmount, toRelativeAmount, checkTwitterAccount
} = require('./utils/helper');
const { verify } = require('jsonwebtoken');
const restify = require('restify');
const restifyErrors = require('restify-errors');

const server = restify.createServer();

server.use(restify.plugins.acceptParser('application/json'));
server.use(restify.plugins.bodyParser());
server.use(restify.plugins.queryParser({ mapParams: true }));

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

const authentication = (req, res, next) => {
	const authToken = req.header('authToken');

	try {
		const { createdAt, followersCount } = verify(authToken, process.env.JWT_SECRET);

		if (checkTwitterAccount(createdAt, followersCount))
			next();
		else
			next(new restifyErrors.ForbiddenError('Twitter requirement fail'));
	} catch (error) {
		next(new restifyErrors.ForbiddenError('Authentication fail'));
	}
};

// Middleware
server.use(authentication);

// Setup cross domain access
server.use((req, res, next) => {
	res.header('Access-Control-Allow-Origin', '*');
	res.header('Access-Control-Allow-Headers', 'Content-Type');
	res.header('Access-Control-Allow-Methods', 'POST, GET');
	next();
});

server.post('/claim/xem', async (req, res, next) => {
	const receiptAddress = req.body.address;
	const transferAmount = toAbsoluteAmount((parseInt(req.body.amount, 10) || 0));
	const faucetAddress = process.env.NEM_FAUCET_ADDRESS;

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

server.listen(process.env.PORT, () => {
	// eslint-disable-next-line no-console
	console.info('%s listening at %s', server.name, server.url);
});

module.exports = server;

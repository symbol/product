import { config } from '../config/index.js';
import helper from '../utils/helper.js';
import restifyErrors from 'restify-errors';

const claim = async (protocolFacade, {
	recipientAddress,
	transferAmount
}) => {
	const [
		receiptBalance,
		faucetBalance,
		unconfirmedTransactionsCount
	] = await Promise.all([
		protocolFacade.getAccountBalance(recipientAddress),
		protocolFacade.getAccountBalance(protocolFacade.faucetAddress()),
		protocolFacade.getUnconfirmedTransactionsCount(recipientAddress)
	]);

	const error = helper.faucetValidation({
		transferAmount,
		receiptBalance,
		faucetBalance,
		unconfirmedTransactionsCount
	});

	if ('' !== error)
		return new restifyErrors.BadRequestError(error);

	// Announce Transfer Transaction
	const transactionHash = await protocolFacade.transfer(transferAmount, recipientAddress);

	return {
		transactionHash,
		amount: helper.toRelativeAmount(transferAmount),
		recipientAddress
	};
};

const routeUtils = {
	claimRoute: async (req, res, next, protocolFacade) => {
		const twitterUsername = req.body.twitterHandle;
		const recipientAddress = req.body.address;
		const transferAmount = helper.toAbsoluteAmount((parseFloat(req.body.amount).toFixed(config.mosaicDivisibility) || 0));

		if (!protocolFacade.isValidAddress(recipientAddress)) {
			res.send(new restifyErrors.BadRequestError('error_address_invalid'));
			return next(false);
		}

		const result = await claim(protocolFacade, {
			recipientAddress,
			transferAmount
		});

		if (result instanceof Error)
			return next(result);

		res.send(result);

		// Return result for database insertion
		return {
			address: recipientAddress,
			amount: transferAmount,
			twitterHandle: twitterUsername
		};
	},

	configAndBalanceRoute: async (res, next, protocolFacade) => {
		const faucetBalance = await protocolFacade.getAccountBalance(protocolFacade.faucetAddress());

		res.send({
			...protocolFacade.config(),
			faucetBalance
		});

		return next(false);
	}
};

export default routeUtils;

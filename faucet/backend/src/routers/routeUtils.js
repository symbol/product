import { config } from '../config/index.js';
import HttpError from '../errors/httpError.js';
import helper from '../utils/helper.js';

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
		throw new HttpError(400, 'BadRequest', error);

	// Announce Transfer Transaction
	const transactionHash = await protocolFacade.transfer(transferAmount, recipientAddress);

	return {
		transactionHash,
		amount: helper.toRelativeAmount(transferAmount),
		recipientAddress
	};
};

const routeUtils = {
	claimRoute: async (request, protocolFacade) => {
		const twitterUsername = request.body.twitterHandle;
		const recipientAddress = request.body.address;
		const transferAmount = helper.toAbsoluteAmount((parseFloat(request.body.amount).toFixed(config.mosaicDivisibility) || 0));

		if (!protocolFacade.isValidAddress(recipientAddress))
			throw new HttpError(400, 'BadRequest', 'error_address_invalid');

		const response = await claim(protocolFacade, {
			recipientAddress,
			transferAmount
		});

		return {
			response,
			claimRecord: {
				address: recipientAddress,
				amount: transferAmount,
				twitterHandle: twitterUsername
			}
		};
	},

	configAndBalanceRoute: async protocolFacade => {
		const faucetBalance = await protocolFacade.getAccountBalance(protocolFacade.faucetAddress());

		return {
			...protocolFacade.config(),
			faucetBalance
		};
	}
};

export default routeUtils;

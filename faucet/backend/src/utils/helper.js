import { config } from '../config/index.js';

const helper = {
	/**
	 * Convert Absolute to Relative amount.
	 * @param {number} amount Absolute amount.
	 * @returns {number} Relative amount.
	 */
	toRelativeAmount: amount => amount / (10 ** config.mosaicDivisibility),

	/**
	 * Convert Relative to Absolute amount.
	 * @param {number} amount Relative amount.
	 * @returns {number} Absolute amount.
	 */
	toAbsoluteAmount: amount => amount * (10 ** config.mosaicDivisibility),

	/**
	 * Validation of claim faucet.
	 * @param {number} transferAmount Amount for transfer.
	 * @param {number} receiptBalance Receipt balance.
	 * @param {number} faucetBalance Faucet balance.
	 * @param {number} unconfirmedTransactionsCount no of unconfirmed transactions.
	 * @returns {string} Error message.
	 */
	faucetValidation: ({
		transferAmount, receiptBalance, faucetBalance, unconfirmedTransactionsCount
	}) => {
		const maxAmount = config.receiptMaxBalance;
		const maxTransferAmount = config.sendOutMaxAmount;

		let error = '';

		if (transferAmount > maxTransferAmount)
			error = 'error_amount_max_request';

		if (receiptBalance >= maxAmount)
			error = 'error_account_high_balance';

		if (faucetBalance < transferAmount)
			error = 'error_fund_drains';

		if (0 < unconfirmedTransactionsCount)
			error = 'error_transaction_pending';

		return error;
	},

	/**
	 * Check on twitter requirements.
	 * @param {string} createdAt twitter's account created date.
	 * @param {number} followersCount twitter's account followers
	 * @returns {boolean} boolean
	 */
	checkTwitterAccount: (createdAt, followersCount) => {
		const diff = new Date() - new Date(createdAt);
		const accountAge = Math.floor(diff / (1000 * 60 * 60 * 24));

		return config.minFollowers <= followersCount && config.minAccountAge < accountAge;
	},

	/**
	 * Sign transaction with key pair.
	 * @param {NemFacade | SymbolFacade} protocolFacade facade protocol.
	 * @param {KeyPair} keyPair account key pair.
	 * @param {object} transferTransaction transaction object.
	 * @returns {{ transactionHash: string, payload:string }} signed transaction payload and hash.
	 */
	signTransaction: (protocolFacade, keyPair, transferTransaction) => {
		const signature = protocolFacade.signTransaction(keyPair, transferTransaction);
		const jsonPayload = protocolFacade.transactionFactory.constructor.attachSignature(transferTransaction, signature);

		return {
			transactionHash: protocolFacade.hashTransaction(transferTransaction).toString(),
			payload: JSON.parse(jsonPayload)
		};
	}
};

export default helper;

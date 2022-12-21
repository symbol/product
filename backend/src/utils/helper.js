const { config } = require('../config');

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
	 * Validation of claim nem faucet.
	 * @param {string} receiptAddress Receipt address.
	 * @param {number} transferAmount Amount for transfer.
	 * @param {number} receiptBalance Receipt balance.
	 * @param {number} faucetBalance Faucet balance.
	 * @param {array} unconfirmedTransactions list of unconfirmed transactions.
	 * @returns {string} Error message.
	 */
	nemFaucetValidation: ({
		receiptAddress, transferAmount, receiptBalance, faucetBalance, unconfirmedTransactions
	}) => {
		const maxAmount = config.receiptMaxBalance;
		const maxTransferAmount = config.sendOutMaxAmount;
		const pendingTx = unconfirmedTransactions.filter(item => item.transaction.recipient === receiptAddress);

		let error = '';

		if (transferAmount >= maxTransferAmount)
			error = `Transfer amount cannot more than ${helper.toRelativeAmount(maxTransferAmount)}`;

		if (receiptBalance >= maxAmount)
			error = 'Your account balance is too high';

		if (faucetBalance < transferAmount)
			error = 'Faucet balance not enough to pay out';

		if (0 < pendingTx.length)
			error = 'You have pending transactions, please wait for it to be confirmed';

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
	}
};

module.exports = helper;

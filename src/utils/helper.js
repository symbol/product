/*
 * (C) Symbol Contributors 2021
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and limitations under the License.
 *
 */

const nemSDK = require('nem-sdk');

const helper = {
	/**
   	 * Convert Absolute to Relative amount.
   	 * @param {number} amount Absolute amount.
   	 * @returns {number} Relative amount.
   	 */
	toRelativeAmount: amount => amount / (10 ** process.env.MOSAIC_DIVISIBILITY),

	/**
   	 * Convert Relative to Absolute amount.
   	 * @param {number} amount Relative amount.
   	 * @returns {number} Absolute amount.
   	 */
	toAbsoluteAmount: amount => amount * (10 ** process.env.MOSAIC_DIVISIBILITY),

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
		const maxAmount = parseInt(process.env.RECEIPT_MAX_BALANCE, 10);
		const maxTransferAmount = parseInt(process.env.SEND_OUT_MAX_AMOUNT, 10);
		const pendingTx = unconfirmedTransactions.filter(item => item.transaction.recipient === receiptAddress);

		let error = '';

		if (!nemSDK.model.address.isValid(receiptAddress))
			error = 'Address Invalid';

		if (transferAmount >= maxTransferAmount)
			error = `Transfer amount can not more than ${this.toRelativeAmount(maxTransferAmount)}`;

		if (receiptBalance.balance >= maxAmount)
			error = 'Your account already has enough balance.';

		if (faucetBalance.balance < transferAmount)
			error = 'Faucet balance not enough to pay out.';

		if (0 < pendingTx.length)
			error = 'You have pending transaction, please wait for it to be confirmed.';

		return error;
	}
};

module.exports = helper;

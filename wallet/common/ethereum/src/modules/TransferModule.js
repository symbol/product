import { TransactionType } from '../constants';
import { createTransactionFeeTiers } from '../utils';
import { TransactionBundle } from 'wallet-common-core';

/** @typedef {import('../types/Transaction').Transaction} Transaction */
/** @typedef {import('../types/Transaction').TransactionFeeTires} TransactionFeeTires */

export class TransferModule {
	static name = 'transfer';
	#walletController;
	#api;

	constructor() {}

	init = options => {
		this.#walletController = options.walletController;
		this.#api = options.api;
	};

	loadCache = async () => {};

	resetState = () => {};

	clear = () => {};

	/**
     * Prepares a transfer transaction.
     * @param {object} options - The transfer options.
     * @param {string} options.recipientAddress - The recipient address or alias.
     * @param {object[]} options.tokens - The tokens to transfer.
	 * @param {object} options.fee - The transaction fee.
     * @param {string} [password] - The wallet password.
     * @returns {TransactionBundle} The transfer transaction.
     */
	createTransaction = async options => {
		const { recipientAddress, tokens, fee } = options;
		const { currentAccount, networkProperties } = this.#walletController;

		const nonce = await this.#api.transaction.fetchTransactionNonce(networkProperties, currentAccount.address);

		const transaction = {
			type: tokens[0].id === networkProperties.networkCurrency.id 
				? TransactionType.TRANSFER 
				: TransactionType.ERC_20_TRANSFER,
			signerPublicKey: currentAccount.publicKey,
			signerAddress: currentAccount.address,
			recipientAddress,
			tokens,
			nonce,
			fee
		};

		return new TransactionBundle([transaction]);
	};

	/**
	 * Calculates the transaction fees for a given transaction.
	 * @param {TransactionBundle} transactionBundle - The transaction bundle.
	 * @returns {TransactionFeeTires} The transaction fees.
	 */
	calculateTransactionFees = async transactionBundle => {
		const { networkProperties } = this.#walletController;

		return Promise.all(transactionBundle.transactions.map(async transaction => {
			const gasLimit = await this.#api.transaction.estimateTransactionGasLimit(networkProperties, transaction);

			return createTransactionFeeTiers(networkProperties, gasLimit);
		}));
	};
}

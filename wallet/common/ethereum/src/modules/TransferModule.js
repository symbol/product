import { NETWORK_CURRENCY_ID, TransactionType } from '../constants';

/** @typedef {import('../types/Transaction').Transaction} Transaction */

export class TransferModule {
	static name = 'transfer';
	#root;
	#api;

	constructor() {}

	init = options => {
		this.#root = options.root;
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
     * @returns {Transaction} The transfer transaction.
     */
	createTransaction = async options => {
		const { recipientAddress, tokens, fee } = options;
		const { currentAccount, networkProperties } = this.#root;

		const nonce = await this.#api.transaction.fetchTransactionNonce(networkProperties, currentAccount.address);

		const transaction = {
			type: tokens[0].id === NETWORK_CURRENCY_ID ? TransactionType.TRANSFER : TransactionType.ERC_20_TRANSFER,
			signerPublicKey: currentAccount.publicKey,
			signerAddress: currentAccount.address,
			recipientAddress,
			tokens,
			nonce,
			fee
		};

		return transaction;
	};
}

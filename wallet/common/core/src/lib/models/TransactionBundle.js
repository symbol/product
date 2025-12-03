/** @typedef {import('../../types/Transaction').Transaction} Transaction */
/** @typedef {import('../../types/Transaction').SignedTransaction} SignedTransaction */
/** @typedef {import('../../types/Transaction').TransactionFeeTiers} TransactionFeeTiers */
/** @typedef {import('../../types/Transaction').TransactionFeeTierLevel} TransactionFeeTierLevel */

import { safeOperationWithRelativeAmounts } from '../../utils/convert';

export class TransactionBundle {
	/**
     * @param {Array<Transaction|SignedTransaction>} transactions - Array of transactions.
     * @param {object} [metadata] - Optional metadata associated with the transaction bundle.
     */
	constructor(transactions, metadata = {}) {
		if (!Array.isArray(transactions) || transactions.length === 0)
			throw new Error('Transaction bundle must contain at least one transaction.');

		this._transactions = transactions;
		this._metadata = metadata;
	}

	/**
     * Get the array of transactions in the bundle.
     * @returns {Array<Transaction|SignedTransaction>} The array of transactions.
     */
	get transactions() {
		return this._transactions;
	}

	/**
     * Get the metadata associated with the transaction bundle.
     * @returns {object} The metadata object.
     */
	get metadata() {
		return this._metadata;
	}

	/**
     * Check if the transaction bundle is composite (contains multiple transactions).
     * @returns {boolean} True if the bundle is composite, false otherwise.
     */
	get isComposite() {
		return this._transactions.length > 1;
	}

	/**
     * Get the first transaction in the bundle.
     * @returns {Transaction|SignedTransaction|null} The first transaction, or null if the bundle is empty.
     */
	get firstTransaction() {
		return this._transactions[0] || null;
	}

	/**
	 * Calculate the total fee amount for all transactions in the bundle.
	 * Expected that all transactions have fees in the same token.
	 * @returns {string} The total fee amount as a string.
	 */
	get totalFeeAmount() {
		if (!this.firstTransaction.fee)
			return '0';

		const add = (...args) => args.reduce((a, b) => a + b, 0n);
		const { divisibility } = this.firstTransaction.fee.token;
		
		return safeOperationWithRelativeAmounts(
			divisibility,
			this.transactions.map(transactions => transactions.fee.token.amount),
			add
		);
	}

	/**
     * Apply fees for each transaction in the bundle.
     * @param {TransactionFeeTiers[]} transactionFeeTiers - Array of fees corresponding to each transaction.
     * @param {TransactionFeeTierLevel} level - Fee tier level to apply.
     */
	applyFeeTier = (transactionFeeTiers, level) => {
		if (transactionFeeTiers?.length !== this._transactions.length)
			throw new Error('Failed to apply transaction fees. Mismatched number of transactions and fees.');

		this._transactions.forEach((tx, index) => {
			tx.fee = transactionFeeTiers[index][level];
		});
	};

	/**
     * Convert the transaction bundle to a JSON object.
     * @returns {object} The JSON representation of the transaction bundle.
     */
	toJSON = () => {
		return {
			transactions: this._transactions,
			metadata: this._metadata
		};
	};

	/**
     * Create a TransactionBundle instance from a JSON object.
     * @param {object} json - The JSON object representing a transaction bundle.
     * @returns {TransactionBundle} The created TransactionBundle instance.
     */
	static fromJSON = json => {
		return new TransactionBundle(json.transactions, json.metadata);
	};
}

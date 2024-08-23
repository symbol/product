import symbolClient from '../services/symbolClient.js';
import stateManager from '../stateManager.js';
import moment from 'moment'; // eslint-disable-line
import { PublicKey } from 'symbol-sdk';
import { SymbolFacade, models } from 'symbol-sdk/symbol';

const getTransactionTypeName = inputTyeValue => models.TransactionType.valueToKey(inputTyeValue)
	.toLowerCase()
	.split('_')
	.map(word => word.charAt(0).toUpperCase() + word.slice(1))
	.join(' ');

const transactionUtils = {
	/**
     * Fetch account transactions and aggregate inner transactions.
     * @param {{ state: object, requestParams: object }} params - The request params.
     * @returns {Promise<Array<TransactionInfo>>} - The account transactions.
     */
	async fetchAccountTransactions({ state, requestParams }) {
		const { network } = state;
		const { address, offsetId, group } = requestParams;

		const client = symbolClient.create(network.url);

		const transactions = await client.fetchTransactionPageByAddress(address, offsetId, group);

		const aggregateIds = [];

		transactions.forEach(({ id, transaction }) => {
			if (this.isAggregateTransaction(transaction))
				aggregateIds.push(id);
		});

		if (aggregateIds.length) {
			const innerTransactions = await client.fetchInnerTransactionByAggregateIds(aggregateIds);

			transactions.forEach(({ id, transaction }) => {
				if (innerTransactions[id])
					transaction.innerTransactions = innerTransactions[id];
			});
		}

		return this.formatTransactionToFlat(transactions, network);
	},
	/**
     * Check if transaction is aggregate complete or aggregate bonded.
     * @param {*} transaction - The transaction object from rest.
     * @returns {boolean} returns true if transaction is aggregate.
     */
	isAggregateTransaction(transaction) {
		return [models.TransactionType.AGGREGATE_COMPLETE.value, models.TransactionType.AGGREGATE_BONDED.value].includes(transaction.type);
	},
	/**
     * Format transactions to flat object.
     * @param {Array<object>} transactions - The transactions.
     * @param {object} network - The network state.
     * @returns {Array<TransactionInfo>} - The flat transactions.
     */
	formatTransactionToFlat(transactions, network) {
		const flatTransactions = [];

		transactions.forEach(({ id, meta, transaction }) => {
			const pushTransaction = (tx, suffix = '') => {
				const typeLabel = suffix ? `${suffix} | ${getTransactionTypeName(tx.type)}` : '';
				flatTransactions.push(this.createTransaction(id, meta, tx, network, typeLabel));
			};

			if (transaction.type === models.TransactionType.TRANSFER.value) {
				pushTransaction(transaction);
			} else if (this.isAggregateTransaction(transaction)) {
				transaction.innerTransactions.forEach(innerTransaction => {
					pushTransaction(innerTransaction.transaction, `${getTransactionTypeName(transaction.type)}`);
				});
			} else {
				pushTransaction(transaction);
			}
		});

		return flatTransactions;
	},
	/**
     * Create custom transaction object.
     * @param {string} id - The transaction id.
     * @param {object} meta - The transaction meta.
     * @param {object} transaction - The transaction object.
     * @param {object} network - The network state.
     * @param {string} transactionTypeOverride - The transaction type override.
     * @returns {TransactionInfo} - The transaction object.
     */
	createTransaction(id, meta, transaction, network, transactionTypeOverride = null) {
		const facade = new SymbolFacade(network.networkName);
		const senderAddress = facade.network.publicKeyToAddress(new PublicKey(transaction.signerPublicKey)).toString();

		const date = meta.timestamp
			? moment.utc(facade.network.toDatetime({ timestamp: BigInt(meta.timestamp) })).format('YYYY-MM-DD HH:mm:ss')
			: null;

		const isTransferTransaction = transaction.type === models.TransactionType.TRANSFER.value;

		const getXymAmount = mosaics => {
			const xymMosaic = mosaics.find(mosaic => mosaic.id === network.currencyMosaicId);
			return xymMosaic?.amount || 0;
		};

		return {
			id,
			date,
			height: meta.height,
			transactionHash: meta.hash,
			transactionType: transactionTypeOverride || getTransactionTypeName(transaction.type),
			amount: isTransferTransaction ? getXymAmount(transaction.mosaics) : null,
			message: isTransferTransaction ? (transaction.message || null) : null,
			sender: senderAddress
		};
	},
	getFeeMultiplier: async ({ state }) => {
		const { network } = state;
		const client = symbolClient.create(network.url);

		const feeMultiplier = await client.fetchTransactionFeeMultiplier();

		state.feeMultiplier = feeMultiplier;

		await stateManager.update(state);

		return feeMultiplier;
	}
};

export default transactionUtils;

// region type declarations

/**
 * state of create transaction object.
 * @typedef {object} TransactionInfo
 * @property {string} id - The transaction id.
 * @property {string | null} date - The transaction date time.
 * @property {number} height - The transaction block height.
 * @property {string} transactionHash - The transaction hash.
 * @property {string} transactionType - The transaction type.
 * @property {number | null} amount - The transaction XYM amount.
 * @property {string | null} message - The transaction message.
 * @property {string} sender - The sender address.
 */

// endregion

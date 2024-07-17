import symbolClient from '../services/symbolClient.js';
import moment from 'moment'; // eslint-disable-line
import { PublicKey } from 'symbol-sdk';
import { SymbolFacade } from 'symbol-sdk/symbol';

const AGGREGATE_COMPLETE_TRANSACTION_TYPE = 16705;
const AGGREGATE_BONDED_TRANSACTION_TYPE = 16961;
const TRANSFER_TRANSACTION_TYPE = 16724;

const TRANSACTION_TYPE = {
	16724: 'Transfer',
	16718: 'Namespace Registration',
	16974: 'Address Alias',
	17230: 'Mosaic Alias',
	16717: 'Mosaic Definition',
	16973: 'Mosaic Supply Change',
	17229: 'Mosaic Supply Revocation',
	16725: 'Multisig Account Modification',
	16705: 'Aggregate Complete',
	16961: 'Aggregate Bonded',
	16712: 'Hash Lock',
	16722: 'Secret Lock',
	16978: 'Secret Proof',
	16720: 'Account Address Restriction',
	16976: 'Account Mosaic Restriction',
	17232: 'Account Operation Restriction',
	16716: 'Account Key Link',
	16977: 'Mosaic Address Restriction',
	16721: 'Mosaic Global Restriction',
	16708: 'Account Metadata',
	16964: 'Mosaic Metadata',
	17220: 'Namespace Metadata',
	16963: 'VRF Key Link',
	16707: 'Voting Key Link',
	16972: 'Node Key Link'
};

const transactionUtils = {
	/**
     * Fetch account transactions and aggregate inner transactions.
     * @param {{ state: object, requestParams: object }} params - The request params.
     * @returns {Promise<Array<TransactionInfo>>} - The account transactions.
     */
	async fetchAccountTransactions({ state, requestParams }) {
		const { network } = state;
		const { address, offsetId } = requestParams;

		const client = symbolClient.create(network.url);

		const transactions = await client.fetchTransactionPageByAddress(address, offsetId);

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
		return [AGGREGATE_COMPLETE_TRANSACTION_TYPE, AGGREGATE_BONDED_TRANSACTION_TYPE].includes(transaction.type);
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
				const typeLabel = suffix ? `${suffix} | ${TRANSACTION_TYPE[tx.type]}` : '';
				flatTransactions.push(this.createTransaction(id, meta, tx, network, typeLabel));
			};

			if (transaction.type === TRANSFER_TRANSACTION_TYPE) {
				pushTransaction(transaction);
			} else if (this.isAggregateTransaction(transaction)) {
				transaction.innerTransactions.forEach(innerTransaction => {
					pushTransaction(innerTransaction.transaction, `${TRANSACTION_TYPE[transaction.type]}`);
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
		const date = moment.utc(facade.network.toDatetime({ timestamp: BigInt(meta.timestamp) })).format('YYYY-MM-DD HH:mm:ss');

		const isTransferTransaction = transaction.type === TRANSFER_TRANSACTION_TYPE;

		const getXymAmount = mosaics => {
			const xymMosaic = mosaics.find(mosaic => mosaic.id === network.currencyMosaicId);
			return xymMosaic?.amount || 0;
		};

		return {
			id,
			date,
			height: meta.height,
			transactionHash: meta.hash,
			transactionType: transactionTypeOverride || TRANSACTION_TYPE[transaction.type],
			amount: isTransferTransaction ? getXymAmount(transaction.mosaics) : null,
			message: isTransferTransaction ? (transaction.message || null) : null,
			sender: senderAddress
		};
	}
};

export default transactionUtils;

// region type declarations

/**
 * state of create transaction object.
 * @typedef {object} TransactionInfo
 * @property {string} id - The transaction id.
 * @property {string} date - The transaction date time.
 * @property {number} height - The transaction block height.
 * @property {string} transactionHash - The transaction hash.
 * @property {string} transactionType - The transaction type.
 * @property {number | null} amount - The transaction XYM amount.
 * @property {string | null} message - The transaction message.
 * @property {string} sender - The sender address.
 */

// endregion

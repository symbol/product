import fetchUtils from '../utils/fetchUtils.js';
import { utils } from 'symbol-sdk';
import { Address } from 'symbol-sdk/symbol';

const symbolClient = {
	create(nodeUrl) {
		return {
			/**
			 * Fetch native mosaic from network properties.
			 * @returns {Promise<string>} the network currency mosaic id
			 */
			fetchNetworkCurrencyMosaicId: async () => {
				try {
					const { chain } = await fetchUtils.fetchData(`${nodeUrl}/network/properties`);
					return chain.currencyMosaicId.slice(2).replace(/'/g, '');
				} catch (error) {
					throw new Error(`Failed to fetch network properties info: ${error.message}`);
				}
			},
			/**
			 * Fetch mosaics info from mosaic ids.
			 * @param {Array<string>} mosaicIds - The mosaic ids to fetch info.
			 * @returns {Promise<object<string, MosaicsInfo>>} The mosaics info.
			 */
			fetchMosaicsInfo: async mosaicIds => {
				if (!mosaicIds.length)
					return {};

				try {
					const mosaics = await fetchUtils.fetchData(`${nodeUrl}/mosaics`, 'POST', { mosaicIds });

					return mosaics.reduce((mosaicObj, { mosaic }) => {
						const { id, divisibility } = mosaic;
						mosaicObj[id] = { divisibility };
						return mosaicObj;
					}, {});
				} catch (error) {
					throw new Error(`Failed to fetch mosaics info: ${error.message}`);
				}
			},
			/**
			 * Fetch accounts mosaics from addresses.
			 * @param {Array<string>} addresses - The addresses to fetch mosaics.
			 * @returns {Promise<object<string, Array<AccountMosaics>>>} The accounts mosaics.
			 */
			fetchAccountsMosaics: async addresses => {
				if (!addresses.length)
					return {};

				try {
					const accounts = await fetchUtils.fetchData(`${nodeUrl}/accounts`, 'POST', { addresses });

					return accounts.reduce((acc, { account }) => {
						const address = new Address(utils.hexToUint8(account.address)).toString();
						acc[address] = account.mosaics;
						return acc;
					}, {});
				} catch (error) {
					throw new Error(`Failed to fetch account mosaics: ${error.message}`);
				}
			},
			/**
			 * Fetch mosaics namespace from mosaic ids.
			 * @param {Array<string>} mosaicIds - The mosaic ids to fetch namespace.
			 * @returns {Promise<Record<string, Array<string>>>} The mosaics namespace.
			 */
			fetchMosaicNamespace: async mosaicIds => {
				if (!mosaicIds.length)
					return {};

				try {
					const mosaicNamespace = {};

					const { mosaicNames } = await fetchUtils.fetchData(`${nodeUrl}/namespaces/mosaic/names`, 'POST', { mosaicIds });

					mosaicNames.forEach(({ mosaicId, names }) => {
						mosaicNamespace[mosaicId] = names;
					});

					return mosaicNamespace;
				} catch (error) {
					throw new Error(`Failed to fetch mosaics namespace: ${error.message}`);
				}
			},
			/**
			 * Fetch transactions page by address with offset id.
			 * @param {string} address - The address to account.
			 * @param {string} offsetId - The offset id of transaction.
			 * @param {'confirmed' | 'unconfirmed'} group - The group of transactions.
			 * @returns {Promise<Array<Transaction>>} The transactions page.
			 */
			fetchTransactionPageByAddress: async (address, offsetId = '', group = 'confirmed') => {
				if (!address)
					throw new Error('Address is required');

				try {
					const url = `${nodeUrl}/transactions/${group}?order=desc&address=${address}&offset=${offsetId}&pageSize=10`;

					const transactions = await fetchUtils.fetchData(url);
					return transactions.data;
				} catch (error) {
					throw new Error(`Failed to fetch transactions page by address: ${error.message}`);
				}
			},
			/**
			 * Fetch and extract inner transactions.
			 * @param {Array<string>} transactionIds - The transaction id.
			 * @param {'confirmed' | 'unconfirmed'} group - The group of transaction.
			 * @returns {Promise<Record<string, Array<Transaction>>>} The transaction.
			 */
			fetchInnerTransactionByAggregateIds: async (transactionIds, group = 'confirmed') => {
				if (!transactionIds.length)
					return {};

				try {
					const innerTransactions = {};

					const transactions = await fetchUtils.fetchData(`${nodeUrl}/transactions/${group}/ids`, 'POST', { transactionIds });

					transactions.forEach(({ id, transaction }) => {
						innerTransactions[id] = transaction.transactions;
					});

					return innerTransactions;
				} catch (error) {
					throw new Error(`Failed to fetch inner transactions by aggregate ids: ${error.message}`);
				}
			},
			/**
			 * Fetch transaction fee multiplier.
			 * @returns {Promise<FeeMultiplier>} The transaction fee multiplier.
			 */
			fetchTransactionFeeMultiplier: async () => {
				try {
					const fees = await fetchUtils.fetchData(`${nodeUrl}/network/fees/transaction`);

					return {
						slow: fees.minFeeMultiplier,
						average: fees.averageFeeMultiplier,
						fast: fees.highestFeeMultiplier
					};
				} catch (error) {
					throw new Error(`Failed to fetch transaction fee multiplier: ${error.message}`);
				}
			}
		};
	}
};

export default symbolClient;

// region type declarations

/**
 * state of the mosaic info.
 * @typedef {object} MosaicsInfo
 * @property {number} divisibility - The mosaic divisibility.
 */

/**
 * state of the account mosaics.
 * @typedef {object} AccountMosaics
 * @property {string} id - The mosaic id.
 * @property {number} amount - The mosaic amount.
 */

/**
 * Metadata associated with a transaction.
 * @typedef {object} Meta
 * @property {string} height - The block height.
 * @property {string} hash - The transaction hash.
 * @property {string} merkleComponentHash - The merkle component hash.
 * @property {number} index - The index of the transaction.
 * @property {string} timestamp - The transaction timestamp.
 * @property {number} feeMultiplier - The fee multiplier.
 */

/**
 * Cosignature of a transaction.
 * @typedef {object} Cosignature
 * @property {string} version - The version of cosignature.
 * @property {string} signerPublicKey - The signer public key.
 * @property {string} signature - The signature of cosignature.
 */

/**
 * Details of the transaction.
 * @typedef {object} TransactionDetails
 * @property {number} size - The size of the transaction.
 * @property {string} signature - The transaction signature.
 * @property {string} signerPublicKey - The public key of the signer.
 * @property {number} version - The transaction version.
 * @property {number} network - The network type.
 * @property {number} type - The transaction type.
 * @property {string} maxFee - The maximum fee.
 * @property {string} deadline - The deadline for the transaction.
 * @property {string} transactionsHash - The hash of the transactions.
 * @property {Cosignature[]} cosignatures - The cosignatures of the transaction.
 */

/**
 * The transaction object.
 * @typedef {object} Transaction
 * @property {Meta} meta - The metadata of the transaction.
 * @property {TransactionDetails} transaction - The details of the transaction.
 * @property {string} id - The transaction id.
 */

/**
 * The transaction fee multiplier object.
 * @typedef {object} FeeMultiplier
 * @property {number} slow - The slow fee multiplier.
 * @property {number} average - The average fee multiplier.
 * @property {number} fast - The fast fee multiplier.
 */

// endregion

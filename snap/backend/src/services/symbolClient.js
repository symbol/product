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
			 * @returns {Promise<Record<string, Array<string>>} The mosaics namespace.
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
			fetchTransactionPageByAddress: async (address, offsetId = '', group = 'confirmed') => {
				if (!address)
					throw new Error('Address is required');

				try {
					const url = `${nodeUrl}/transactions/${group}?order=desc&address=${address}&offset=${offsetId}`;

					const transactions = await fetchUtils.fetchData(url);
					return transactions.data;
				} catch (error) {
					throw new Error(`Failed to fetch transactions page by address: ${error.message}`);
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

// endregion

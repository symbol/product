import { TransactionAnnounceGroup, TransactionBundleType, TransactionGroup } from '../constants';
import {
	getUnresolvedIdsFromTransactionDTOs,
	transactionFromDTO
} from '../utils';
import { ApiError, NotFoundError } from 'wallet-common-core';

/** @typedef {import('../types/Transaction').Transaction} Transaction */
/** @typedef {import('../types/Network').NetworkProperties} NetworkProperties */
/** @typedef {import('../types/Account').PublicAccount} PublicAccount */
/** @typedef {import('../types/SearchCriteria').TransactionSearchCriteria} TransactionSearchCriteria */

export class TransactionService {
	#api;
	#makeRequest;

	constructor(options) {
		this.#api = options.api;
		this.#makeRequest = options.makeRequest;
	}

	/**
	 * Fetches transactions for an account.
	 * @param {NetworkProperties} networkProperties - Network properties.
	 * @param {PublicAccount} currentAccount - The account whose transactions are fetched.
	 * @param {TransactionSearchCriteria} [searchCriteria] - Group, pagination and direction filter.
	 * @returns {Promise<Transaction[]>} The account transactions.
	 */
	fetchAccountTransactions = async (networkProperties, currentAccount, searchCriteria = {}) => {
		const { group = TransactionGroup.CONFIRMED, filter, pageNumber = 1, pageSize = 15 } = searchCriteria;
		const { address } = currentAccount;

		if (group === TransactionGroup.PARTIAL)
			return [];

		let transactionDTOs = [];

		if (group === TransactionGroup.UNCONFIRMED) {
			const url = `${networkProperties.nodeUrl}/account/unconfirmedTransactions?address=${address}`;
			const response = await this.#makeRequest(url);
			transactionDTOs = response.data || [];
		} else {
			const endpoint = filter?.direction === 'outgoing'
				? '/account/transfers/outgoing'
				: filter?.direction === 'incoming'
					? '/account/transfers/incoming'
					: '/account/transfers/all';
			const params = new URLSearchParams({ address, pageNumber, pageSize });
			const url = `${networkProperties.nodeUrl}${endpoint}?${params.toString()}`;
			const response = await this.#makeRequest(url);
			transactionDTOs = response.data || [];
		}

		return this.resolveTransactionDTOs(networkProperties, transactionDTOs, currentAccount);
	};

	/**
	 * Fetches a single transaction by hash.
	 * @param {NetworkProperties} networkProperties - Network properties.
	 * @param {PublicAccount} currentAccount - The account the transaction is resolved against.
	 * @param {string} hash - The transaction hash.
	 * @returns {Promise<Transaction>} The transaction.
	 */
	fetchAccountTransaction = async (networkProperties, currentAccount, hash) => {
		const url = `${networkProperties.nodeUrl}/transaction/get?hash=${hash}`;
		const transactionDTO = await this.#makeRequest(url);
		const transactions = await this.resolveTransactionDTOs(
			networkProperties,
			[transactionDTO],
			currentAccount
		);
		
		return transactions[0];
	};

	/**
	 * Fetches the confirmation status of a transaction.
	 * @param {NetworkProperties} networkProperties - Network properties.
	 * @param {string} hash - The transaction hash.
	 * @returns {Promise<{ group: string }>} The transaction group (confirmed or unconfirmed).
	 */
	fetchTransactionStatus = async (networkProperties, hash) => {
		try {
			await this.#makeRequest(`${networkProperties.nodeUrl}/transaction/get?hash=${hash}`);
			
			return { group: TransactionGroup.CONFIRMED };
		} catch (error) {
			if (error instanceof NotFoundError)
				return { group: TransactionGroup.UNCONFIRMED };
			
			throw error;
		}
	};

	/**
	 * Announces a signed transaction to the network.
	 * @param {NetworkProperties} networkProperties - Network properties.
	 * @param {object} signedTransaction - The signed transaction with its announce dto.
	 * @param {string} [group] - The announce group (default or cosignature).
	 * @returns {Promise<object>} The node announce response.
	 */
	announceTransaction = async (networkProperties, signedTransaction, group = TransactionAnnounceGroup.DEFAULT) =>
		this.announceTransactionToNode(networkProperties.nodeUrl, signedTransaction, group);

	/**
	 * Announces all transactions in a TransactionBundle.
	 * @param {NetworkProperties} networkProperties - Network properties.
	 * @param {import('wallet-common-core').TransactionBundle} transactionBundle - The signed transaction bundle.
	 * @returns {Promise<object[]>} The node announce responses, one per transaction.
	 */
	announceTransactionBundle = async (networkProperties, transactionBundle) => {
		const { transactions, metadata } = transactionBundle;

		if (metadata?.type === TransactionBundleType.MULTISIG_TRANSFER) {
			// Announce sequentially: outer multisig first, then cosignatures
			const results = [];
			for (let i = 0; i < transactions.length; i++) {
				const tx = transactions[i];
				const group = metadata?.groups?.[i] || TransactionAnnounceGroup.DEFAULT;
				results.push(await this.announceTransaction(networkProperties, tx, group));
			}
			return results;
		}

		const announceAll = transactions.map(tx => this.announceTransaction(networkProperties, tx));
		return Promise.all(announceAll);
	};

	/**
	 * Announces a signed transaction to a specific node.
	 * @param {string} nodeUrl - The node URL.
	 * @param {object} signedTransaction - The signed transaction with its announce dto.
	 * @param {string} [group] - The announce group (default or cosignature).
	 * @returns {Promise<object>} The node announce response.
	 */
	announceTransactionToNode = async (nodeUrl, signedTransaction, group = TransactionAnnounceGroup.DEFAULT) => {
		// NEM announces every transaction through a single endpoint; a cosignature is itself a
		// transaction (cosignature_v1) and is announced the same way — there is no dedicated route.
		const endpointMap = {
			[TransactionAnnounceGroup.DEFAULT]: '/transaction/announce',
			[TransactionAnnounceGroup.COSIGNATURE]: '/transaction/announce'
		};
		const endpoint = endpointMap[group] ?? endpointMap[TransactionAnnounceGroup.DEFAULT];
		try {
			return await this.#makeRequest(`${nodeUrl}${endpoint}`, {
				method: 'POST',
				body: JSON.stringify(signedTransaction.dto),
				headers: {
					'Content-Type': 'application/json'
				}
			});
		} catch (error) {
			throw new ApiError(`Failed to announce transaction: ${error.message}`);
		}
	};

	/**
	 * Resolves the mosaic infos referenced by a list of transaction DTOs.
	 * @param {NetworkProperties} networkProperties - Network properties.
	 * @param {object[]} transactionDTOs - The transaction DTOs to resolve.
	 * @returns {Promise<Record<string, object>>} The mosaic id to info map (empty when nothing to resolve).
	 */
	resolveTransactionData = async (networkProperties, transactionDTOs) => {
		const { mosaicIds } = getUnresolvedIdsFromTransactionDTOs(transactionDTOs);
		
		if (!mosaicIds.length)
			return {};
		
		return this.#api.mosaic.fetchMosaicInfos(networkProperties, mosaicIds);
	};

	/**
	 * Maps a list of transaction DTOs to Transaction objects, resolving their referenced mosaics first.
	 * @param {NetworkProperties} networkProperties - Network properties.
	 * @param {object[]} transactionDTOs - The transaction DTOs to map.
	 * @param {PublicAccount} currentAccount - The account used to derive the directed amount.
	 * @returns {Promise<Transaction[]>} The mapped transactions.
	 */
	resolveTransactionDTOs = async (networkProperties, transactionDTOs, currentAccount) => {
		const mosaicInfos = await this.resolveTransactionData(networkProperties, transactionDTOs);
		
		return transactionDTOs.map(dto =>
			transactionFromDTO(dto, { networkProperties, currentAccount, mosaicInfos }));
	};
}

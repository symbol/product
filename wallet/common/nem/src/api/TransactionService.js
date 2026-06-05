import { TransactionAnnounceGroup, TransactionBundleType, TransactionGroup } from '../constants';
import {
	getUnresolvedIdsFromTransactionDTOs,
	transactionFromDTO
} from '../utils';
import { ApiError, NotFoundError } from 'wallet-common-core';

/** @typedef {import('../types/Transaction').Transaction} Transaction */
/** @typedef {import('../types/Network').NetworkProperties} NetworkProperties */
/** @typedef {import('../types/Account').PublicAccount} PublicAccount */

export class TransactionService {
	#api;
	#makeRequest;

	constructor(options) {
		this.#api = options.api;
		this.#makeRequest = options.makeRequest;
	}

	/**
	 * Fetches transactions for an account.
	 * @param {NetworkProperties} networkProperties
	 * @param {PublicAccount} currentAccount
	 * @param {object} [searchCriteria]
	 * @returns {Promise<Transaction[]>}
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
	 * @param {NetworkProperties} networkProperties
	 * @param {PublicAccount} currentAccount
	 * @param {string} hash
	 * @returns {Promise<Transaction>}
	 */
	fetchAccountTransaction = async (networkProperties, currentAccount, hash) => {
		// NOTE: /transaction/get?hash= is not part of the official NEM NIS API documentation (NIS lookup is
		// account-scoped: /account/transfers/all?address=&hash= + /account/unconfirmedTransactions). This
		// relies on a NIS deployment that exposes /transaction/get; revisit if targeting stock NIS.
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
	 * @param {NetworkProperties} networkProperties
	 * @param {string} hash
	 * @returns {Promise<{ group: string }>}
	 */
	fetchTransactionStatus = async (networkProperties, hash) => {
		try {
			// NOTE: /transaction/get is not in the official NEM docs and this method has no account address
			// to use the documented account-scoped lookups — relies on a NIS deployment exposing it.
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
	 * @param {NetworkProperties} networkProperties
	 * @param {object} signedTransaction
	 * @param {string} [group]
	 * @returns {Promise<object>}
	 */
	announceTransaction = async (networkProperties, signedTransaction, group = TransactionAnnounceGroup.DEFAULT) =>
		this.announceTransactionToNode(networkProperties.nodeUrl, signedTransaction, group);

	/**
	 * Announces all transactions in a TransactionBundle.
	 * @param {NetworkProperties} networkProperties
	 * @param {import('wallet-common-core').TransactionBundle} transactionBundle
	 * @returns {Promise<object[]>}
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

	resolveTransactionData = async (networkProperties, transactionDTOs) => {
		const { mosaicIds } = getUnresolvedIdsFromTransactionDTOs(transactionDTOs);
		
		if (!mosaicIds.length)
			return {};
		
		return this.#api.mosaic.fetchMosaicInfos(networkProperties, mosaicIds);
	};

	resolveTransactionDTOs = async (networkProperties, transactionDTOs, currentAccount) => {
		const mosaicInfos = await this.resolveTransactionData(networkProperties, transactionDTOs);
		
		return transactionDTOs.map(dto =>
			transactionFromDTO(dto, { networkProperties, currentAccount, mosaicInfos }));
	};
}

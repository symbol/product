import {
	AnnounceResultCode,
	TransactionAnnounceGroup,
	TransactionBundleType,
	TransactionGroup,
	TransactionType
} from '../constants';
import {
	addressFromPublicKey,
	calculateTransactionDTOHash,
	getUnresolvedIdsFromTransactionDTOs,
	normalizeTransactionHash,
	transactionFromDTO
} from '../utils';
import { ApiError, NotFoundError } from 'wallet-common-core';

/** @typedef {import('../types/Transaction').Transaction} Transaction */
/** @typedef {import('../types/Network').NetworkProperties} NetworkProperties */
/** @typedef {import('../types/Account').PublicAccount} PublicAccount */
/** @typedef {import('../types/SearchCriteria').TransactionSearchCriteria} TransactionSearchCriteria */
/**
 * @template T
 * @typedef {import('../types/SearchCriteria').Page<T>} Page
 */


export class TransactionService {
	#api;
	#makeRequest;

	constructor(options) {
		this.#api = options.api;
		this.#makeRequest = options.makeRequest;
	}

	/**
	 * Fetches an account transaction DTO by hash from the unconfirmed transactions and the latest confirmed page.
	 * @param {NetworkProperties} networkProperties - Network properties.
	 * @param {string} address - The address of the account whose transactions are searched.
	 * @param {string} hash - The transaction hash.
	 * @returns {Promise<object>} The transaction DTO.
	 * @throws {NotFoundError} If neither of them holds the transaction.
	 */
	#fetchAccountTransactionDTO = async (networkProperties, address, hash) => {
		// The /transaction/get endpoint is unreliable.
		// It fails on unconfirmed transactions, and only works for confirmed ones 
		// when the node happens to have the hash cached.
		// Search account lists instead.
		const { nodeUrl, networkIdentifier } = networkProperties;
		const pageSize = 100;
		
		const getTransactionDTOHashes = (transactionDTO, networkIdentifier) => [
			transactionDTO.meta?.hash?.data ?? calculateTransactionDTOHash(transactionDTO, networkIdentifier),
			transactionDTO.meta?.innerHash?.data,
			transactionDTO.meta?.data
		].filter(Boolean).map(normalizeTransactionHash);
		const isRequestedTransactionDTO = transactionDTO =>
			getTransactionDTOHashes(transactionDTO, networkIdentifier).includes(normalizeTransactionHash(hash));

		const unconfirmedResponse = await this.#makeRequest(`${nodeUrl}/account/unconfirmedTransactions?address=${address}`);
		const unconfirmedTransactionDTO = (unconfirmedResponse.data || []).find(isRequestedTransactionDTO);

		if (unconfirmedTransactionDTO)
			return unconfirmedTransactionDTO;

		const confirmedResponse = await this.#makeRequest(`${nodeUrl}/account/transfers/all?address=${address}&pageSize=${pageSize}`);
		const confirmedTransactionDTO = (confirmedResponse.data || []).find(isRequestedTransactionDTO);

		if (!confirmedTransactionDTO)
			throw new NotFoundError(`Transaction ${hash} not found`);

		return confirmedTransactionDTO;
	};

	/**
	 * Fetches the group of a transaction DTO. A multisig transaction is partial until it has the minimum approval.
	 * @param {NetworkProperties} networkProperties - Network properties.
	 * @param {object} transactionDTO - The transaction DTO.
	 * @returns {Promise<string>} The transaction group.
	 */
	#fetchTransactionGroup = async (networkProperties, transactionDTO) => {
		const { meta, transaction } = transactionDTO;

		if (meta?.height)
			return TransactionGroup.CONFIRMED;

		if (transaction.type !== TransactionType.MULTISIG)
			return TransactionGroup.UNCONFIRMED;

		const multisigAddress = addressFromPublicKey(transaction.otherTrans.signer, networkProperties.networkIdentifier);
		const { minApproval } = await this.#api.account.fetchMultisigInfo(networkProperties, multisigAddress);
		const signatureCount = 1 + transaction.signatures.length;

		return signatureCount < minApproval ? TransactionGroup.PARTIAL : TransactionGroup.UNCONFIRMED;
	};

	/**
	 * Fetches transactions for an account.
	 * @param {NetworkProperties} networkProperties - Network properties.
	 * @param {PublicAccount} currentAccount - The account whose transactions are fetched.
	 * @param {TransactionSearchCriteria} [searchCriteria] - Group, pagination and direction filter.
	 * @returns {Promise<Page<Transaction>>} The page of account transactions.
	 */
	fetchAccountTransactions = async (networkProperties, currentAccount, searchCriteria = {}) => {
		const { group = TransactionGroup.CONFIRMED, filter, cursor = null, pageSize = 15 } = searchCriteria;
		const { address } = currentAccount;

		let transactionDTOs;
		let nextCursor = null;

		if (group === TransactionGroup.UNCONFIRMED || group === TransactionGroup.PARTIAL) {
			const url = `${networkProperties.nodeUrl}/account/unconfirmedTransactions?address=${address}`;
			const response = await this.#makeRequest(url);
			const unconfirmedTransactionDTOs = response.data || [];
			const groups = await Promise.all(unconfirmedTransactionDTOs.map(transactionDTO =>
				this.#fetchTransactionGroup(networkProperties, transactionDTO)));
			transactionDTOs = unconfirmedTransactionDTOs.filter((transactionDTO, index) => groups[index] === group);
		} else {
			const endpoint = filter?.direction === 'outgoing'
				? '/account/transfers/outgoing'
				: filter?.direction === 'incoming'
					? '/account/transfers/incoming'
					: '/account/transfers/all';
			const params = new URLSearchParams({ address, pageSize });

			if (cursor !== null)
				params.set('id', cursor);

			const url = `${networkProperties.nodeUrl}${endpoint}?${params.toString()}`;
			const response = await this.#makeRequest(url);
			transactionDTOs = response.data || [];
			const isNextPageAvailable = transactionDTOs.length >= pageSize;
			nextCursor = isNextPageAvailable ? String(transactionDTOs.at(-1).meta.id) : null;
		}

		const data = await this.resolveTransactionDTOs(networkProperties, transactionDTOs, currentAccount);

		return { data, nextCursor };
	};

	/**
	 * Fetches a single transaction by hash.
	 * @param {NetworkProperties} networkProperties - Network properties.
	 * @param {PublicAccount} currentAccount - The account the transaction is resolved against.
	 * @param {string} hash - The transaction hash.
	 * @returns {Promise<Transaction>} The transaction.
	 */
	fetchAccountTransaction = async (networkProperties, currentAccount, hash) => {
		const transactionDTO = await this.#fetchAccountTransactionDTO(networkProperties, currentAccount.address, hash);
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
	 * @param {PublicAccount} currentAccount - The account whose transactions are searched.
	 * @returns {Promise<{ group: string }>} The transaction group (confirmed, unconfirmed or partial).
	 */
	fetchTransactionStatus = async (networkProperties, hash, currentAccount) => {
		const transactionDTO = await this.#fetchAccountTransactionDTO(networkProperties, currentAccount.address, hash);

		return { group: await this.#fetchTransactionGroup(networkProperties, transactionDTO) };
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
				// eslint-disable-next-line no-await-in-loop
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
			const result = await this.#makeRequest(`${nodeUrl}${endpoint}`, {
				method: 'POST',
				body: JSON.stringify(signedTransaction.dto),
				headers: {
					'Content-Type': 'application/json'
				}
			});

			if (!Object.values(AnnounceResultCode).includes(result.code))
				throw new Error(result.message);

			return result;
		} catch (error) {
			throw new ApiError(`Failed to announce transaction: ${error.message}`);
		}
	};

	/**
	 * Resolves the token infos referenced by a list of transaction DTOs.
	 * @param {NetworkProperties} networkProperties - Network properties.
	 * @param {object[]} transactionDTOs - The transaction DTOs to resolve.
	 * @returns {Promise<Record<string, object>>} The token id to info map (empty when nothing to resolve).
	 */
	resolveTransactionData = async (networkProperties, transactionDTOs) => {
		const { tokenIds } = getUnresolvedIdsFromTransactionDTOs(transactionDTOs);

		if (!tokenIds.length)
			return {};

		return this.#api.token.fetchTokenInfos(networkProperties, tokenIds);
	};

	/**
	 * Maps a list of transaction DTOs to Transaction objects, resolving their referenced tokens first.
	 * @param {NetworkProperties} networkProperties - Network properties.
	 * @param {object[]} transactionDTOs - The transaction DTOs to map.
	 * @param {PublicAccount} currentAccount - The account used to derive the directed amount.
	 * @returns {Promise<Transaction[]>} The mapped transactions.
	 */
	resolveTransactionDTOs = async (networkProperties, transactionDTOs, currentAccount) => {
		const tokenInfos = await this.resolveTransactionData(networkProperties, transactionDTOs);

		return transactionDTOs.map(dto =>
			transactionFromDTO(dto, { networkProperties, currentAccount, tokenInfos }));
	};
}

import { createEthereumJrpcProvider, getUnresolvedIdsFromTransactionDTOs, transactionFromDTO, transactionToEthereum } from '../utils';
import { ApiError } from 'wallet-common-core';
import { TransactionGroup } from 'wallet-common-core/src/constants';

/** @typedef {import('../types/Account').PublicAccount} PublicAccount */
/** @typedef {import('../types/Mosaic').MosaicInfo} MosaicInfo */
/** @typedef {import('../types/Network').NetworkProperties} NetworkProperties */
/** @typedef {import('../types/Transaction').Transaction} Transaction */
/** @typedef {import('../types/Transaction').SignedTransactionDTO} SignedTransactionDTO */

export class TransactionService {
	/** @type {import('../api').Api} */
	#api;

	#makeRequest;

	constructor(options) {
		this.#api = options.api;
		this.#makeRequest = options.makeRequest;
	}

	/**
	 * Fetches transactions of an account.
	 * @param {NetworkProperties} networkProperties - Network properties.
	 * @param {PublicAccount} account - Requested account.
	 * @param {Object} [searchCriteria] - Search criteria.
	 * @property {number} [searchCriteria.pageSize=15] - Number of transactions to return.
	 * @returns {Promise<Transaction[]>} - The account transactions.
	 */
	fetchAccountTransactions = async (networkProperties, account, searchCriteria = {}) => {
		const { pageSize = 15 } = searchCriteria;
		const provider = createEthereumJrpcProvider(networkProperties);
		const { txs: transactionDTOs } = await provider.send('ots_searchTransactionsBefore', [
			account.address,
			0,
			pageSize
		]);

		return this.resolveTransactionDTOs(networkProperties, transactionDTOs, account);
	};
	/**
	 * Send transaction to the network.
	 * @param {NetworkProperties} networkProperties - Network properties.
	 * @param {SignedTransaction} signedTransaction - The signed transaction.
	 * @returns {Promise<void>} - A promise that resolves when the transaction is announced.
	 * @throws {ApiError} - If the transaction is not accepted by any node.
	 */
	announceTransaction = async (networkProperties, signedTransaction) => {
		const provider = createEthereumJrpcProvider(networkProperties);

		try {
			const response = await provider.broadcastTransaction(signedTransaction.dto);

			return response.hash;
		} catch (error) {
			throw new ApiError(`Transaction announce failed: ${error.message}`);
		}
	};

	announceTransactionBundle = async (networkProperties, signedTransactionBundle) => {
		return Promise.all(signedTransactionBundle.transactions.map(signedTransaction =>
			this.announceTransaction(networkProperties, signedTransaction)));
	};

	/**
	 * Estimates the gas limit for a transaction.
	 * @param {NetworkProperties} networkProperties - Network properties.
	 * @param {Transaction} transaction - The transaction to estimate gas for.
	 * @returns {Promise<string>} - The estimated gas limit amount.
	 */
	estimateTransactionGasLimit = async (networkProperties, transaction) => {
		const provider = createEthereumJrpcProvider(networkProperties);
		const ethereumTransaction = transactionToEthereum(transaction, {
			networkIdentifier: networkProperties.networkIdentifier
		});

		try {
			const gasLimit = await provider.estimateGas(ethereumTransaction);

			return gasLimit.toString();
		} catch (error) {
			throw new ApiError(`Gas limit estimation failed: ${error.message}`);
		}
	};

	/**
	 * Fetches the transaction nonce for an account.
	 * @param {NetworkProperties} networkProperties - Network properties.
	 * @param {string} address - The account address.
	 * @returns {Promise<number>} - The transaction nonce.
	 */
	fetchTransactionNonce = async (networkProperties, address) => {
		const provider = createEthereumJrpcProvider(networkProperties);

		try {
			const nonce = await provider.getTransactionCount(address, 'pending');

			return nonce;
		} catch (error) {
			throw new ApiError(`Nonce fetching failed: ${error.message}`);
		}
	};

	/**
     * Resolves transactions DTO. Fetches additional information for unresolved ids. Maps transactionDTOs to the transaction objects.
	 * @param {NetworkProperties} networkProperties - Network properties.
     * @param {object[]} transactionDTOs - The transaction DTOs.
     * @param {PublicAccount} currentAccount - Current account.
     * @returns {Promise<Transaction[]>} - The resolved transactions
     */
	resolveTransactionDTOs = async (networkProperties, transactionDTOs, currentAccount) => {
		const unresolvedTransactionData = getUnresolvedIdsFromTransactionDTOs(transactionDTOs);

		const { blockHeights, tokenContractAddresses } = unresolvedTransactionData;
		const blockInfosPromise = this.#api.block.fetchBlockInfos(networkProperties, blockHeights);
		const tokenInfosPromise = this.#api.token.fetchTokenInfos(networkProperties, tokenContractAddresses);
		const [blocks, tokenInfos] = await Promise.all([
			blockInfosPromise,
			tokenInfosPromise
		]);
		
		const config = {
			blocks,
			tokenInfos,
			currentAccount,
			networkProperties
		};

		return transactionDTOs.map(transactionDTO => transactionFromDTO(transactionDTO, config));
	};
}

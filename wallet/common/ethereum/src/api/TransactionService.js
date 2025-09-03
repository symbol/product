import { transactionToEthereum } from '../utils';
import { ethers } from 'ethers';
import { ApiError } from 'wallet-common-core';

/** @typedef {import('../types/Account').PublicAccount} PublicAccount */
/** @typedef {import('../types/Mosaic').MosaicInfo} MosaicInfo */
/** @typedef {import('../types/Network').NetworkProperties} NetworkProperties */
/** @typedef {import('../types/SearchCriteria').TransactionSearchCriteria} TransactionSearchCriteria */
/** @typedef {import('../types/Transaction').Transaction} Transaction */
/** @typedef {import('../types/Transaction').SignedTransactionDTO} SignedTransactionDTO */

export class TransactionService {
	constructor() { }

	fetchAccountTransactions = () => {
		throw new ApiError('fetchAccountTransactions is not implemented for Ethereum');
	};

	/**
	 * Send transaction to the network.
	 * @param {NetworkProperties} networkProperties - Network properties.
	 * @param {SignedTransactionDTO} dto - The signed transaction DTO.
	 * @returns {Promise<void>} - A promise that resolves when the transaction is announced.
	 * @throws {ApiError} - If the transaction is not accepted by any node.
	 */
	announceTransaction = async (networkProperties, dto) => {
		const { nodeUrl } = networkProperties;
		const provider = new ethers.JsonRpcProvider(nodeUrl);

		try {
			const response = await provider.broadcastTransaction(dto);

			return response.hash;
		} catch (error) {
			throw new ApiError(`Transaction announce failed: ${error.message}`);
		}
	};

	/**
	 * Estimates the gas limit for a transaction.
	 * @param {NetworkProperties} networkProperties - Network properties.
	 * @param {Transaction} transaction - The transaction to estimate gas for.
	 * @returns {Promise<string>} - The estimated gas limit amount.
	 */
	estimateTransactionGasLimit = async (networkProperties, transaction) => {
		const { nodeUrl } = networkProperties;
		const provider = new ethers.JsonRpcProvider(nodeUrl);
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
		const { nodeUrl } = networkProperties;
		const provider = new ethers.JsonRpcProvider(nodeUrl);

		try {
			const nonce = await provider.getTransactionCount(address, 'pending');
			
			return nonce;
		} catch (error) {
			throw new ApiError(`Nonce fetching failed: ${error.message}`);
		}
	};
}

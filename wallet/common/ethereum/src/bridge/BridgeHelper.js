/** @typedef {import('../api/TokenService').TokenService} TokenService */
/** @typedef {import('../types/Account').PublicAccount} PublicAccount */
/** @typedef {import('../types/Token').Token} Token */
/** @typedef {import('../types/Token').TokenInfo} TokenInfo */
/** @typedef {import('../types/Network').NetworkProperties} NetworkProperties */
/** @typedef {import('../types/Transaction').Transaction} Transaction */
/** @typedef {import('../types/Transaction').TransactionFee} TransactionFee */

import { TransactionType } from '../constants';
import { base32ToHex } from 'wallet-common-core';

export class BridgeHelper {
	/** @type {import('../api/TokenService').TokenService} */
	#tokenApi;

	/** @type {import('../api/TransactionService').TransactionService} */
	#transactionApi;

	/**
     * Initializes the BridgeHelper with necessary configurations.
     * @param {object} options - The initialization options.
     * @param {TokenService} options.tokenApi - The token API service.
     */
	constructor(options) {
		this.#tokenApi = options.tokenApi;
		this.#transactionApi = options.transactionApi;
	}

	/**
     * Creates a request transaction to bridge to swap tokens.
     * @param {object} options - The transaction options.
     * @param {NetworkProperties} networkProperties - The network properties.
     * @param {PublicAccount} currentAccount - The current user's public account
     * @param {string} recipientAddress - The address on the target chain to receive the currency
     * @param {string} bridgeAddress - The bridge contract address
     * @param {Token} token - The token (currency) to swap
     * @param {TransactionFee} [options.fee] - The transaction fee.
     * @returns {Transaction} The transaction object
     */
	createTransaction = async options => {
		const { currentAccount, networkProperties, recipientAddress, token, fee, bridgeAddress } = options;
		const nonce = await this.#transactionApi.fetchTransactionNonce(networkProperties, currentAccount.address);

		const transferTransaction = {
			type: TransactionType.ERC_20_BRIDGE_TRANSFER,
			signerPublicKey: currentAccount.publicKey,
			signerAddress: currentAccount.address,
			recipientAddress: bridgeAddress,
			tokens: [token],
			message: {
				text: recipientAddress,
				payload: base32ToHex(recipientAddress),
				type: 1
			},
			fee,
			nonce
		};

		return transferTransaction;
	};

	/**
     * Fetches token information for a specific token ID.
     * @param {NetworkProperties} networkProperties - The network properties.
     * @param {string} tokenId - The ID of the token to fetch information for.
     * @returns {Promise<TokenInfo>} The token information.
     */
	fetchTokenInfo = async (networkProperties, tokenId) => {
		if (!tokenId || tokenId === networkProperties.networkCurrency.id) 
			return networkProperties.networkCurrency;

		return this.#tokenApi.fetchTokenInfo(networkProperties, tokenId);
	};
}

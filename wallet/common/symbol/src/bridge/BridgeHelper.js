/** @typedef {import('../api/TokenService').TokenService} TokenService */
/** @typedef {import('../types/Account').PublicAccount} PublicAccount */
/** @typedef {import('wallet-common-core/src/types/Token').Token} BaseToken */
/** @typedef {import('../types/Token').TokenInfo} TokenInfo */
/** @typedef {import('../types/Network').NetworkProperties} NetworkProperties */
/** @typedef {import('../types/Transaction').Transaction} Transaction */
/** @typedef {import('wallet-common-core/src/types/Transaction').TransactionFee} TransactionFee */

import { MessageType, TransactionType } from '../constants';
import { createDeadline, encodePlainMessage } from '../utils';

export class BridgeHelper {
	/** @type {TokenService} */
	#tokenApi;

	/**
     * Initializes the BridgeHelper with necessary configurations.
     * @param {object} options - The initialization options.
     * @param {TokenService} options.tokenApi - The Token API service instance.
     */
	constructor(options) {
		this.#tokenApi = options.tokenApi;
	}

	/**
     * Creates an unwrap transaction to convert wrapped currency back to native currency.
     * @param {object} options - The transaction options.
     * @param {NetworkProperties} networkProperties - The network properties
     * @param {PublicAccount} currentAccount - The current user's public account
     * @param {string} recipientAddress - The address on the target chain to receive the resulting token
     * @param {string} bridgeAddress - The bridge address to send the source token to
     * @param {BaseToken} token - The token (currency) to swap
     * @param {TransactionFee} [options.fee] - The transaction fee.
     * @returns {Transaction} The transaction object
     */
	createTransaction = options => {
		const { networkProperties, currentAccount, recipientAddress, bridgeAddress, token, fee } = options;

		const transferTransaction = {
			type: TransactionType.TRANSFER,
			signerPublicKey: currentAccount.publicKey,
			signerAddress: currentAccount.address,
			recipientAddress: bridgeAddress,
			tokens: [token],
			message: {
				text: recipientAddress,
				payload: encodePlainMessage(recipientAddress).substring(2),
				type: MessageType.PlainText
			},
			deadline: createDeadline(2, networkProperties.epochAdjustment),
			fee
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
		const tokenInfo = await this.#tokenApi.fetchTokenInfo(networkProperties, tokenId);

		return {
			id: tokenInfo.id,
			name: tokenInfo.name,
			divisibility: tokenInfo.divisibility
		};
	};
}

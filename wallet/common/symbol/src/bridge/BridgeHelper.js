/** @typedef {import('../api/MosaicService').MosaicService} MosaicService */
/** @typedef {import('../types/Account').PublicAccount} PublicAccount */
/** @typedef {import('../types/Mosaic').BaseMosaic} BaseMosaic */
/** @typedef {import('../types/Mosaic').MosaicInfo} MosaicInfo */
/** @typedef {import('../types/Network').NetworkProperties} NetworkProperties */
/** @typedef {import('../types/Transaction').Transaction} Transaction */
/** @typedef {import('wallet-common-core/src/types/Transaction').TransactionFee} TransactionFee */

import { MessageType, TransactionType } from '../constants';
import { createDeadline, encodePlainMessage } from '../utils';

export class BridgeHelper {
	/** @type {MosaicService} */
	#mosaicApi;

	/**
     * Initializes the BridgeHelper with necessary configurations.
     * @param {object} options - The initialization options.
     * @param {MosaicService} options.mosaicApi - The Mosaic API service instance.
     */
	constructor(options) {
		this.#mosaicApi = options.mosaicApi;
	}

	/**
     * Creates an unwrap transaction to convert wrapped currency back to native currency.
     * @param {object} options - The transaction options.
     * @param {NetworkProperties} networkProperties - The network properties
     * @param {PublicAccount} currentAccount - The current user's public account
     * @param {string} recipientAddress - The address on the target chain to receive the resulting token
     * @param {string} bridgeAddress - The bridge address to send the source token to
     * @param {BaseMosaic} token - The mosaic (currency) to swap
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
			mosaics: [token],
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
     * Fetches token information for a specific mosaic ID.
     * @param {NetworkProperties} networkProperties - The network properties.
     * @param {string} mosaicId - The ID of the mosaic to fetch information for.
     * @returns {Promise<MosaicInfo>} The mosaic information.
     */
	fetchTokenInfo = async (networkProperties, mosaicId) => {
		const mosaicInfo = await this.#mosaicApi.fetchMosaicInfo(networkProperties, mosaicId);

		return {
			id: mosaicInfo.id,
			name: mosaicInfo.names?.[0] || mosaicInfo.id,
			divisibility: mosaicInfo.divisibility
		};
	};
}

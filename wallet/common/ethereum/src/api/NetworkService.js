import { NETWORK_CURRENCY_DIVISIBILITY, NETWORK_CURRENCY_ID, NETWORK_CURRENCY_NAME } from '../constants';
import { chainIdToNetworkIdentifier, createTransactionFeeMultipliers, createWebSocketUrl, makeEthereumJrpcCall } from '../utils';
import { ApiError } from 'wallet-common-core';

/** @typedef {import('../types/Network').NetworkInfo} NetworkInfo */
/** @typedef {import('../types/Network').NetworkProperties} NetworkProperties */
/** @typedef {import('../types/Network').RentalFees} RentalFees */

const DEFAULT_WEBSOCKET_PORT = 8546;

export class NetworkService {
	#config;
	#makeRequest;

	constructor(options) {
		this.#config = options.config;
		this.#makeRequest = options.makeRequest;
	}

	/**
     * Returns network nodes from the config.
     * @param {string} networkIdentifier - Network identifier.
     * @returns {Promise<string[]>} The node list.
     */
	fetchNodeList = async networkIdentifier => {
		return this.#config.nodeList[networkIdentifier];
	};

	/**
     * Fetches the network info.
     * @param {string} nodeUrl - Node URL.
     * @returns {Promise<NetworkInfo>} Network info.
     */
	fetchNetworkInfo = async nodeUrl => {
		const [chainIdHex, feeHistory, blockNumberHex] = await Promise.all([
			makeEthereumJrpcCall(this.#makeRequest, nodeUrl, 'eth_chainId', []),
			makeEthereumJrpcCall(this.#makeRequest, nodeUrl, 'eth_feeHistory', [
				'0xa',
				'latest',
				[25, 50, 75]
			]),
			makeEthereumJrpcCall(this.#makeRequest, nodeUrl, 'eth_blockNumber', [])
		]);
		
		// Validate fee history. Expect node that supports EIP-1559.
		if (!feeHistory || !Array.isArray(feeHistory.baseFeePerGas) || !Array.isArray(feeHistory.reward)) 
			throw new ApiError('Fee history data is missing in the node response.');

		const chainId = Number(BigInt(chainIdHex));

		return {
			nodeUrl,
			wsUrl: createWebSocketUrl(nodeUrl, DEFAULT_WEBSOCKET_PORT),
			chainId,
			networkIdentifier: chainIdToNetworkIdentifier(chainId),
			chainHeight: Number(BigInt(blockNumberHex)),
			transactionFees: createTransactionFeeMultipliers(NETWORK_CURRENCY_DIVISIBILITY, feeHistory),
			networkCurrency: {
				name: NETWORK_CURRENCY_NAME,
				id: NETWORK_CURRENCY_ID,
				divisibility: NETWORK_CURRENCY_DIVISIBILITY
			}
		};
	};

	/**
     * Pings the node and returns the chain height.
     * @param {string} nodeUrl - Node URL.
     * @returns {Promise<number>} Chain height.
     */
	pingNode = async nodeUrl => {
		const hexHeight = await makeEthereumJrpcCall(this.#makeRequest, nodeUrl, 'eth_blockNumber', []);
        
		return Number(BigInt(hexHeight));
	};
}

import { NETWORK_CURRENCY_DIVISIBILITY, NETWORK_CURRENCY_ID, NETWORK_CURRENCY_NAME } from '../constants';
import { chainIdToNetworkIdentifier, createTransactionFeeMultipliers } from '../utils';
import { ethers } from 'ethers';

/** @typedef {import('../types/Network').NetworkInfo} NetworkInfo */
/** @typedef {import('../types/Network').NetworkProperties} NetworkProperties */
/** @typedef {import('../types/Network').RentalFees} RentalFees */

export class NetworkService {
	#config;

	constructor(options) {
		this.#config = options.config;
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
		const provider = new ethers.JsonRpcProvider(nodeUrl);
		const { chainId } = await provider.getNetwork();
		const [feeHistory, chainHeight] = await Promise.all([
			provider.send('eth_feeHistory', [
				ethers.toQuantity(10),
				'latest',
				[25, 50, 75]
			]),
			provider.getBlockNumber()
		]);

		return {
			nodeUrl,
			wsUrl: nodeUrl.replace(/^http/, 'ws').replace(':8545', ':8546'),
			networkIdentifier: chainIdToNetworkIdentifier(Number(chainId.toString())),
			chainHeight: chainHeight,
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
		const provider = new ethers.JsonRpcProvider(nodeUrl);
		
		return provider.getBlockNumber();
	};
}

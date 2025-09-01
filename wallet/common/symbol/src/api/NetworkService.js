import { networkTypeToIdentifier } from '../utils';
import { absoluteToRelativeAmount } from 'wallet-common-core';

/** @typedef {import('../types/Network').NetworkInfo} NetworkInfo */
/** @typedef {import('../types/Network').NetworkProperties} NetworkProperties */
/** @typedef {import('../types/Network').RentalFees} RentalFees */

export class NetworkService {
	#api;
	#config;
	#makeRequest;

	constructor(options) {
		this.#api = options.api;
		this.#config = options.config;
		this.#makeRequest = options.makeRequest;
	}

	/**
	 * Gets the default node list.
	 * @param {string} networkIdentifier - Network identifier.
	 * @returns {string[]} Default node list.
	 */
	getDefaultNodeList = networkIdentifier => {
		return this.#config.defaultNodes[networkIdentifier];
	};

	/**
	 * Fetches the node list.
	 * @param {string} networkIdentifier - Network identifier.
	 * @returns {Promise<string[]>} The node list.
	 */
	fetchNodeList = async networkIdentifier => {
		const baseUrl = this.#config.nodewatchURL[networkIdentifier];
		const isSslEnabled = true;
		const limit = 30;
		const order = 'random';
		const endpoint = `${baseUrl}/api/symbol/nodes/peer?only_ssl=${isSslEnabled}&limit=${limit}&order=${order}`;
		const nodes = await this.#makeRequest(endpoint);

		return nodes.map(node => node.endpoint);
	};

	/**
	 * Fetches the network info.
	 * @param {string} nodeUrl - Node URL.
	 * @returns {Promise<NetworkInfo>} Network info.
	 */
	fetchNetworkInfo = async nodeUrl => {
		const [nodeInfo, networkProps, transactionFees, chainInfo] = await Promise.all([
			this.#makeRequest(`${nodeUrl}/node/info`),
			this.#makeRequest(`${nodeUrl}/network/properties`),
			this.#makeRequest(`${nodeUrl}/network/fees/transaction`),
			this.#makeRequest(`${nodeUrl}/chain/info`)
		]);

		const networkCurrencyMosaicId = networkProps.chain.currencyMosaicId.split('\'').join('').replace(/^(0x)/, '');
		const mosaicInfo = await this.#api.mosaic.fetchMosaicInfo({ nodeUrl }, networkCurrencyMosaicId);
		const wsUrl = nodeUrl.replace('http', 'ws') + '/ws';

		return {
			nodeUrl,
			wsUrl,
			networkIdentifier: networkTypeToIdentifier(nodeInfo.networkIdentifier),
			generationHash: nodeInfo.networkGenerationHashSeed,
			chainHeight: parseInt(chainInfo.height),
			blockGenerationTargetTime: networkProps.chain.blockGenerationTargetTime.replace(/s/g, ''),
			epochAdjustment: parseInt(networkProps.network.epochAdjustment),
			transactionFees,
			networkCurrency: {
				name: mosaicInfo.names[0],
				mosaicId: networkCurrencyMosaicId,
				divisibility: mosaicInfo.divisibility
			}
		};
	};

	/**
	 * Pings the node and returns the chain height.
	 * @param {string} nodeUrl - Node URL.
	 * @returns {Promise<number>} Chain height.
	 */
	pingNode = async nodeUrl => {
		const endpoint = `${nodeUrl}/chain/info`;
		const chainInfo = await this.#makeRequest(endpoint);

		return parseInt(chainInfo.height);
	};

	/**
	 * Fetches the rental fees.
	 * @param {NetworkProperties} networkProperties - Network properties.
	 * @returns {Promise<RentalFees>} Rental fees.
	 */
	fetchRentalFees = async networkProperties => {
		const endpoint = `${networkProperties.nodeUrl}/network/fees/rental`;
		const fees = await this.#makeRequest(endpoint);

		return {
			mosaic: absoluteToRelativeAmount(fees.effectiveMosaicRentalFee, networkProperties.networkCurrency.divisibility),
			rootNamespacePerBlock: absoluteToRelativeAmount(
				fees.effectiveRootNamespaceRentalFeePerBlock,
				networkProperties.networkCurrency.divisibility
			),
			subNamespace: absoluteToRelativeAmount(fees.effectiveChildNamespaceRentalFee, networkProperties.networkCurrency.divisibility)
		};
	};
}

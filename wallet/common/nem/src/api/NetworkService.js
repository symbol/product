import {
	BLOCK_GENERATION_TARGET_TIME,
	NEM_EPOCH,
	NEM_WS_PATH,
	NEM_WS_PORT,
	NETWORK_CURRENCY_DIVISIBILITY,
	NETWORK_CURRENCY_ID,
	NETWORK_CURRENCY_NAME
} from '../constants';
import { networkTypeToIdentifier } from '../utils';
import { calculateMosaicRentalFee, calculateNamespaceRentalFee } from 'symbol-sdk/nem';

/** @typedef {import('../types/Network').NetworkInfo} NetworkInfo */
/** @typedef {import('../types/Network').NetworkProperties} NetworkProperties */
/** @typedef {import('../types/Network').RentalFees} RentalFees */

export class NetworkService {
	#config;
	#makeRequest;

	constructor(options) {
		this.#config = options.config;
		this.#makeRequest = options.makeRequest;
	}

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
		const endpoint = `${baseUrl}/api/nem/nodes/peer?only_ssl=${isSslEnabled}&limit=${limit}&order=${order}`;
		const nodes = await this.#makeRequest(endpoint);

		return nodes.map(node => node.endpoint);
	};

	/**
	 * Fetches the network info.
	 * @param {string} nodeUrl - Node URL.
	 * @returns {Promise<NetworkInfo>} Network info.
	 */
	fetchNetworkInfo = async nodeUrl => {
		const [nodeInfo, chainInfo, networkTime] = await Promise.all([
			this.#makeRequest(`${nodeUrl}/node/info`),
			this.#makeRequest(`${nodeUrl}/chain/height`),
			this.#makeRequest(`${nodeUrl}/time-sync/network-time`)
		]);

		// NIS serializes metaData.networkId as a signed byte (testnet 0x98 -> -104); normalize to the
		// unsigned byte value so networkTypeToIdentifier matches NetworkType (0x68 -> 104, 0x98 -> 152).
		const networkTypeId = nodeInfo.metaData.networkId & 0xFF;
		const networkIdentifier = networkTypeToIdentifier(networkTypeId);
		const chainHeight = parseInt(chainInfo.height);

		return {
			nodeUrl,
			wsUrl: `${nodeUrl.replace(/^http/, 'ws').split(':').slice(0, 2).join(':')}:${NEM_WS_PORT}${NEM_WS_PATH}`,
			networkIdentifier,
			generationHash: '',
			chainHeight,
			blockGenerationTargetTime: BLOCK_GENERATION_TARGET_TIME,
			epochAdjustment: Math.floor(NEM_EPOCH / 1000),
			networkTime: networkTime.sendTimeStamp,
			rentalFees: {
				rootNamespaceFee: Number(calculateNamespaceRentalFee(true)),
				subNamespaceFee: Number(calculateNamespaceRentalFee(false)),
				mosaicDefinitionFee: Number(calculateMosaicRentalFee())
			},
			networkCurrency: {
				name: NETWORK_CURRENCY_NAME,
				mosaicId: NETWORK_CURRENCY_ID,
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
		const response = await this.#makeRequest(`${nodeUrl}/chain/height`);
		
		return parseInt(response.height);
	};
}

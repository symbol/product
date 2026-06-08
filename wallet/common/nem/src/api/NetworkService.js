import {
	AGGREGATE_MODIFICATION_FEE,
	BASE_FEE,
	BLOCK_GENERATION_TARGET_TIME,
	FEE_PER_MESSAGE_CHUNK,
	FEE_PER_MOSAIC,
	MOSAIC_DEFINITION_CREATION_FEE,
	NEM_EPOCH,
	NEM_WS_PATH,
	NEM_WS_PORT,
	NETWORK_CURRENCY_DIVISIBILITY,
	NETWORK_CURRENCY_ID,
	NETWORK_CURRENCY_NAME,
	ROOT_NAMESPACE_FEE,
	SUB_NAMESPACE_FEE,
	XEM_FEE_PER_TIER,
	XEM_TIER_AMOUNT,
	XEM_TRANSFER_FEE_MAX
} from '../constants';
import { networkTypeToIdentifier } from '../utils';

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
			// NEM fees are deterministic protocol constants; assemble the chain's on-chain fee
			// schedule here so the fee calculation logic reads it from networkProperties (utils/fee.js).
			transactionFees: {
				baseFee: BASE_FEE,
				perMosaicFee: FEE_PER_MOSAIC,
				perMessageChunkFee: FEE_PER_MESSAGE_CHUNK,
				aggregateModificationFee: AGGREGATE_MODIFICATION_FEE,
				xemTierAmount: XEM_TIER_AMOUNT,
				xemFeePerTier: XEM_FEE_PER_TIER,
				xemTransferFeeMax: XEM_TRANSFER_FEE_MAX
			},
			// Rental / creation fees are paid to a dedicated fee sink separately from the transaction
			// fee (NEM NIS API Documentation fee table), so they are exposed apart from transactionFees.
			rentalFees: {
				rootNamespaceFee: ROOT_NAMESPACE_FEE,
				subNamespaceFee: SUB_NAMESPACE_FEE,
				mosaicDefinitionFee: MOSAIC_DEFINITION_CREATION_FEE
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

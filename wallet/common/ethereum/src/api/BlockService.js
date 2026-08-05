import { createEthereumJrpcProvider } from '../utils';
import { ApiError } from 'wallet-common-core';

/** @typedef {import('../types/Block').Block} Block */
/** @typedef {import('../types/Network').NetworkProperties} NetworkProperties */


const blockFromDto = blockDto => ({
	height: blockDto.number.toString(),
	hash: blockDto.hash,
	timestamp: Number(blockDto.timestamp) * 1000
});

/**
 * Checks whether the node answered the request and refused to serve the block, for example because
 * it pruned that part of the history. Only such a block counts as missing, a failure to reach the
 * node carries no JSON-RPC error and must not be mistaken for one.
 * @param {Error} error - The error thrown by the provider.
 * @returns {boolean} True when the node returned a JSON-RPC error for the block.
 */
const isBlockUnavailable = error => !!(error.error || error.info?.error);

export class BlockService {
	constructor() {}

	/**
     * Fetches block info from the node.
     * @param {NetworkProperties} networkProperties - Network properties.
     * @param {string} blockHeight - Requested block height (decimal string).
     * @returns {Promise<Block>} - The block info.
     */
	fetchBlockInfo = async (networkProperties, blockHeight) => {
		const provider = createEthereumJrpcProvider(networkProperties);

		const blockTag = BigInt(blockHeight);
		const block = await provider.getBlock(blockTag);
        
		if (!block)
			throw new ApiError(`Block not found at height ${blockHeight}`);

		return blockFromDto(block);
	};

	/**
     * Fetches block infos for the list of block heights from the node.
     * @param {NetworkProperties} networkProperties - Network properties.
     * @param {string[]} blockHeights - Requested block heights (decimal strings).
     * @returns {Promise<Record<string, Block>>} - The block infos map keyed by height
     * (blocks the node refuses to serve are omitted, failures to reach the node propagate).
     */
	fetchBlockInfos = async (networkProperties, blockHeights) => {
		const provider = createEthereumJrpcProvider(networkProperties);

		const results = await Promise.all(blockHeights.map(async heightStr => {
			const blockTag = BigInt(heightStr);

			try {
				const block = await provider.getBlock(blockTag);
				if (!block)
					return null;

				return blockFromDto(block);
			} catch (error) {
				if (isBlockUnavailable(error))
					return null;

				throw error;
			}
		}));

		const blockMap = {};
		results.forEach(block => {
			if (block)
				blockMap[block.height] = block;
		});

		return blockMap;
	};
}

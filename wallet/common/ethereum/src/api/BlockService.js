import { createEthereumJrpcProvider } from '../utils';
import { ApiError } from 'wallet-common-core';

/** @typedef {import('../types/Block').Block} Block */
/** @typedef {import('../types/Network').NetworkProperties} NetworkProperties */

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

		return {
			height: block.number.toString(),
			hash: block.hash,
			timestamp: Number(block.timestamp) * 1000
		};
	};

	/**
     * Fetches block infos for the list of block heights from the node.
     * @param {NetworkProperties} networkProperties - Network properties.
     * @param {string[]} blockHeights - Requested block heights (decimal strings).
     * @returns {Promise<Record<string, Block>>} - The block infos map keyed by height.
     */
	fetchBlockInfos = async (networkProperties, blockHeights) => {
		const provider = createEthereumJrpcProvider(networkProperties);

		const results = await Promise.all(blockHeights.map(async heightStr => {
			const blockTag = BigInt(heightStr);
			const block = await provider.getBlock(blockTag);
			if (!block) 
				return null;

			return {
				height: block.number.toString(),
				hash: block.hash,
				timestamp: Number(block.timestamp) * 1000
			};
		}));

		const blockMap = {};
		results.forEach(block => {
			if (block)
				blockMap[block.height] = block;
		});

		return blockMap;
	};
}

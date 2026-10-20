import { stubBlocks } from './fixtures';
import { stubPage, stubValue } from './stub';
import config from '@/app/config';
import { makeRequest } from '@/app/utils/server';

/**
 * @typedef ChainStatus
 * @property {number} height - the current chain height.
 * @property {number} finalizedHeight - the latest finalized block height.
 */

export const fetchBlockPage = stubPage(stubBlocks);

/**
 * Fetches the chain height from Nodewatch.
 * @returns {Promise<number>} the chain height.
 */
export const fetchChainHight = async () => {
	const { height } = await fetchChainStatus();

	return height;
};

/**
 * Fetches the chain status from Nodewatch.
 * @returns {Promise<ChainStatus>} the chain status.
 */
export const fetchChainStatus = async () => {
	const { height, finalizedHeight } = await makeRequest(`${config.PUBLIC_NODEWATCH_URL}/api/symbol/height`);

	return { height: Number(height), finalizedHeight: Number(finalizedHeight) };
};

export const fetchBlockInfo = stubValue(stubBlocks[0]);

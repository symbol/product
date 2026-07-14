import config from '@/app/config';
import { BLOCK_STATUS } from '@/app/constants';

/**
 * @typedef ChainStatus
 * @property {number} height - the current chain height.
 * @property {number|null} finalizedHeight - the finalized height (null for NEM, which has no finalization).
 */

/**
 * Resolves a block's finality status. A NEM block is safe once it is buried deeper than the
 * configured unwind limit below the chain height.
 * @param {object} block - the block to evaluate.
 * @param {ChainStatus} [chainStatus] - the current chain status.
 * @returns {string} the block status token (see BLOCK_STATUS).
 */
export const getBlockStatus = (block, chainStatus) => {
	const chainHeight = chainStatus?.height || 0;
	const isSafe = chainHeight > 0 && chainHeight - block.height > config.PUBLIC_NEM_BLOCKCHAIN_UNWIND_LIMIT;

	return isSafe ? BLOCK_STATUS.SAFE : BLOCK_STATUS.CREATED;
};

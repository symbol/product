import { BLOCK_STATUS } from '@/app/constants';

/**
 * @typedef ChainStatus
 * @property {number} height - the current chain height.
 * @property {number|null} finalizedHeight - the finalized height.
 */

/**
 * Resolves a block's finality status. A Symbol block is finalized once its height is at or below the
 * network's finalized height.
 * @param {object} block - the block to evaluate.
 * @param {ChainStatus} [chainStatus] - the current chain status.
 * @returns {string} the block status token (see BLOCK_STATUS).
 */
export const getBlockStatus = (block, chainStatus) => {
	const finalizedHeight = chainStatus?.finalizedHeight || 0;
	const isFinalized = finalizedHeight > 0 && block.height <= finalizedHeight;

	return isFinalized ? BLOCK_STATUS.FINALIZED : BLOCK_STATUS.CREATED;
};

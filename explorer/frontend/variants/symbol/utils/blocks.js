import { BLOCK_STATUS } from '@/app/constants';

/**
 * Resolves a block's finality status from the Symbol REST list response.
 * @param {object} block - the block to evaluate.
 * @returns {string} the block status token (see BLOCK_STATUS).
 */
export const getBlockStatus = block => block.isFinalized === true ? BLOCK_STATUS.FINALIZED : BLOCK_STATUS.CREATED;

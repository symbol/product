// Symbol variant — blocks API (returns static stub fixtures, no data layer / node calls yet).
import { stubBlocks } from './fixtures';
import { stubPage, stubValue } from './stub';

/**
 * @typedef ChainStatus
 * @property {number} height - the current chain height.
 * @property {number|null} finalizedHeight - the finalized height.
 */


const STUB_FINALIZED_HEIGHT = stubBlocks[3].height;

export const fetchBlockPage = stubPage(stubBlocks);
export const fetchChainHight = () => Promise.resolve(stubBlocks[0].height);
export const fetchChainStatus = () => Promise.resolve({ height: stubBlocks[0].height, finalizedHeight: STUB_FINALIZED_HEIGHT });
export const fetchBlockInfo = stubValue(stubBlocks[0]);

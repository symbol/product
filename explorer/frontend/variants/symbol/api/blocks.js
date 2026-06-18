// Symbol variant — blocks API (returns static stub fixtures, no data layer / node calls yet).
import { stubBlocks } from './fixtures';
import { stubPage, stubValue } from './stub';

export const fetchBlockPage = stubPage(stubBlocks);
export const fetchChainHight = () => Promise.resolve(stubBlocks[0].height);
export const fetchBlockInfo = stubValue(stubBlocks[0]);

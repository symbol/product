// Symbol variant — accounts API (returns static stub fixtures, no data layer / node calls yet).
import { stubAccounts, stubHarvestedBlocks } from './fixtures';
import { stubPage, stubValue } from './stub';

export const fetchAccountPage = stubPage(stubAccounts);
export const fetchAccountInfo = stubValue(stubAccounts[0]);
export const fetchAccountInfoByPublicKey = stubValue(stubAccounts[0]);
export const fetchAccountHarvestedBlockPage = stubPage(stubHarvestedBlocks);

// Symbol variant — mosaics API (returns static stub fixtures, no data layer / node calls yet).
import { stubMosaics } from './fixtures';
import { stubPage, stubValue } from './stub';

export const fetchMosaicPage = stubPage(stubMosaics);
export const fetchMosaicInfo = stubValue(stubMosaics[0]);

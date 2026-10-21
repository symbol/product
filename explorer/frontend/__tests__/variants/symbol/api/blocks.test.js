import { blockListResponse, emptyBlockResponse } from '../../../../__fixtures__/api/symbol/block-list';
import { blockList, emptyBlock } from '../../../../__fixtures__/local/symbol/block-list';
import { runApiRequestTests, runApiResultTests } from '../../../test-utils/api';
import { nodewatchHeightResponse } from '../../../test-utils/finalization';
import { fetchBlockPage, fetchChainHight, fetchChainStatus } from '@/app/variants/symbol/api/blocks';

// Mocks

jest.mock('@/app/utils/server', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/app/utils/server')
	};
});

// Constants

const blocksURL = 'https://explorer.backend/blocks';
const nodewatchHeightURL = 'https://node.list/api/symbol/height';
const emptyPageResponse = [];
const firstBlockListResponse = [{ ...emptyBlockResponse, height: 1 }];
const firstBlockList = [{ ...emptyBlock, height: 1 }];

// Tests

describe('variants/symbol/api/blocks', () => {
	describe('fetchBlockPage', () => {
		describe('request', () => {
			const requestCases = [
				{
					description: 'requests the first page with the default page size',
					config: { params: {} },
					expected: { url: `${blocksURL}?limit=10` }
				},
				{
					description: 'requests the given page when "fromHeight" and "pageSize" are provided',
					config: {
						params: {
							fromHeight: 100,
							pageSize: 123
						}
					},
					expected: { url: `${blocksURL}?limit=123&fromHeight=100` }
				}
			];

			runApiRequestTests({
				functionToTest: fetchBlockPage,
				response: emptyPageResponse,
				cases: requestCases
			});
		});

		describe('result', () => {
			const resultCases = [
				{
					description: 'maps the blocks with the next page params',
					config: { response: blockListResponse },
					expected: {
						result: {
							data: blockList,
							nextPageParams: { fromHeight: 3778876 }
						}
					}
				},
				{
					description: 'maps the blocks without the next page params when the page ends on nemesis',
					config: { response: firstBlockListResponse },
					expected: {
						result: {
							data: firstBlockList,
							nextPageParams: null
						}
					}
				},
				{
					description: 'returns an empty page when there are no blocks',
					config: { response: emptyPageResponse },
					expected: {
						result: {
							data: [],
							nextPageParams: null
						}
					}
				}
			];

			runApiResultTests({ functionToTest: fetchBlockPage, cases: resultCases });
		});
	});

	describe('fetchChainHight', () => {
		describe('request', () => {
			const requestCases = [
				{
					description: 'requests the chain height',
					config: {},
					expected: { url: nodewatchHeightURL }
				}
			];

			runApiRequestTests({
				functionToTest: fetchChainHight,
				response: nodewatchHeightResponse,
				cases: requestCases
			});
		});

		describe('result', () => {
			const resultCases = [
				{
					description: 'returns the chain height',
					config: { response: nodewatchHeightResponse },
					expected: { result: 6500 }
				}
			];

			runApiResultTests({ functionToTest: fetchChainHight, cases: resultCases });
		});
	});

	describe('fetchChainStatus', () => {
		describe('result', () => {
			const resultCases = [
				{
					description: 'returns the chain height with the finalized height',
					config: { response: nodewatchHeightResponse },
					expected: {
						result: {
							height: 6500,
							finalizedHeight: 6120
						}
					}
				}
			];

			runApiResultTests({ functionToTest: fetchChainStatus, cases: resultCases });
		});
	});
});

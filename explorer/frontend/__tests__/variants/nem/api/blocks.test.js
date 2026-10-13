import { blockWithTransactionsResponse, emptyBlockResponse } from '../../../../__fixtures__/api/nem/block-info';
import { blockListResponse } from '../../../../__fixtures__/api/nem/block-list';
import { blockWithTransactions, emptyBlock } from '../../../../__fixtures__/local/block';
import { blockList } from '../../../../__fixtures__/local/block-list';
import { error404Response, runApiRequestTests, runApiResultTests } from '../../../test-utils/api';
import { fetchBlockInfo, fetchBlockPage, fetchChainHight, fetchChainStatus } from '@/app/variants/nem/api/blocks';

// Mocks

jest.mock('@/app/utils/server', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/app/utils/server')
	};
});

// Constants

const blocksURL = 'https://explorer.backend/blocks';
const blockURL = 'https://explorer.backend/block';
const emptyPageResponse = [];
const newestBlockListResponse = [emptyBlockResponse];

// Tests

describe('variants/nem/api/blocks', () => {
	describe('fetchBlockPage', () => {
		describe('request', () => {
			const requestCases = [
				{
					description: 'requests the first page with the default page size',
					config: { params: {} },
					expected: { url: `${blocksURL}?limit=10&offset=0` }
				},
				{
					description: 'requests the given page number and page size',
					config: {
						params: {
							pageNumber: 2,
							pageSize: 123
						}
					},
					expected: { url: `${blocksURL}?limit=123&offset=123` }
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
					description: 'maps the blocks',
					config: { response: blockListResponse },
					expected: {
						result: {
							data: blockList,
							pageNumber: 1
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
					description: 'requests the newest block',
					config: {},
					expected: { url: `${blocksURL}?limit=1&offset=0` }
				}
			];

			runApiRequestTests({
				functionToTest: fetchChainHight,
				response: newestBlockListResponse,
				cases: requestCases
			});
		});

		describe('result', () => {
			const resultCases = [
				{
					description: 'returns the newest block height',
					config: { response: newestBlockListResponse },
					expected: { result: emptyBlock.height }
				}
			];

			runApiResultTests({ functionToTest: fetchChainHight, cases: resultCases });
		});
	});

	describe('fetchChainStatus', () => {
		describe('result', () => {
			const resultCases = [
				{
					description: 'returns the chain height without a finalized height',
					config: { response: newestBlockListResponse },
					expected: {
						result: {
							height: emptyBlock.height,
							finalizedHeight: null
						}
					}
				}
			];

			runApiResultTests({ functionToTest: fetchChainStatus, cases: resultCases });
		});
	});

	describe('fetchBlockInfo', () => {
		describe('request', () => {
			const requestCases = [
				{
					description: 'requests the block by height',
					config: { params: blockWithTransactionsResponse.height },
					expected: { url: `${blockURL}/${blockWithTransactionsResponse.height}` }
				}
			];

			runApiRequestTests({
				functionToTest: fetchBlockInfo,
				response: blockWithTransactionsResponse,
				cases: requestCases
			});
		});

		describe('result', () => {
			const resultCases = [
				{
					description: 'maps a block with transactions',
					config: { response: blockWithTransactionsResponse },
					expected: { result: blockWithTransactions }
				},
				{
					description: 'maps an empty block',
					config: { response: emptyBlockResponse },
					expected: { result: emptyBlock }
				},
				{
					description: 'returns null when the block does not exist',
					config: { error: error404Response },
					expected: { result: null }
				}
			];

			runApiResultTests({ functionToTest: fetchBlockInfo, cases: resultCases });
		});
	});
});

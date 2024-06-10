import { runAPITest } from '../test-utils/api';
import { blockInfoResponse, blockInfoResult, blockPageResponse, blockPageResult } from '../test-utils/blocks';
import { fetchBlockInfo, fetchBlockPage, fetchChainHight } from '@/api/blocks';

jest.mock('@/utils/server', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/utils/server')
	};
});

describe('api/blocks', () => {
	describe('fetchBlockPage', () => {
		it('fetch block page', async () => {
			// Arrange:
			const searchCriteria = {
				pageNumber: 2,
				pageSize: 123
			};
			const expectedURL = 'https://explorer.backend/blocks?limit=123&offset=123';
			const expectedResult = blockPageResult;

			// Act & Assert:
			await runAPITest(fetchBlockPage, searchCriteria, blockPageResponse, expectedURL, expectedResult);
		});
	});

	describe('fetchBlockInfo', () => {
		it('fetch block info by height', async () => {
			// Arrange:
			const params = '1111111';
			const expectedURL = 'https://explorer.backend/block/1111111';
			const expectedResult = blockInfoResult;

			// Act & Assert:
			await runAPITest(fetchBlockInfo, params, blockInfoResponse, expectedURL, expectedResult);
		});
	});

	describe('fetchChainHight', () => {
		it('fetch chain height', async () => {
			// Arrange:
			const params = null;
			const expectedURL = 'https://explorer.backend/blocks?limit=1&offset=0';
			const expectedResult = 4695085;

			// Act & Assert:
			await runAPITest(fetchChainHight, params, blockPageResponse, expectedURL, expectedResult);
		});
	});
});

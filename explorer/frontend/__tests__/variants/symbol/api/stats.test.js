import {
	blockStatisticsResponse,
	genesisBlockStatisticsResponse,
	zeroBlockStatisticsResponse
} from '../../../../__fixtures__/api/symbol/block-statistics';
import { blockStats, genesisBlockStats, zeroBlockStats } from '../../../../__fixtures__/local/symbol/block-stats';
import { runApiRequestTests, runApiResultTests } from '../../../test-utils/api';
import * as utils from '@/app/utils/server';
import { fetchBlockStats } from '@/app/variants/symbol/api/stats';

jest.mock('@/app/utils/server', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/app/utils/server')
	};
});

describe('variants/symbol/api/stats', () => {
	describe('fetchBlockStats', () => {
		describe('request', () => {
			runApiRequestTests({
				functionToTest: fetchBlockStats,
				response: blockStatisticsResponse,
				cases: [
					{
						description: 'requests block statistics without query parameters',
						config: {},
						expected: { url: 'https://explorer.backend/block/statistics' }
					}
				]
			});
		});

		describe('result', () => {
			runApiResultTests({
				functionToTest: fetchBlockStats,
				cases: [
					{
						description: 'preserves REST display units, precision, chart heights, order and types',
						config: { response: blockStatisticsResponse },
						expected: { result: blockStats }
					},
					{
						description: 'preserves the empty time chart and null average for genesis',
						config: { response: genesisBlockStatisticsResponse },
						expected: { result: genesisBlockStats }
					},
					{
						description: 'preserves valid zero statistics',
						config: { response: zeroBlockStatisticsResponse },
						expected: { result: zeroBlockStats }
					}
				]
			});
		});

		it.each([
			['503', { response: { status: 503, data: { message: 'Service Unavailable' } } }],
			['network failure', new Error('Network Error')]
		])('propagates %s without falling back to a stub', async (_description, error) => {
			// Arrange:
			jest.spyOn(utils, 'makeRequest').mockRejectedValue(error);

			// Act + Assert:
			await expect(fetchBlockStats()).rejects.toBe(error);
		});
	});
});

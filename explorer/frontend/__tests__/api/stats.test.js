import { accountPageResponse } from '../test-utils/account';
import { blockPageResponse } from '../test-utils/blocks';
import {
	accountStatisticsResponse,
	accountStatsResult,
	blockStatsResult,
	marketDataResponse,
	marketDataResult,
	nodeListResponse,
	priceByDateResponse,
	supernodeStatsResponse,
	transactionStatisticsResponse,
	transactionStatsResult
} from '../test-utils/stats';
import { fetchAccountStats, fetchBlockStats, fetchMarketData, fetchNodeStats, fetchPriceByDate, fetchTransactionStats } from '@/api/stats';
import * as utils from '@/utils/server';

jest.mock('@/utils/server', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/utils/server')
	};
});

const runStatsTest = async (functionToTest, args, responseMap, expectedResult) => {
	// Arrange:
	const spy = jest.spyOn(utils, 'makeRequest');

	spy.mockImplementation(url => {
		const response = responseMap[url];

		if (response) return Promise.resolve(response);
		else
			return Promise.reject({
				response: {
					data: {
						status: 404
					}
				}
			});
	});

	// Act:
	const result = await functionToTest(...args);

	// Assert:
	expect(result).toStrictEqual(expectedResult);
};

describe('api/stats', () => {
	describe('fetchAccountStats', () => {
		it('returns account statistics', async () => {
			// Arrange:
			const functionToTest = fetchAccountStats;
			const args = [];
			const responseMap = {
				'https://explorer.backend/account/statistics': accountStatisticsResponse,
				'https://explorer.backend/accounts?limit=10&offset=0': accountPageResponse
			};
			const expectedResult = accountStatsResult;

			// Act & Assert:
			await runStatsTest(functionToTest, args, responseMap, expectedResult);
		});
	});

	describe('fetchTransactionStats', () => {
		it('returns transaction statistics', async () => {
			// Arrange:
			const functionToTest = fetchTransactionStats;
			const args = [];
			const responseMap = {
				'https://explorer.backend/transaction/statistics': transactionStatisticsResponse,
				'https://explorer.backend/blocks?limit=240&offset=0': blockPageResponse
			};
			const expectedResult = transactionStatsResult;

			// Act & Assert:
			await runStatsTest(functionToTest, args, responseMap, expectedResult);
		});
	});

	describe('fetchBlockStats', () => {
		it('returns block statistics', async () => {
			// Arrange:
			const functionToTest = fetchBlockStats;
			const args = [];
			const responseMap = {
				'https://explorer.backend/blocks?limit=241&offset=0': blockPageResponse
			};
			const expectedResult = blockStatsResult;

			// Act & Assert:
			await runStatsTest(functionToTest, args, responseMap, expectedResult);
		});
	});

	describe('fetchNodeStats', () => {
		it('returns node statistics', async () => {
			// Arrange:
			const functionToTest = fetchNodeStats;
			const args = [];
			const responseMap = {
				'https://node.list': nodeListResponse,
				'https://supernode.stats': supernodeStatsResponse
			};
			const expectedResult = {
				total: 3,
				supernodes: 2
			};

			// Act & Assert:
			await runStatsTest(functionToTest, args, responseMap, expectedResult);
		});
	});

	describe('fetchMarketData', () => {
		it('returns market data', async () => {
			// Arrange:
			const functionToTest = fetchMarketData;
			const args = [];
			const responseMap = {
				'https://market.data': marketDataResponse
			};
			const expectedResult = marketDataResult;

			// Act & Assert:
			await runStatsTest(functionToTest, args, responseMap, expectedResult);
		});
	});

	describe('fetchPriceByDate', () => {
		it('returns market data', async () => {
			// Arrange:
			const functionToTest = fetchPriceByDate;
			const args = ['2024-06-10 20:56:08', 'UAH'];
			const responseMap = {
				'https://historical.price?date=10-06-2024': priceByDateResponse
			};
			const expectedResult = 0.857586129846396;

			// Act & Assert:
			await runStatsTest(functionToTest, args, responseMap, expectedResult);
		});

		it('returns market data', async () => {
			// Arrange:
			const functionToTest = fetchPriceByDate;
			const args = ['2024-06-10 20:56:08', 'UNKNOWN_FIAT_TICKER'];
			const responseMap = {
				'https://historical.price?date=10-06-2024': priceByDateResponse
			};
			const expectedResult = null;

			// Act & Assert:
			await runStatsTest(functionToTest, args, responseMap, expectedResult);
		});
	});
});

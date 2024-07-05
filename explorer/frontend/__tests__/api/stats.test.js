import { accountPageResponse } from '../test-utils/accounts';
import { error404Response } from '../test-utils/api';
import { blockPageResponse } from '../test-utils/blocks';
import {
	accountStatisticsResponse,
	accountStatisticsResult,
	blockStatisticsResult,
	blockTransactionChartResult,
	dailyTransactionChartResponse,
	dailyTransactionChartResult,
	marketDataResponse,
	marketDataResult,
	monthlyTransactionChartResponse,
	monthlyTransactionChartResult,
	nodeListResponse,
	priceByDateResponse,
	supernodeStatisticsResponse,
	transactionStatisticsResponse,
	transactionStatisticsResult
} from '../test-utils/stats';
import {
	fetchAccountStats,
	fetchBlockStats,
	fetchMarketData,
	fetchNodeStats,
	fetchPriceByDate,
	fetchTransactionChart,
	fetchTransactionStats
} from '@/api/stats';
import * as utils from '@/utils/server';

jest.mock('@/utils/server', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/utils/server')
	};
});

beforeAll(() => {
	jest.useFakeTimers('modern');
	jest.setSystemTime(new Date('2024-06-13T10:20:30Z'));
});

afterAll(() => {
	jest.useRealTimers();
});

const runStatsTest = async (functionToTest, args, responseMap, expectedResult) => {
	// Arrange:
	const spy = jest.spyOn(utils, 'makeRequest');

	spy.mockImplementation(url => {
		const response = responseMap[url];

		if (response)
			return Promise.resolve(response);
		else
			return Promise.reject(error404Response);
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
			const expectedResult = accountStatisticsResult;

			// Act + Assert:
			await runStatsTest(functionToTest, args, responseMap, expectedResult);
		});
	});

	describe('fetchTransactionChart', () => {
		it('returns daily transaction chart data', async () => {
			// Arrange:
			const functionToTest = fetchTransactionChart;
			const args = [{ isPerDay: true }];
			const responseMap = {
				'https://explorer.backend/transaction/daily?startDate=2024-03-15&endDate=2024-06-13': dailyTransactionChartResponse
			};
			const expectedResult = dailyTransactionChartResult;

			// Act + Assert:
			await runStatsTest(functionToTest, args, responseMap, expectedResult);
		});

		it('returns monthly transaction chart data', async () => {
			// Arrange:
			const functionToTest = fetchTransactionChart;
			const args = [{ isPerMonth: true }];
			const responseMap = {
				'https://explorer.backend/transaction/monthly?startDate=2020-06-13&endDate=2024-06-13': monthlyTransactionChartResponse
			};
			const expectedResult = monthlyTransactionChartResult;

			// Act + Assert:
			await runStatsTest(functionToTest, args, responseMap, expectedResult);
		});

		it('returns block transaction chart data', async () => {
			// Arrange:
			const functionToTest = fetchTransactionChart;
			const args = [{}];
			const responseMap = {
				'https://explorer.backend/blocks?limit=240&offset=0': blockPageResponse.slice(-3)
			};
			const expectedResult = blockTransactionChartResult;

			// Act + Assert:
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
			const expectedResult = transactionStatisticsResult;

			// Act + Assert:
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
			const expectedResult = blockStatisticsResult;

			// Act + Assert:
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
				'https://supernode.stats': supernodeStatisticsResponse
			};
			const expectedResult = {
				total: 3,
				supernodes: 2
			};

			// Act + Assert:
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

			// Act + Assert:
			await runStatsTest(functionToTest, args, responseMap, expectedResult);
		});
	});

	describe('fetchPriceByDate', () => {
		it('returns market data for provided ticker', async () => {
			// Arrange:
			const functionToTest = fetchPriceByDate;
			const args = ['2024-06-06 20:56:08', 'UAH'];
			const responseMap = {
				'https://historical.price?date=06-06-2024': priceByDateResponse
			};
			const expectedResult = 0.857586129846396;

			// Act + Assert:
			await runStatsTest(functionToTest, args, responseMap, expectedResult);
		});

		it('returns market data for provided ticker', async () => {
			// Arrange:
			const functionToTest = fetchPriceByDate;
			const args = ['2024-11-11 20:56:08', 'UAH'];
			const responseMap = {
				'https://historical.price?date=11-11-2024': priceByDateResponse
			};
			const expectedResult = 0.857586129846396;

			// Act + Assert:
			await runStatsTest(functionToTest, args, responseMap, expectedResult);
		});

		it('returns null if ticker is not supported', async () => {
			// Arrange:
			const functionToTest = fetchPriceByDate;
			const args = ['2024-06-10 20:56:08', 'UNKNOWN_FIAT_TICKER'];
			const responseMap = {
				'https://historical.price?date=10-06-2024': priceByDateResponse
			};
			const expectedResult = null;

			// Act + Assert:
			await runStatsTest(functionToTest, args, responseMap, expectedResult);
		});
	});
});

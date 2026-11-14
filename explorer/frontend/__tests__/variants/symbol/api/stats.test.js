import { emptyBlockResponse } from '../../../../__fixtures__/api/symbol/block-list';
import {
	dailyTransactionStatisticsResponse,
	monthlyTransactionStatisticsResponse,
	transactionStatisticsResponse
} from '../../../../__fixtures__/api/symbol/transaction-statistics';
import {
	dailyTransactionChart,
	monthlyTransactionChart,
	transactionStatistics
} from '../../../../__fixtures__/local/symbol/transaction-statistics';
import { runApiRequestTests, runApiResultTests } from '../../../test-utils/api';
import * as utils from '@/app/utils/server';
import { fetchTransactionChart, fetchTransactionStats } from '@/app/variants/symbol/api/stats';

jest.mock('@/app/utils/server', () => ({ __esModule: true, ...jest.requireActual('@/app/utils/server') }));
const statisticsURL = 'https://explorer.backend/transaction/statistics';
const blocksURL = 'https://explorer.backend/blocks';

beforeEach(() => {
	jest.useFakeTimers();
	jest.setSystemTime(new Date('2024-06-13T10:20:30Z'));
});
afterEach(() => jest.useRealTimers());

describe('variants/symbol/api/stats', () => {
	describe('fetchTransactionStats', () => {
		runApiRequestTests({
			functionToTest: fetchTransactionStats,
			response: transactionStatisticsResponse,
			cases: [{ description: 'requests summary without query parameters', config: {}, expected: { url: statisticsURL } }]
		});
		runApiResultTests({
			functionToTest: fetchTransactionStats,
			cases: [
				{
					description: 'maps all fields without rounding the REST average',
					config: { response: transactionStatisticsResponse }, expected: { result: transactionStatistics }
				},
				{
					description: 'preserves zero values',
					config: { response: { total: 0, last30Days: 0, last24Hours: 0, averagePerBlock: 0 } },
					expected: { result: { total: 0, last30Days: 0, last24Hours: 0, averagePerBlock: 0 } }
				}
			]
		});
		it('only fetches the REST summary', async () => {
			// Arrange:
			const spy = jest.spyOn(utils, 'makeRequest').mockResolvedValue(transactionStatisticsResponse);

			// Act:
			await fetchTransactionStats();

			// Assert:
			expect(spy.mock.calls).toEqual([[statisticsURL]]);
		});
	});

	describe('fetchTransactionChart', () => {
		runApiRequestTests({
			functionToTest: fetchTransactionChart, response: { data: [] },
			cases: [
				{
					description: 'requests 90 days ago through today for Daily', config: { params: { isPerDay: true } },
					expected: { url: `${statisticsURL}/range?startDate=2024-03-15&endDate=2024-06-13&periodType=DAY` }
				},
				{
					description: 'requests 48 months ago through today for Monthly', config: { params: { isPerMonth: true } },
					expected: { url: `${statisticsURL}/range?startDate=2020-06-13&endDate=2024-06-13&periodType=MONTH` }
				}
			]
		});
		runApiResultTests({
			functionToTest: fetchTransactionChart,
			cases: [
				{
					description: 'maps daily periods in response order without filling gaps',
					config: { params: { isPerDay: true }, response: dailyTransactionStatisticsResponse },
					expected: { result: dailyTransactionChart }
				},
				{
					description: 'maps months to first-day labels without filling gaps',
					config: { params: { isPerMonth: true }, response: monthlyTransactionStatisticsResponse },
					expected: { result: monthlyTransactionChart }
				},
				...[
					{ name: 'Daily', params: { isPerDay: true } },
					{ name: 'Monthly', params: { isPerMonth: true } }
				].map(({ name, params }) => ({
					description: `preserves an empty ${name} range`,
					config: { params, response: { data: [] } }, expected: { result: [] }
				}))
			]
		});
		it.each([
			['2024-03-31T23:30:00-07:00', { isPerDay: true }, '2024-01-02', '2024-04-01', 'DAY'],
			['2024-01-01T00:30:00Z', { isPerDay: true }, '2023-10-03', '2024-01-01', 'DAY'],
			['2024-02-29T23:59:59Z', { isPerMonth: true }, '2020-02-29', '2024-02-29', 'MONTH'],
			['2104-02-29T00:00:00Z', { isPerMonth: true }, '2100-02-28', '2104-02-29', 'MONTH'],
			['2024-12-31T23:59:59Z', { isPerMonth: true }, '2020-12-31', '2024-12-31', 'MONTH']
		])('uses UTC calendar bounds at %s', async (now, filter, start, end, period) => {
			// Arrange:
			jest.setSystemTime(new Date(now));
			const spy = jest.spyOn(utils, 'makeRequest').mockResolvedValue({ data: [] });

			// Act:
			const result = await fetchTransactionChart(filter);

			// Assert:
			expect(result).toEqual([]);
			expect(spy.mock.calls).toEqual([[`${statisticsURL}/range?startDate=${start}&endDate=${end}&periodType=${period}`]]);
		});
		it.each([
			['240 blocks', 500, 240, ['?limit=100', '?limit=100&fromHeight=400', '?limit=40&fromHeight=300']],
			['a short second page', 500, 123, ['?limit=100', '?limit=100&fromHeight=400']],
			['an empty second page', 500, 100, ['?limit=100', '?limit=100&fromHeight=400']],
			['nemesis on a full page', 100, 100, ['?limit=100']],
			['nemesis on a short page', 3, 3, ['?limit=100']],
			['no blocks', 500, 0, ['?limit=100']]
		])('returns ascending tuples and stops at %s', async (name, head, count, queries) => {
			// Arrange: model REST descending height cursors.
			const blocks = Array.from({ length: count }, (_, index) => ({
				...emptyBlockResponse, height: head - index, transactionCount: index
			}));
			const expected = Array.from({ length: count }, (_, index) => [head - count + 1 + index, count - 1 - index]);
			const spy = jest.spyOn(utils, 'makeRequest').mockImplementation(url => {
				const params = new URL(url).searchParams;
				const fromHeight = Number(params.get('fromHeight') || head);
				return Promise.resolve(blocks.filter(block => block.height <= fromHeight).slice(0, Number(params.get('limit'))));
			});

			// Act:
			const result = await fetchTransactionChart({});

			// Assert:
			expect(result).toEqual(expected);
			expect(spy.mock.calls).toEqual(queries.map(query => [`${blocksURL}${query}`]));
		});

		it('keeps the initial block range when the head advances between page requests', async () => {
			// Arrange:
			const blocks = Array.from({ length: 500 }, (_, index) => ({
				...emptyBlockResponse, height: 500 - index, transactionCount: 1000 - index
			}));
			const expected = Array.from({ length: 240 }, (_, index) => [261 + index, 761 + index]);
			const spy = jest.spyOn(utils, 'makeRequest').mockImplementationOnce(url => {
				const limit = Number(new URL(url).searchParams.get('limit'));
				const firstPage = blocks.slice(0, limit);

				return Promise.resolve(firstPage).then(page => {
					blocks.unshift(
						{ ...emptyBlockResponse, height: 502, transactionCount: 1002 },
						{ ...emptyBlockResponse, height: 501, transactionCount: 1001 }
					);
					return page;
				});
			}).mockImplementation(url => {
				const params = new URL(url).searchParams;
				const fromHeight = Number(params.get('fromHeight') || blocks[0].height);

				return Promise.resolve(blocks.filter(block => block.height <= fromHeight).slice(0, Number(params.get('limit'))));
			});

			// Act:
			const result = await fetchTransactionChart({});

			// Assert:
			expect(result).toEqual(expected);
			expect(spy.mock.calls).toEqual([
				[`${blocksURL}?limit=100`],
				[`${blocksURL}?limit=100&fromHeight=400`],
				[`${blocksURL}?limit=40&fromHeight=300`]
			]);
		});

		it('propagates a later block-page failure instead of returning a partial chart', async () => {
			// Arrange:
			const error = { response: { status: 503 } };
			const blocks = Array.from({ length: 100 }, (_, index) => ({ ...emptyBlockResponse, height: 500 - index }));
			const spy = jest.spyOn(utils, 'makeRequest').mockResolvedValueOnce(blocks).mockRejectedValueOnce(error);

			// Act + Assert:
			await expect(fetchTransactionChart({})).rejects.toBe(error);
			expect(spy.mock.calls).toEqual([[`${blocksURL}?limit=100`], [`${blocksURL}?limit=100&fromHeight=400`]]);
		});
	});

	describe.each([
		['summary', fetchTransactionStats, undefined],
		['daily chart', fetchTransactionChart, { isPerDay: true }],
		['monthly chart', fetchTransactionChart, { isPerMonth: true }],
		['block chart', fetchTransactionChart, {}]
	])('%s failures', (name, fetchData, params) => {
		it.each([new Error('Network unavailable'), { response: { status: 503 } }])('propagates %p without fallback', async error => {
			// Arrange:
			const spy = jest.spyOn(utils, 'makeRequest').mockRejectedValue(error);

			// Act + Assert:
			await expect(fetchData(params)).rejects.toBe(error);
			expect(spy).toHaveBeenCalledTimes(1);
		});
	});
});

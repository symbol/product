import { accountStatisticsResponse, emptyAccountStatisticsResponse } from '../../../../__fixtures__/api/symbol/account-statistics';
import { accountStats, emptyAccountStats } from '../../../../__fixtures__/local/symbol/account-stats';
import { runApiRequestTests, runApiResultTests } from '../../../test-utils/api';
import * as utils from '@/app/utils/server';
import { fetchAccountStats } from '@/app/variants/symbol/api/stats';

// Mocks

jest.mock('@/app/utils/server', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/app/utils/server')
	};
});

// Constants

const accountStatisticsURL = 'https://explorer.backend/account/statistics';

// Tests

describe('variants/symbol/api/stats', () => {
	describe('fetchAccountStats', () => {
		describe('request', () => {
			runApiRequestTests({
				functionToTest: fetchAccountStats,
				response: accountStatisticsResponse,
				cases: [{
					description: 'requests account statistics without query parameters',
					config: {},
					expected: { url: accountStatisticsURL }
				}]
			});

			it('requests only statistics without fetching accounts to reconstruct them', async () => {
				// Arrange:
				const spy = jest.spyOn(utils, 'makeRequest').mockResolvedValue(accountStatisticsResponse);

				// Act:
				await fetchAccountStats();

				// Assert:
				expect(spy.mock.calls).toStrictEqual([[accountStatisticsURL]]);
			});
		});

		describe('result', () => {
			runApiResultTests({
				functionToTest: fetchAccountStats,
				cases: [
					{
						description: 'preserves REST precision, tuple order and eligible participation independently of active counts',
						config: { response: accountStatisticsResponse },
						expected: { result: accountStats }
					},
					{
						description: 'preserves fewer than ten importance entries without adding a Rest entry',
						config: {
							response: {
								...emptyAccountStatisticsResponse,
								total: 2,
								top10AccountsImportance: 24.5072,
								importanceBreakdown: [[21.0754, 'TACCOUNT01'], [3.4318, 'TACCOUNT02']]
							}
						},
						expected: {
							result: {
								...emptyAccountStats,
								total: 2,
								top10AccountsImportance: 24.5072,
								importanceBreakdown: [[21.0754, 'TACCOUNT01'], [3.4318, 'TACCOUNT02']]
							}
						}
					},
					{
						description: 'returns zero counts, zero percentages and empty charts for an empty snapshot',
						config: { response: emptyAccountStatisticsResponse },
						expected: { result: emptyAccountStats }
					},
					{
						description: 'preserves active accounts with zero participation and an empty chart when none are eligible',
						config: {
							response: { ...accountStatisticsResponse, eligibleForHarvesting: 0,
								harvestingAccountsPercentage: 0, harvestingAccountsChart: [] }
						},
						expected: {
							result: { ...accountStats, eligibleForHarvesting: 0,
								harvestingAccountsPercentage: 0, harvestingAccountsChart: [] }
						}
					},
					{
						description: 'preserves a zero participation percentage with a nonempty eligible chart',
						config: {
							response: { ...accountStatisticsResponse, harvesting: 0, harvestingAccountsPercentage: 0,
								harvestingAccountsChart: [[0, 'Harvesting'], [100, 'Not harvesting']] }
						},
						expected: {
							result: { ...accountStats, harvesting: 0, harvestingAccountsPercentage: 0,
								harvestingAccountsChart: [[0, 'Harvesting'], [100, 'Not harvesting']] }
						}
					}
				]
			});
		});

		it.each([
			['request failure', new Error('Network unavailable')],
			['503', { response: { status: 503, data: { message: 'Service unavailable' } } }]
		])('propagates %s without falling back to stub data', async (_description, error) => {
			// Arrange:
			jest.spyOn(utils, 'makeRequest').mockRejectedValue(error);

			// Act + Assert:
			await expect(fetchAccountStats()).rejects.toBe(error);
		});
	});
});

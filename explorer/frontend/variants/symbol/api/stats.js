// Symbol variant — Account statistics use Explorer REST; other statistics remain stubs.
import { stubBlockStats, stubMarketData, stubNodes, stubTransactionChart, stubTransactionStats } from './fixtures';
import { stubValue } from './stub';
import { createApiUrl, makeRequest } from '@/app/utils/server';

/**
 * Fetches the account statistics from Explorer REST.
 * @returns {Promise<object>} account statistics in display units.
 */
export const fetchAccountStats = async () => {
	const stats = await makeRequest(createApiUrl('account/statistics'));

	return accountStatsFromDTO(stats);
};

export const fetchTransactionChart = stubValue(stubTransactionChart);
export const fetchTransactionStats = stubValue(stubTransactionStats);
export const fetchBlockStats = stubValue(stubBlockStats);
export const fetchNodeStats = () => Promise.resolve({ total: stubNodes.length, supernodes: 2 });
export const fetchMarketData = stubValue(stubMarketData);
export const fetchPriceByDate = () => Promise.resolve(0.031);

/**
 * Maps the account statistics used by the account list.
 * @param {object} data - raw statistics from REST, including the unused pendingVerification field.
 * @returns {object} account statistics with REST percentages and chart tuples preserved.
 */
const accountStatsFromDTO = data => ({
	total: data.total,
	harvesting: data.harvesting,
	eligibleForHarvesting: data.eligibleForHarvesting,
	top10AccountsImportance: data.top10AccountsImportance,
	harvestingAccountsPercentage: data.harvestingAccountsPercentage,
	importanceBreakdown: data.importanceBreakdown,
	harvestingAccountsChart: data.harvestingAccountsChart
});

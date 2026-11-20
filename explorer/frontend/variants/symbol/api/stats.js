import { stubAccountStats, stubMarketData, stubNodes, stubTransactionChart, stubTransactionStats } from './fixtures';
import { stubValue } from './stub';
import { createApiUrl, makeRequest } from '@/app/utils/server';

export const fetchAccountStats = stubValue(stubAccountStats);
export const fetchTransactionChart = stubValue(stubTransactionChart);
export const fetchTransactionStats = stubValue(stubTransactionStats);

/**
 * Fetches block statistics in display units.
 * @returns {Promise<object>} block statistics.
 */
export const fetchBlockStats = async () => {
	const stats = await makeRequest(createApiUrl('block/statistics'));

	return blockStatsFromDTO(stats);
};

export const fetchNodeStats = () => Promise.resolve({ total: stubNodes.length, supernodes: 2 });
export const fetchMarketData = stubValue(stubMarketData);
export const fetchPriceByDate = () => Promise.resolve(0.031);

/**
 * Maps block statistics, preserving REST units, precision and chart order.
 * @param {object} data - block statistics DTO.
 * @returns {object} block statistics for the block list and home page.
 */
const blockStatsFromDTO = data => ({
	blockTimeChart: data.blockTimeChart,
	blockFeeChart: data.blockFeeChart,
	blockDifficultyChart: data.blockDifficultyChart,
	blockTime: data.blockTime,
	blockFee: data.blockFee,
	blockDifficulty: data.blockDifficulty
});

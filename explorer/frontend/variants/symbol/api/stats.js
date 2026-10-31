import { stubAccountStats, stubBlockStats, stubMarketData, stubTransactionChart, stubTransactionStats } from './fixtures';
import { fetchNodeList } from './nodes';
import { stubValue } from './stub';

export const fetchAccountStats = stubValue(stubAccountStats);
export const fetchTransactionChart = stubValue(stubTransactionChart);
export const fetchTransactionStats = stubValue(stubTransactionStats);
export const fetchBlockStats = stubValue(stubBlockStats);
export const fetchNodeStats = async () => {
	const nodes = await fetchNodeList();

	return {
		total: nodes.length,
		supernodes: null
	};
};
export const fetchMarketData = stubValue(stubMarketData);
export const fetchPriceByDate = () => Promise.resolve(0.031);

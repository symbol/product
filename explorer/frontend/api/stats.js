import { api } from '@/app/variants/api';

export const {
	fetchAccountStats,
	fetchTransactionChart,
	fetchTransactionStats,
	fetchBlockStats,
	fetchNodeStats,
	fetchMarketData,
	fetchPriceByDate
} = api.stats;

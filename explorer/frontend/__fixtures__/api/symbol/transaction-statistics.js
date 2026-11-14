// Contract-based fixtures for the merged Symbol REST endpoints.
export const transactionStatisticsResponse = { total: 280, last30Days: 250, last24Hours: 130, averagePerBlock: 0.9958333333333333 };
export const dailyTransactionStatisticsResponse = {
	periodType: 'day',
	data: [
		{ period: '2024-03-15', totalTransactions: 9 },
		{ period: '2024-03-16', totalTransactions: 0 },
		{ period: '2024-05-31', totalTransactions: 6 }
	]
};
export const monthlyTransactionStatisticsResponse = {
	periodType: 'month',
	data: [
		{ period: '2023-12', totalTransactions: 12 },
		{ period: '2024-01', totalTransactions: 0 },
		{ period: '2024-03', totalTransactions: 7 }
	]
};

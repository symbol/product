import { fetchBlockPage } from './blocks';
import { stubAccountStats, stubBlockStats, stubMarketData, stubNodes } from './fixtures';
import { stubValue } from './stub';
import { transactionChartFilterToType } from '@/app/utils/common';
import { createApiUrl, makeRequest } from '@/app/utils/server';

export const fetchAccountStats = stubValue(stubAccountStats);

/**
 * Fetches transaction chart tuples for the selected calendar or block period.
 * @param {object} filter - existing chart mode filter.
 * @returns {Promise<Array>} chart tuples in ascending period order.
 */
export const fetchTransactionChart = async filter => {
	const type = transactionChartFilterToType(filter);

	if ('daily' === type || 'monthly' === type) {
		const endDate = new Date();
		const startDate = new Date(endDate);

		if ('daily' === type) {
			startDate.setUTCDate(startDate.getUTCDate() - 90);
		} else {
			startDate.setUTCMonth(startDate.getUTCMonth() - 48);
			// Clamp leap days when the target year has no matching calendar day.
			if (startDate.getUTCDate() !== endDate.getUTCDate())
				startDate.setUTCDate(0);
		}

		const params = new URLSearchParams({
			startDate: startDate.toISOString().slice(0, 10),
			endDate: endDate.toISOString().slice(0, 10),
			periodType: 'daily' === type ? 'DAY' : 'MONTH'
		});
		const response = await makeRequest(createApiUrl(`transaction/statistics/range?${params}`));

		return response.data.map(item => [
			'monthly' === type ? `${item.period}-01` : item.period,
			item.totalTransactions
		]);
	}

	const blocks = [];
	let nextPageParams = {};

	while (blocks.length < 240 && nextPageParams) {
		const pageSize = Math.min(100, 240 - blocks.length);
		// Each request needs the cursor returned by the preceding page.
		// eslint-disable-next-line no-await-in-loop
		const page = await fetchBlockPage({ pageSize, ...nextPageParams });
		blocks.push(...page.data);
		({ nextPageParams } = page);

		if (page.data.length < pageSize)
			break;
	}

	// Descending height cursors exclude newer blocks; separate requests are not one DB snapshot.
	return blocks.map(block => [block.height, block.transactionCount]).reverse();
};

/**
 * Fetches the published transaction summary without recomputing REST aggregates.
 * @returns {Promise<object>} transaction statistics with REST values and types preserved.
 */
export const fetchTransactionStats = async () => {
	const stats = await makeRequest(createApiUrl('transaction/statistics'));

	return {
		total: stats.total,
		last30Days: stats.last30Days,
		last24Hours: stats.last24Hours,
		averagePerBlock: stats.averagePerBlock
	};
};

export const fetchBlockStats = stubValue(stubBlockStats);
export const fetchNodeStats = () => Promise.resolve({ total: stubNodes.length, supernodes: 2 });
export const fetchMarketData = stubValue(stubMarketData);
export const fetchPriceByDate = () => Promise.resolve(0.031);

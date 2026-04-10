import { $t } from '@/app/localization';
import { formatDate } from '@/app/utils';

/**
 * Harvesting summary view model.
 * @typedef {Object} HarvestingSummaryViewModel
 * @property {boolean} hasData - Whether there is any harvesting data.
 * @property {string} latestAmount - Latest harvested amount.
 * @property {string} latestBlockNumber - Latest block number as string.
 * @property {string} latestDate - Formatted date of latest harvest.
 * @property {string} amountPer30Days - Total amount harvested in last 30 days.
 * @property {string} blocksCount - Number of blocks harvested in last 30 days (formatted for display).
 */

/**
 * Creates harvesting summary view model from API response.
 * @param {Object} summary - Harvesting summary from API.
 * @param {string} [summary.latestAmount] - Latest harvest amount.
 * @param {number} [summary.latestHeight] - Latest block height.
 * @param {string|number} [summary.latestDate] - Latest harvest timestamp.
 * @param {string} [summary.amountPer30Days] - Total amount in 30 days.
 * @param {number} [summary.blocksHarvestedPer30Days] - Blocks count in 30 days.
 * @returns {HarvestingSummaryViewModel} View model for rendering.
 */
export const createHarvestingSummaryViewModel = summary => {
	if (!summary || !summary.latestHeight) {
		return {
			hasData: false,
			latestAmount: '0',
			latestBlockNumber: '',
			latestDate: '',
			amountPer30Days: '0',
			blocksCount: $t('s_harvesting_harvested_blocks', { count: 0 })
		};
	}

	const latestDateFormatted = summary.latestDate
		? formatDate(summary.latestDate, $t, true)
		: '';

	return {
		hasData: true,
		latestAmount: String(summary.latestAmount || '0'),
		latestBlockNumber: String(summary.latestHeight),
		latestDate: latestDateFormatted,
		amountPer30Days: String(summary.amountPer30Days || '0'),
		blocksCount: $t('s_harvesting_harvested_blocks', { count: summary.blocksHarvestedPer30Days || 0 })
	};
};

import { $t } from '@/app/localization';
import { formatDate } from '@/app/utils';

/** @typedef {import('../types/Harvesting').HarvestingSummaryViewModel} HarvestingSummaryViewModel */

/**
 * Creates harvesting summary view model from API response.
 * @param {object} summary - Harvesting summary from API.
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
		latestAmount: summary.latestAmount ? `+ ${summary.latestAmount}` : '0',
		latestBlockNumber: String(summary.latestHeight),
		latestDate: latestDateFormatted,
		amountPer30Days: summary.amountPer30Days ? `+ ${summary.amountPer30Days}` : '0',
		blocksCount: $t('s_harvesting_harvested_blocks', { count: summary.blocksHarvestedPer30Days || 0 })
	};
};

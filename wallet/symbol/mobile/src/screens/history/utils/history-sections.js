import { SymbolTransactionType, TransactionGroup } from '@/app/constants';
import { $t } from '@/app/localization';
import { Colors } from '@/app/styles';
import { FilterType } from '@/app/types/Filter';

export const SectionType = {
	TRANSACTIONS: 'transactions',
	RECEIPTS: 'receipts'
};

/**
 * Returns the filter configuration for the history screen.
 * @returns {Array} Filter configuration array
 */
export const getHistoryFilterConfig = () => [
	{
		name: 'type',
		title: $t('s_history_filter_type'),
		type: FilterType.SELECT,
		options: [
			{
				label: $t('transactionDescriptor_16724'),
				value: [SymbolTransactionType.TRANSFER]
			},
			{
				label: $t('transactionDescriptor_16961'),
				value: [SymbolTransactionType.AGGREGATE_BONDED]
			},
			{
				label: $t('transactionDescriptor_16705'),
				value: [SymbolTransactionType.AGGREGATE_COMPLETE]
			}
		]
	},
	{
		name: 'from',
		title: $t('s_history_filter_from'),
		type: FilterType.ADDRESS
	},
	{
		name: 'to',
		title: $t('s_history_filter_to'),
		type: FilterType.ADDRESS
	},
	{
		name: 'harvested',
		title: $t('s_history_filter_harvested'),
		type: FilterType.BOOLEAN
	},
	{
		name: 'blocked',
		title: $t('s_history_filter_blocked'),
		type: FilterType.BOOLEAN
	}
];

/**
 * Creates a section object for the SectionList.
 * @param {string} title - Section title
 * @param {string} group - Transaction group identifier
 * @param {Array} data - Section data
 * @param {object} [titleStyle] - Optional title style
 * @returns {object} Section configuration
 */
export const createSection = (title, group, data, titleStyle = null) => ({
	title,
	group,
	data,
	titleStyle
});

/**
 * Section title styles for different transaction groups.
 */
export const SECTION_TITLE_STYLES = {
	[TransactionGroup.PARTIAL]: { color: Colors.Semantic.role.info.default },
	[TransactionGroup.UNCONFIRMED]: { color: Colors.Semantic.role.warning.default }
};

/**
 * Builds sections array from transaction and receipt data.
 * @param {object} params - Parameters object
 * @param {Array} params.partial - Partial transactions
 * @param {Array} params.unconfirmed - Unconfirmed transactions
 * @param {Array} params.confirmed - Confirmed transactions
 * @param {Array} params.harvested - Harvested receipts
 * @param {boolean} params.isHarvestedMode - Whether showing harvested mode
 * @returns {Array} Sections array for SectionList
 */
export const buildHistorySections = ({
	partial,
	unconfirmed,
	confirmed,
	harvested,
	isHarvestedMode
}) => {
	const sections = [];

	if (!isHarvestedMode) {
		if (partial?.length > 0) {
			sections.push(createSection(
				$t('transactionGroup_partial'),
				TransactionGroup.PARTIAL,
				partial,
				SECTION_TITLE_STYLES[TransactionGroup.PARTIAL]
			));
		}

		if (unconfirmed?.length > 0) {
			sections.push(createSection(
				$t('transactionGroup_unconfirmed'),
				TransactionGroup.UNCONFIRMED,
				unconfirmed,
				SECTION_TITLE_STYLES[TransactionGroup.UNCONFIRMED]
			));
		}

		if (confirmed?.length > 0) {
			sections.push(createSection(
				$t('transactionGroup_confirmed'),
				TransactionGroup.CONFIRMED,
				confirmed
			));
		}
	} else {
		if (harvested?.length > 0) {
			sections.push(createSection(
				$t('transactionGroup_harvested'),
				SectionType.RECEIPTS,
				harvested
			));
		}
	}

	return sections;
};

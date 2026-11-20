import { TransactionGroup } from '@/app/constants';
import { $t } from '@/app/localization';
import { Colors } from '@/app/styles';

/** @typedef {import('@/app/types/Transaction').Transaction} Transaction */

/**
 * Section type identifiers.
 */
export const SectionType = {
	TRANSACTIONS: 'transactions',
	RECEIPTS: 'receipts'
};

/**
 * Creates a section object for the SectionList.
 * @param {string} title - Section title.
 * @param {string} group - Transaction group identifier.
 * @param {Transaction[] | object[]} data - Section data.
 * @param {object} [titleStyle] - Optional title style.
 * @returns {object} Section configuration.
 */
export const createSection = (title, group, data, titleStyle = null) => ({
	key: group,
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
 * @param {object} params - Parameters object.
 * @param {Transaction[]} params.partial - Partial transactions.
 * @param {Transaction[]} params.unconfirmed - Unconfirmed transactions.
 * @param {Transaction[]} params.confirmed - Confirmed transactions.
 * @param {object[]} params.harvested - Harvested receipts.
 * @param {boolean} params.isHarvestedMode - Whether showing harvested mode.
 * @returns {object[]} Sections array for SectionList.
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

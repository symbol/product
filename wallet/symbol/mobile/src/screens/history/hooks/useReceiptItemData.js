import {
	ReceiptType,
	getReceiptDescription,
	getReceiptIconName,
	getReceiptTypeText
} from '../utils';
import { $t } from '@/app/localization';
import { formatDate } from '@/app/utils';
import { useMemo } from 'react';

/**
 * Computed display data for a receipt list item.
 * @typedef {object} ReceiptDisplayData
 * @property {string} iconName - Icon name for the TransactionAvatar component.
 * @property {string} action - Action/title text for the receipt.
 * @property {string} description - Description text (e.g., block height).
 * @property {string} dateText - Formatted date text.
 */

/**
 * Harvested block receipt data used as input to receipt display utilities.
 * @typedef {object} Receipt
 * @property {string} type - Receipt type from ReceiptType enum.
 * @property {string} amount - Amount value as string.
 * @property {Date|string} timestamp - Timestamp of the receipt.
 * @property {number} height - Block height.
 */

/**
 * Gets the formatted date text for a receipt.
 * @param {Date|string} date - Date value.
 * @param {boolean} isDateHidden - Whether to hide the date.
 * @returns {string} Formatted date or empty string.
 */
const getReceiptDateText = (date, isDateHidden) => {
	if (isDateHidden)
		return '';

	return formatDate(date, $t, true);
};

/**
 * React hook for computing receipt display data used in list items.
 * @param {object} options - Hook options.
 * @param {Receipt} options.receipt - Receipt object containing reward data.
 * @param {boolean} [options.isDateHidden=false] - Whether to hide the date display.
 * @returns {ReceiptDisplayData} Computed display data for the receipt.
 */
export const useReceiptItemData = ({ receipt, isDateHidden = false }) => {
	return useMemo(() => {
		const { type = ReceiptType.HARVESTING_REWARD, timestamp } = receipt;

		const iconName = getReceiptIconName(type);
		const action = getReceiptTypeText(type);
		const description = getReceiptDescription(receipt);
		const dateText = getReceiptDateText(timestamp, isDateHidden);

		return {
			iconName,
			action,
			description,
			dateText
		};
	}, [receipt, isDateHidden]);
};

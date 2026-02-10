import { ReceiptType } from './receipt-icon';
import { $t } from '@/app/localization';

const receiptTypeToTextKeyMap = {
	[ReceiptType.HARVESTING_REWARD]: 'receiptDescriptor_harvestingReward'
};

const DEFAULT_TEXT_KEY = 'receiptDescriptor_unknown';

/**
 * Gets the display text for a receipt based on its type.
 *
 * @param {string} type - Receipt type from ReceiptType enum
 * @returns {string} Localized receipt type text
 */
export const getReceiptTypeText = type => {
	const textKey = receiptTypeToTextKeyMap[type] ?? DEFAULT_TEXT_KEY;
	
	return $t(textKey);
};

/**
 * Gets the description text for a receipt.
 *
 * @param {object} receipt - Receipt object
 * @param {number} receipt.height - Block height of the receipt
 * @returns {string} Description text showing block height
 */
export const getReceiptDescription = receipt => {
	const { height } = receipt;
	
	return `Block #${height}`;
};

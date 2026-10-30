import { ReceiptType } from '@/app/constants';

/**
 * Maps receipt types to their corresponding icon names.
 * @type {Record<string, string>}
 */
const receiptTypeToIconMap = {
	[ReceiptType.HARVESTING_REWARD]: 'reward'
};

const DEFAULT_ICON_TYPE = 'default';

/**
 * Gets the icon name for a receipt based on its type.
 * @param {string} type - Receipt type from ReceiptType enum.
 * @returns {string} Icon name for the TransactionAvatar component.
 */
export const getReceiptIconName = type => receiptTypeToIconMap[type] ?? DEFAULT_ICON_TYPE;

/** @typedef {import('@/app/types/Token').Token} Token */
/** @typedef {import('@/app/utils/account').AccountDisplayData} AccountDisplayData */

/**
 * Amount change type enum.
 * @typedef {'increase' | 'decrease' | 'none'} AmountChangeType
 */

/**
 * Amount change type enum values.
 */
export const AmountChangeType = {
	INCREASE: /** @type {AmountChangeType} */ ('increase'),
	DECREASE: /** @type {AmountChangeType} */ ('decrease'),
	NONE: /** @type {AmountChangeType} */ ('none')
};

/**
 * Amount display size enum.
 * @typedef {'s' | 'm'} AmountDisplaySize
 */

/**
 * Amount display size enum values.
 */
export const AmountDisplaySize = {
	SMALL: /** @type {AmountDisplaySize} */ ('s'),
	MEDIUM: /** @type {AmountDisplaySize} */ ('m')
};

/**
 * Token amount change record for a single token.
 * @typedef {Object} TokenAmountChange
 * @property {string} tokenId - The token identifier.
 * @property {string} amount - The relative amount change (can be positive or negative).
 * @property {number} divisibility - The token divisibility.
 */

/**
 * Account amount breakdown containing all token changes for an account.
 * @typedef {Object} AccountAmountBreakdown
 * @property {Object<string, TokenAmountChange>} tokens - Map of token ID to token amount change.
 */

/**
 * Amount breakdown map - maps account addresses to their token changes.
 * @typedef {Object<string, AccountAmountBreakdown>} AmountBreakdownMap
 */

/**
 * Display data for a single amount in the breakdown.
 * @typedef {Object} AmountDisplayItem
 * @property {string} tokenId - The token identifier.
 * @property {string} amountText - Formatted amount string with sign (e.g., '+100.5', '-50.25').
 * @property {AmountChangeType} type - The type of change (increase or decrease).
 * @property {string} label - Display label (ticker, name, or id).
 * @property {AmountDisplaySize} size - Display size ('m' for native, 's' for custom).
 */

/**
 * Display data for a single account row in the breakdown.
 * @typedef {Object} BreakdownDisplayRow
 * @property {AccountDisplayData} account - Account display data.
 * @property {AmountDisplayItem[]} amounts - List of amount changes for this account.
 */

/**
 * Current account summary display data.
 * @typedef {Object} CurrentAccountSummary
 * @property {string} amountText - Formatted total native token amount with sign.
 * @property {string} label - Token display label.
 * @property {AmountChangeType} type - The type of change.
 */

/**
 * Complete amount breakdown display data structure.
 * @typedef {Object} AmountBreakdownDisplayData
 * @property {CurrentAccountSummary} currentAccount - Summary for the current wallet account.
 * @property {BreakdownDisplayRow[]} breakdown - Detailed breakdown for all involved accounts.
 */

export {};

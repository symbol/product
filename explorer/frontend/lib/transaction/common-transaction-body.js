/** @typedef {import('@/contract/types/Config').TransactionBodyConfig} TransactionBodyConfig */

/**
 * Fallback for an unexpected transaction type.
 * @type {TransactionBodyConfig}
 */
export const UNKNOWN_TRANSACTION_BODY_CONFIG = {
	graphic: { target: null },
	bodyFields: []
};

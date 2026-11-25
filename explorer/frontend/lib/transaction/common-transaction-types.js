import { TRANSACTION_KIND } from '@/app/constants';

/** @typedef {import('@/contract/types/Transaction').TransactionTypeInfo} TransactionTypeInfo */

/**
 * Fallback for an unexpected transaction type.
 * @type {TransactionTypeInfo}
 */
export const UNKNOWN_TRANSACTION_TYPE_INFO = {
	kind: TRANSACTION_KIND.OTHER,
	localeKey: 'transactionType_unknown',
	icon: 'default'
};

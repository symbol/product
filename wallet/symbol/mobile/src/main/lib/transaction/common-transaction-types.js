import { TransactionKind } from '@/app/constants';

/** @typedef {import('@/app/types/Transaction').TransactionTypeInfo} TransactionTypeInfo */

/**
 * Fallback for unexpected transaction type.
 * @type {TransactionTypeInfo}
 */
export const UNKNOWN_TRANSACTION_TYPE_INFO = {
	kind: TransactionKind.OTHER,
	localeKey: 'transactionType_unknown',
	icon: 'default'
};

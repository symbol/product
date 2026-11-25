import { TRANSACTION_KIND } from '@/app/constants';
import { UNKNOWN_TRANSACTION_TYPE_INFO } from '@/app/lib/transaction/common-transaction-types';

/** @typedef {import('@/contract/types/Transaction').TransactionTypeInfo} TransactionTypeInfo */

export const TRANSACTION_TYPE = {
	TRANSFER: 'TRANSFER',
	MOSAIC_DEFINITION: 'MOSAIC_DEFINITION',
	MOSAIC_SUPPLY_CHANGE: 'MOSAIC_SUPPLY_CHANGE',
	NAMESPACE_REGISTRATION: 'NAMESPACE_REGISTRATION',
	MULTISIG_ACCOUNT_MODIFICATION: 'MULTISIG_ACCOUNT_MODIFICATION',
	ACCOUNT_KEY_LINK: 'ACCOUNT_KEY_LINK',
	MULTISIG: 'MULTISIG'
};

/** @type {Record<string, TransactionTypeInfo>} */
const transactionTypeInfos = {
	[TRANSACTION_TYPE.TRANSFER]: {
		kind: TRANSACTION_KIND.TRANSFER,
		localeKey: 'transactionType_transfer',
		icon: 'transfer'
	},
	[TRANSACTION_TYPE.MOSAIC_DEFINITION]: {
		kind: TRANSACTION_KIND.OTHER,
		localeKey: 'transactionType_mosaicDefinition',
		icon: 'mosaic-creation'
	},
	[TRANSACTION_TYPE.MOSAIC_SUPPLY_CHANGE]: {
		kind: TRANSACTION_KIND.OTHER,
		localeKey: 'transactionType_mosaicSupplyChange',
		icon: 'mosaic'
	},
	[TRANSACTION_TYPE.NAMESPACE_REGISTRATION]: {
		kind: TRANSACTION_KIND.OTHER,
		localeKey: 'transactionType_namespaceRegistration',
		icon: 'namespace'
	},
	[TRANSACTION_TYPE.MULTISIG_ACCOUNT_MODIFICATION]: {
		kind: TRANSACTION_KIND.OTHER,
		localeKey: 'transactionType_multisigAccountModification',
		icon: 'account-multisig'
	},
	[TRANSACTION_TYPE.ACCOUNT_KEY_LINK]: {
		kind: TRANSACTION_KIND.OTHER,
		localeKey: 'transactionType_accountKeyLink',
		icon: 'key'
	},
	// The multisig is an aggregate - it holds one inner transaction.
	[TRANSACTION_TYPE.MULTISIG]: {
		kind: TRANSACTION_KIND.AGGREGATE,
		localeKey: 'transactionType_multisig',
		icon: 'aggregate'
	}
};

/**
 * Returns the UI ready info of the transaction type, or the fallback for an unknown type.
 * @param {string} type - Transaction type.
 * @returns {TransactionTypeInfo} Transaction type info.
 */
export const getTransactionTypeInfo = type => transactionTypeInfos[type] ?? UNKNOWN_TRANSACTION_TYPE_INFO;

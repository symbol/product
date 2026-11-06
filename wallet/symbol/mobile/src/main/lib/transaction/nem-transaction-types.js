import { UNKNOWN_TRANSACTION_TYPE_INFO } from './common-transaction-types';
import { TransactionKind } from '@/app/constants';
import { TransactionType } from 'wallet-common-nem/src/constants';

/** @typedef {import('@/app/types/Transaction').TransactionTypeInfo} TransactionTypeInfo */

const nemTransactionTypeInfos = {
	[TransactionType.TRANSFER]: {
		kind: TransactionKind.TRANSFER,
		localeKey: 'transactionType_transfer',
		icon: 'transfer'
	},
	[TransactionType.ACCOUNT_KEY_LINK]: {
		kind: TransactionKind.OTHER,
		localeKey: 'transactionType_importanceTransfer',
		icon: 'key'
	},
	[TransactionType.MULTISIG_ACCOUNT_MODIFICATION]: {
		kind: TransactionKind.OTHER,
		localeKey: 'transactionType_multisigAccountModification',
		icon: 'multisig'
	},
	[TransactionType.MULTISIG_COSIGNATURE]: {
		kind: TransactionKind.OTHER,
		localeKey: 'transactionType_multisigCosignature',
		icon: 'multisig'
	},
	// The multisig is an aggregate - it holds one inner transaction.
	[TransactionType.MULTISIG]: {
		kind: TransactionKind.AGGREGATE,
		localeKey: 'transactionType_multisig',
		icon: 'multisig'
	},
	[TransactionType.NAMESPACE_REGISTRATION]: {
		kind: TransactionKind.OTHER,
		localeKey: 'transactionType_namespaceRegistration',
		icon: 'namespace'
	},
	[TransactionType.MOSAIC_DEFINITION]: {
		kind: TransactionKind.OTHER,
		localeKey: 'transactionType_mosaicDefinition',
		icon: 'token'
	},
	[TransactionType.MOSAIC_SUPPLY_CHANGE]: {
		kind: TransactionKind.OTHER,
		localeKey: 'transactionType_mosaicSupplyChange',
		icon: 'token'
	}
};

/**
 * Returns the resolved UI ready transaction type info.
 * @param {number} type - Raw NEM transaction type value.
 * @returns {TransactionTypeInfo} Resolved UI ready data.
 */
export const getNemTransactionTypeInfo = type => nemTransactionTypeInfos[type] ?? UNKNOWN_TRANSACTION_TYPE_INFO;

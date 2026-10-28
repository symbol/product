import { UNKNOWN_TRANSACTION_TYPE_INFO } from './common-transaction-types';
import { TransactionKind } from '@/app/constants';
import { TransactionType } from 'wallet-common-symbol/src/constants';

/** @typedef {import('@/app/types/Transaction').TransactionTypeInfo} TransactionTypeInfo */

const symbolTransactionTypeInfos = {
	[TransactionType.TRANSFER]: {
		kind: TransactionKind.TRANSFER,
		localeKey: 'transactionType_transfer',
		icon: 'transfer'
	},
	[TransactionType.NAMESPACE_REGISTRATION]: {
		kind: TransactionKind.OTHER,
		localeKey: 'transactionType_namespaceRegistration',
		icon: 'namespace'
	},
	[TransactionType.ADDRESS_ALIAS]: {
		kind: TransactionKind.OTHER,
		localeKey: 'transactionType_addressAlias',
		icon: 'namespace'
	},
	[TransactionType.MOSAIC_ALIAS]: {
		kind: TransactionKind.OTHER,
		localeKey: 'transactionType_mosaicAlias',
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
	},
	[TransactionType.MOSAIC_SUPPLY_REVOCATION]: {
		kind: TransactionKind.OTHER,
		localeKey: 'transactionType_mosaicSupplyRevocation',
		icon: 'token'
	},
	[TransactionType.MULTISIG_ACCOUNT_MODIFICATION]: {
		kind: TransactionKind.OTHER,
		localeKey: 'transactionType_multisigAccountModification',
		icon: 'multisig',
		hasLoseAccessRisk: true
	},
	[TransactionType.AGGREGATE_COMPLETE]: {
		kind: TransactionKind.AGGREGATE,
		localeKey: 'transactionType_aggregateComplete',
		icon: 'aggregate'
	},
	[TransactionType.AGGREGATE_BONDED]: {
		kind: TransactionKind.AGGREGATE,
		localeKey: 'transactionType_aggregateBonded',
		icon: 'aggregate'
	},
	[TransactionType.HASH_LOCK]: {
		kind: TransactionKind.OTHER,
		localeKey: 'transactionType_hashLock',
		icon: 'lock'
	},
	[TransactionType.SECRET_LOCK]: {
		kind: TransactionKind.OTHER,
		localeKey: 'transactionType_secretLock',
		icon: 'lock',
		hasLoseAccessRisk: true
	},
	[TransactionType.SECRET_PROOF]: {
		kind: TransactionKind.OTHER,
		localeKey: 'transactionType_secretProof',
		icon: 'lock'
	},
	[TransactionType.ACCOUNT_ADDRESS_RESTRICTION]: {
		kind: TransactionKind.OTHER,
		localeKey: 'transactionType_accountAddressRestriction',
		icon: 'restriction',
		hasLoseAccessRisk: true
	},
	[TransactionType.ACCOUNT_MOSAIC_RESTRICTION]: {
		kind: TransactionKind.OTHER,
		localeKey: 'transactionType_accountMosaicRestriction',
		icon: 'restriction',
		hasLoseAccessRisk: true
	},
	[TransactionType.ACCOUNT_OPERATION_RESTRICTION]: {
		kind: TransactionKind.OTHER,
		localeKey: 'transactionType_accountOperationRestriction',
		icon: 'restriction',
		hasLoseAccessRisk: true
	},
	[TransactionType.ACCOUNT_KEY_LINK]: {
		kind: TransactionKind.OTHER,
		localeKey: 'transactionType_accountKeyLink',
		icon: 'key'
	},
	[TransactionType.MOSAIC_ADDRESS_RESTRICTION]: {
		kind: TransactionKind.OTHER,
		localeKey: 'transactionType_mosaicAddressRestriction',
		icon: 'restriction'
	},
	[TransactionType.MOSAIC_GLOBAL_RESTRICTION]: {
		kind: TransactionKind.OTHER,
		localeKey: 'transactionType_mosaicGlobalRestriction',
		icon: 'restriction'
	},
	[TransactionType.ACCOUNT_METADATA]: {
		kind: TransactionKind.OTHER,
		localeKey: 'transactionType_accountMetadata',
		icon: 'metadata'
	},
	[TransactionType.MOSAIC_METADATA]: {
		kind: TransactionKind.OTHER,
		localeKey: 'transactionType_mosaicMetadata',
		icon: 'metadata'
	},
	[TransactionType.NAMESPACE_METADATA]: {
		kind: TransactionKind.OTHER,
		localeKey: 'transactionType_namespaceMetadata',
		icon: 'metadata'
	},
	[TransactionType.VRF_KEY_LINK]: {
		kind: TransactionKind.OTHER,
		localeKey: 'transactionType_vrfKeyLink',
		icon: 'key'
	},
	[TransactionType.VOTING_KEY_LINK]: {
		kind: TransactionKind.OTHER,
		localeKey: 'transactionType_votingKeyLink',
		icon: 'key'
	},
	[TransactionType.NODE_KEY_LINK]: {
		kind: TransactionKind.OTHER,
		localeKey: 'transactionType_nodeKeyLink',
		icon: 'key'
	}
};

/**
 * Returns the resolved UI ready transaction type info.
 * @param {number} type - Raw Symbol transaction type value.
 * @returns {TransactionTypeInfo} Resolved UI ready data.
 */
export const getSymbolTransactionTypeInfo = type => symbolTransactionTypeInfos[type] ?? UNKNOWN_TRANSACTION_TYPE_INFO;

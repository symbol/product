import { TRANSACTION_KIND } from '@/app/constants';
import { UNKNOWN_TRANSACTION_TYPE_INFO } from '@/app/lib/transaction/common-transaction-types';

/** @typedef {import('@/contract/types/Transaction').TransactionTypeInfo} TransactionTypeInfo */

export const TRANSACTION_TYPE = {
	TRANSFER: 'TRANSFER',
	NAMESPACE_REGISTRATION: 'NAMESPACE_REGISTRATION',
	ADDRESS_ALIAS: 'ADDRESS_ALIAS',
	MOSAIC_ALIAS: 'MOSAIC_ALIAS',
	MOSAIC_DEFINITION: 'MOSAIC_DEFINITION',
	MOSAIC_SUPPLY_CHANGE: 'MOSAIC_SUPPLY_CHANGE',
	MOSAIC_SUPPLY_REVOCATION: 'MOSAIC_SUPPLY_REVOCATION',
	MULTISIG_ACCOUNT_MODIFICATION: 'MULTISIG_ACCOUNT_MODIFICATION',
	AGGREGATE_COMPLETE: 'AGGREGATE_COMPLETE',
	AGGREGATE_BONDED: 'AGGREGATE_BONDED',
	HASH_LOCK: 'HASH_LOCK',
	SECRET_LOCK: 'SECRET_LOCK',
	SECRET_PROOF: 'SECRET_PROOF',
	ACCOUNT_ADDRESS_RESTRICTION: 'ACCOUNT_ADDRESS_RESTRICTION',
	ACCOUNT_MOSAIC_RESTRICTION: 'ACCOUNT_MOSAIC_RESTRICTION',
	ACCOUNT_OPERATION_RESTRICTION: 'ACCOUNT_OPERATION_RESTRICTION',
	ACCOUNT_KEY_LINK: 'ACCOUNT_KEY_LINK',
	MOSAIC_ADDRESS_RESTRICTION: 'MOSAIC_ADDRESS_RESTRICTION',
	MOSAIC_GLOBAL_RESTRICTION: 'MOSAIC_GLOBAL_RESTRICTION',
	ACCOUNT_METADATA: 'ACCOUNT_METADATA',
	MOSAIC_METADATA: 'MOSAIC_METADATA',
	NAMESPACE_METADATA: 'NAMESPACE_METADATA',
	VRF_KEY_LINK: 'VRF_KEY_LINK',
	VOTING_KEY_LINK: 'VOTING_KEY_LINK',
	NODE_KEY_LINK: 'NODE_KEY_LINK'
};

/** @type {Record<string, TransactionTypeInfo>} */
const transactionTypeInfos = {
	[TRANSACTION_TYPE.TRANSFER]: {
		kind: TRANSACTION_KIND.TRANSFER,
		localeKey: 'transactionType_transfer',
		icon: 'transfer'
	},
	[TRANSACTION_TYPE.NAMESPACE_REGISTRATION]: {
		kind: TRANSACTION_KIND.OTHER,
		localeKey: 'transactionType_namespaceRegistration',
		icon: 'namespace'
	},
	[TRANSACTION_TYPE.ADDRESS_ALIAS]: {
		kind: TRANSACTION_KIND.OTHER,
		localeKey: 'transactionType_addressAlias',
		icon: 'namespace'
	},
	[TRANSACTION_TYPE.MOSAIC_ALIAS]: {
		kind: TRANSACTION_KIND.OTHER,
		localeKey: 'transactionType_mosaicAlias',
		icon: 'namespace'
	},
	[TRANSACTION_TYPE.MOSAIC_DEFINITION]: {
		kind: TRANSACTION_KIND.OTHER,
		localeKey: 'transactionType_mosaicDefinition',
		icon: 'mosaic'
	},
	[TRANSACTION_TYPE.MOSAIC_SUPPLY_CHANGE]: {
		kind: TRANSACTION_KIND.OTHER,
		localeKey: 'transactionType_mosaicSupplyChange',
		icon: 'mosaic'
	},
	[TRANSACTION_TYPE.MOSAIC_SUPPLY_REVOCATION]: {
		kind: TRANSACTION_KIND.OTHER,
		localeKey: 'transactionType_mosaicSupplyRevocation',
		icon: 'revert'
	},
	[TRANSACTION_TYPE.MULTISIG_ACCOUNT_MODIFICATION]: {
		kind: TRANSACTION_KIND.OTHER,
		localeKey: 'transactionType_multisigAccountModification',
		icon: 'multisig'
	},
	[TRANSACTION_TYPE.AGGREGATE_COMPLETE]: {
		kind: TRANSACTION_KIND.AGGREGATE,
		localeKey: 'transactionType_aggregateComplete',
		icon: 'aggregate'
	},
	[TRANSACTION_TYPE.AGGREGATE_BONDED]: {
		kind: TRANSACTION_KIND.AGGREGATE,
		localeKey: 'transactionType_aggregateBonded',
		icon: 'aggregate'
	},
	[TRANSACTION_TYPE.HASH_LOCK]: {
		kind: TRANSACTION_KIND.OTHER,
		localeKey: 'transactionType_hashLock',
		icon: 'lock'
	},
	[TRANSACTION_TYPE.SECRET_LOCK]: {
		kind: TRANSACTION_KIND.OTHER,
		localeKey: 'transactionType_secretLock',
		icon: 'lock'
	},
	[TRANSACTION_TYPE.SECRET_PROOF]: {
		kind: TRANSACTION_KIND.OTHER,
		localeKey: 'transactionType_secretProof',
		icon: 'lock'
	},
	[TRANSACTION_TYPE.ACCOUNT_ADDRESS_RESTRICTION]: {
		kind: TRANSACTION_KIND.OTHER,
		localeKey: 'transactionType_accountAddressRestriction',
		icon: 'restriction'
	},
	[TRANSACTION_TYPE.ACCOUNT_MOSAIC_RESTRICTION]: {
		kind: TRANSACTION_KIND.OTHER,
		localeKey: 'transactionType_accountMosaicRestriction',
		icon: 'restriction'
	},
	[TRANSACTION_TYPE.ACCOUNT_OPERATION_RESTRICTION]: {
		kind: TRANSACTION_KIND.OTHER,
		localeKey: 'transactionType_accountOperationRestriction',
		icon: 'restriction'
	},
	[TRANSACTION_TYPE.ACCOUNT_KEY_LINK]: {
		kind: TRANSACTION_KIND.OTHER,
		localeKey: 'transactionType_accountKeyLink',
		icon: 'key'
	},
	[TRANSACTION_TYPE.MOSAIC_ADDRESS_RESTRICTION]: {
		kind: TRANSACTION_KIND.OTHER,
		localeKey: 'transactionType_mosaicAddressRestriction',
		icon: 'restriction'
	},
	[TRANSACTION_TYPE.MOSAIC_GLOBAL_RESTRICTION]: {
		kind: TRANSACTION_KIND.OTHER,
		localeKey: 'transactionType_mosaicGlobalRestriction',
		icon: 'restriction'
	},
	[TRANSACTION_TYPE.ACCOUNT_METADATA]: {
		kind: TRANSACTION_KIND.OTHER,
		localeKey: 'transactionType_accountMetadata',
		icon: 'metadata'
	},
	[TRANSACTION_TYPE.MOSAIC_METADATA]: {
		kind: TRANSACTION_KIND.OTHER,
		localeKey: 'transactionType_mosaicMetadata',
		icon: 'metadata'
	},
	[TRANSACTION_TYPE.NAMESPACE_METADATA]: {
		kind: TRANSACTION_KIND.OTHER,
		localeKey: 'transactionType_namespaceMetadata',
		icon: 'metadata'
	},
	[TRANSACTION_TYPE.VRF_KEY_LINK]: {
		kind: TRANSACTION_KIND.OTHER,
		localeKey: 'transactionType_vrfKeyLink',
		icon: 'key'
	},
	[TRANSACTION_TYPE.VOTING_KEY_LINK]: {
		kind: TRANSACTION_KIND.OTHER,
		localeKey: 'transactionType_votingKeyLink',
		icon: 'key'
	},
	[TRANSACTION_TYPE.NODE_KEY_LINK]: {
		kind: TRANSACTION_KIND.OTHER,
		localeKey: 'transactionType_nodeKeyLink',
		icon: 'key'
	}
};

/**
 * Returns the UI ready info of the transaction type, or the fallback for an unknown type.
 * @param {string} type - Transaction type.
 * @returns {TransactionTypeInfo} Transaction type info.
 */
export const getTransactionTypeInfo = type => transactionTypeInfos[type] ?? UNKNOWN_TRANSACTION_TYPE_INFO;

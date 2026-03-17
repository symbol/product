import { SymbolTransactionType } from '@/app/constants';

/**
 * Maps transaction types to their corresponding icon names.
 * @type {Record<number, string>}
 */
const transactionTypeToIconMap = {
	[SymbolTransactionType.AGGREGATE_COMPLETE]: 'aggregate',
	[SymbolTransactionType.AGGREGATE_BONDED]: 'aggregate',
	[SymbolTransactionType.TRANSFER]: 'transfer',
	[SymbolTransactionType.NAMESPACE_REGISTRATION]: 'namespace',
	[SymbolTransactionType.ADDRESS_ALIAS]: 'namespace',
	[SymbolTransactionType.MOSAIC_ALIAS]: 'namespace',
	[SymbolTransactionType.MOSAIC_DEFINITION]: 'token',
	[SymbolTransactionType.MOSAIC_SUPPLY_CHANGE]: 'token',
	[SymbolTransactionType.MOSAIC_SUPPLY_REVOCATION]: 'token',
	[SymbolTransactionType.ACCOUNT_MOSAIC_RESTRICTION]: 'restriction',
	[SymbolTransactionType.ACCOUNT_ADDRESS_RESTRICTION]: 'restriction',
	[SymbolTransactionType.ACCOUNT_OPERATION_RESTRICTION]: 'restriction',
	[SymbolTransactionType.MOSAIC_GLOBAL_RESTRICTION]: 'restriction',
	[SymbolTransactionType.MOSAIC_ADDRESS_RESTRICTION]: 'restriction',
	[SymbolTransactionType.VRF_KEY_LINK]: 'key',
	[SymbolTransactionType.NODE_KEY_LINK]: 'key',
	[SymbolTransactionType.VOTING_KEY_LINK]: 'key',
	[SymbolTransactionType.ACCOUNT_KEY_LINK]: 'key',
	[SymbolTransactionType.HASH_LOCK]: 'lock',
	[SymbolTransactionType.SECRET_LOCK]: 'lock',
	[SymbolTransactionType.SECRET_PROOF]: 'lock',
	[SymbolTransactionType.ACCOUNT_METADATA]: 'metadata',
	[SymbolTransactionType.MOSAIC_METADATA]: 'metadata',
	[SymbolTransactionType.NAMESPACE_METADATA]: 'metadata',
	[SymbolTransactionType.MULTISIG_ACCOUNT_MODIFICATION]: 'multisig'
};

/**
 * Gets the icon name for a transaction based on its type.
 * @param {number} type - Transaction type number.
 * @returns {string} Icon name.
 */
export const getTransactionIconName = type => transactionTypeToIconMap[type] ?? 'default';

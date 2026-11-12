import { SYMBOL_TRANSACTION_GROUP, SYMBOL_TRANSACTION_TYPE } from '../constants';
import en from '../locales/en/transaction-types.json';
import isv from '../locales/isv/transaction-types.json';
import ja from '../locales/ja/transaction-types.json';
import { TRANSACTION_TYPE } from '@/app/constants';
import { createAssetURL } from '@/app/utils';

const TRANSACTION_TYPE_LABELS = { en, isv, ja };

// These names already have common labels. Returning undefined for them lets the shared
// components keep their existing translation path while this variant owns the Symbol-only names.
const COMMON_TRANSACTION_TYPES = new Set([
	TRANSACTION_TYPE.TRANSFER,
	TRANSACTION_TYPE.MOSAIC_CREATION,
	TRANSACTION_TYPE.MOSAIC_SUPPLY_CHANGE,
	TRANSACTION_TYPE.NAMESPACE_REGISTRATION,
	TRANSACTION_TYPE.MULTISIG_ACCOUNT_MODIFICATION,
	TRANSACTION_TYPE.ACCOUNT_KEY_LINK
]);

const DEFAULT_TRANSACTION_TYPE_ICON = '/images/icon-transaction.svg';

const TRANSACTION_TYPE_ICON_PATHS = {
	[SYMBOL_TRANSACTION_TYPE.ACCOUNT_ADDRESS_RESTRICTION]: DEFAULT_TRANSACTION_TYPE_ICON,
	[SYMBOL_TRANSACTION_TYPE.ACCOUNT_KEY_LINK]: '/images/transaction/key.svg',
	[SYMBOL_TRANSACTION_TYPE.ACCOUNT_METADATA]: DEFAULT_TRANSACTION_TYPE_ICON,
	[SYMBOL_TRANSACTION_TYPE.ACCOUNT_MOSAIC_RESTRICTION]: DEFAULT_TRANSACTION_TYPE_ICON,
	[SYMBOL_TRANSACTION_TYPE.ACCOUNT_OPERATION_RESTRICTION]: DEFAULT_TRANSACTION_TYPE_ICON,
	[SYMBOL_TRANSACTION_TYPE.ADDRESS_ALIAS]: '/images/transaction/namespace.svg',
	[SYMBOL_TRANSACTION_TYPE.AGGREGATE_BONDED]: '/images/transaction/aggregate.svg',
	[SYMBOL_TRANSACTION_TYPE.AGGREGATE_COMPLETE]: '/images/transaction/aggregate.svg',
	[SYMBOL_TRANSACTION_TYPE.HASH_LOCK]: '/images/transaction/key.svg',
	[SYMBOL_TRANSACTION_TYPE.MOSAIC_ADDRESS_RESTRICTION]: '/images/transaction/mosaic.svg',
	[SYMBOL_TRANSACTION_TYPE.MOSAIC_ALIAS]: '/images/transaction/namespace.svg',
	[SYMBOL_TRANSACTION_TYPE.MOSAIC_DEFINITION]: '/images/transaction/mosaic-creation.svg',
	[SYMBOL_TRANSACTION_TYPE.MOSAIC_GLOBAL_RESTRICTION]: '/images/transaction/mosaic.svg',
	[SYMBOL_TRANSACTION_TYPE.MOSAIC_METADATA]: '/images/transaction/mosaic.svg',
	[SYMBOL_TRANSACTION_TYPE.MOSAIC_SUPPLY_CHANGE]: '/images/transaction/mosaic.svg',
	[SYMBOL_TRANSACTION_TYPE.MOSAIC_SUPPLY_REVOCATION]: '/images/transaction/mosaic.svg',
	[SYMBOL_TRANSACTION_TYPE.MULTISIG_ACCOUNT_MODIFICATION]: '/images/transaction/account-multisig.svg',
	[SYMBOL_TRANSACTION_TYPE.NAMESPACE_METADATA]: '/images/transaction/namespace.svg',
	[SYMBOL_TRANSACTION_TYPE.NAMESPACE_REGISTRATION]: '/images/transaction/namespace.svg',
	[SYMBOL_TRANSACTION_TYPE.NODE_KEY_LINK]: '/images/transaction/key.svg',
	[SYMBOL_TRANSACTION_TYPE.SECRET_LOCK]: '/images/transaction/key.svg',
	[SYMBOL_TRANSACTION_TYPE.SECRET_PROOF]: '/images/transaction/key.svg',
	[SYMBOL_TRANSACTION_TYPE.TRANSFER]: '/images/transaction/transfer.svg',
	[SYMBOL_TRANSACTION_TYPE.VOTING_KEY_LINK]: '/images/transaction/key.svg',
	[SYMBOL_TRANSACTION_TYPE.VRF_KEY_LINK]: '/images/transaction/key.svg'
};

/**
 * Resolves a Symbol transaction name into a label for the active display language.
 * @param {string|number} type - the transaction type returned by Symbol REST.
 * @param {string} [language='en'] - the active i18next language.
 * @returns {string|undefined} the localized label, the original unknown type, or undefined for
 * shared transaction names that are resolved by common translations.
 */
export const getTransactionTypeLabel = (type, language = 'en') => {
	const typeName = String(type);
	if (COMMON_TRANSACTION_TYPES.has(typeName))
		return undefined;

	const locale = String(language).toLowerCase().split(/[-_]/)[0];
	const labels = TRANSACTION_TYPE_LABELS[locale] ?? TRANSACTION_TYPE_LABELS.en;
	return Object.prototype.hasOwnProperty.call(labels, typeName) ? labels[typeName] : typeName;
};

/**
 * Resolves a Symbol transaction name to an existing Symbol transaction icon.
 * @param {string|number} type - the transaction type returned by Symbol REST.
 * @returns {string} a URL for an existing Symbol icon.
 */
export const getTransactionTypeIcon = type => {
	const typeName = String(type);
	const iconPath = Object.prototype.hasOwnProperty.call(TRANSACTION_TYPE_ICON_PATHS, typeName)
		? TRANSACTION_TYPE_ICON_PATHS[typeName]
		: DEFAULT_TRANSACTION_TYPE_ICON;
	return createAssetURL(iconPath);
};

/**
 * Checks whether a transaction is waiting for cosignatures before it can confirm. A Symbol
 * aggregate bonded transaction stays in the partial group until the required cosignatures are
 * collected, then moves to the unconfirmed group.
 * @param {{ type: string, group: string }} transaction - the transaction to evaluate.
 * @returns {boolean} true when the transaction is awaiting cosignatures.
 */
export const isTransactionAwaitingSignatures = transaction => transaction.group === SYMBOL_TRANSACTION_GROUP.PARTIAL;

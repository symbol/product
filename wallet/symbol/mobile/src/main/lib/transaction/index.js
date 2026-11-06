import { omitHiddenBodyFields } from './common-transaction-body-fields';
import { UNKNOWN_TRANSACTION_TYPE_INFO } from './common-transaction-types';
import { getEthereumTransactionTypeInfo } from './ethereum-transaction-types';
import { createNemTransactionBodyFields } from './nem-transaction-body-fields';
import { getNemTransactionDescriptionText } from './nem-transaction-descriptions';
import { createNemTransactionGraphicContent } from './nem-transaction-graphic';
import { getNemTransactionTypeInfo } from './nem-transaction-types';
import { createSymbolTransactionBodyFields } from './symbol-transaction-body-fields';
import { getSymbolTransactionDescriptionText } from './symbol-transaction-descriptions';
import { createSymbolTransactionGraphicContent } from './symbol-transaction-graphic';
import { getSymbolTransactionTypeInfo } from './symbol-transaction-types';

/** @typedef {import('@/app/types/Network').ChainName} ChainName */
/** @typedef {import('@/app/types/Transaction').Transaction} Transaction */
/** @typedef {import('@/app/types/Transaction').TransactionTypeInfo} TransactionTypeInfo */
/** @typedef {import('@/app/types/Transaction').TransactionGraphicContent} TransactionGraphicContent */
/** @typedef {import('@/app/types/Transaction').TransactionGraphicOptions} TransactionGraphicOptions */
/** @typedef {import('@/app/types/Account').WalletAccount} WalletAccount */
/** @typedef {import('@/app/types/Account').AccountResolveOptions} AccountResolveOptions */

/**
 * Display helpers of one chain's transactions, used by shared code instead of raw type code checks.
 * @typedef {object} TransactionDisplayUtils
 * @property {function(number): TransactionTypeInfo} getTypeInfo - Returns the resolved UI ready transaction type info.
 * @property {function(Transaction, WalletAccount, AccountResolveOptions): string} getDescriptionText - Returns description
 * for the transaction.
 * @property {function(Transaction, TransactionGraphicOptions): (TransactionGraphicContent|null)} createGraphicContent - Creates
 * transaction graphic content for the transaction.
 * @property {function(Transaction): object} createBodyFields - Creates body fields for the transaction table.
 */

const defaultTransactionDisplayUtils = {
	getTypeInfo: () => UNKNOWN_TRANSACTION_TYPE_INFO,
	getDescriptionText: () => '',
	createGraphicContent: () => null,
	createBodyFields: omitHiddenBodyFields
};

/** @type {Record<ChainName, TransactionDisplayUtils>} */
const transactionDisplayUtilsByChain = {
	symbol: {
		getTypeInfo: getSymbolTransactionTypeInfo,
		getDescriptionText: getSymbolTransactionDescriptionText,
		createGraphicContent: createSymbolTransactionGraphicContent,
		createBodyFields: createSymbolTransactionBodyFields
	},
	nem: {
		getTypeInfo: getNemTransactionTypeInfo,
		getDescriptionText: getNemTransactionDescriptionText,
		createGraphicContent: createNemTransactionGraphicContent,
		createBodyFields: createNemTransactionBodyFields
	},
	ethereum: {
		...defaultTransactionDisplayUtils,
		getTypeInfo: getEthereumTransactionTypeInfo
	}
};

/**
 * Returns the display helpers for the chain or the fallback if chain is unsupported.
 * @param {ChainName} chainName - Chain the transactions belong to.
 * @returns {TransactionDisplayUtils} Display helpers of the chain.
 */
const getDisplayUtils = chainName =>
	transactionDisplayUtilsByChain[chainName] ?? defaultTransactionDisplayUtils;

/**
 * Returns the resolved UI ready transaction type info for the given chain.
 * @param {number} type - Raw transaction type value of the chain.
 * @param {ChainName} chainName - Chain the type value belongs to.
 * @returns {TransactionTypeInfo} Resolved UI ready data.
 */
export const getTransactionTypeInfo = (type, chainName) =>
	getDisplayUtils(chainName).getTypeInfo(type);

/**
 * Returns description for the given chain's transaction.
 * @param {Transaction} transaction - Transaction object.
 * @param {WalletAccount} currentAccount - Current account.
 * @param {AccountResolveOptions} resolveOptions - Options for resolving account info.
 * @returns {string} Description text string.
 */
export const getTransactionDescriptionText = (transaction, currentAccount, resolveOptions) =>
	getDisplayUtils(resolveOptions.chainName).getDescriptionText(transaction, currentAccount, resolveOptions);

/**
 * Creates transaction graphic content for the given chain's transaction.
 * @param {Transaction} transaction - Transaction object.
 * @param {TransactionGraphicOptions} options - Options for creating the graphic data.
 * @returns {TransactionGraphicContent|null} Graphic content or null for unsupported types.
 */
export const createTransactionGraphicContent = (transaction, options) =>
	getDisplayUtils(options.chainName).createGraphicContent(transaction, options);

/**
 * Creates body fields for the given chain's transaction table.
 * @param {Transaction} transaction - The transaction object.
 * @param {ChainName} chainName - Chain the transaction belongs to.
 * @returns {object} Fields to show in the table.
 */
export const createTransactionBodyFields = (transaction, chainName) =>
	getDisplayUtils(chainName).createBodyFields(transaction);

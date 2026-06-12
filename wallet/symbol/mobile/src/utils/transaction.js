/** @typedef {import('@/app/types/Network').ChainName} ChainName */

/**
 * Builds the localization key for a transaction type descriptor, namespaced by chain.
 * @param {number|string} type - The chain-specific transaction type enum value.
 * @param {ChainName} chainName - The blockchain name (e.g., 'symbol', 'ethereum').
 * @returns {string} Localization key, e.g. 'transactionDescriptor_symbol_16724'.
 */
export const getTransactionTypeTranslationKey = (type, chainName) => `transactionDescriptor_${chainName}_${type}`;

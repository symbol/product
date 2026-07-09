import { MosaicSupplyChangeAction, MosaicSupplyChangeActionMessage } from '@/app/constants';

/** @typedef {import('@/app/types/Network').ChainName} ChainName */

/**
 * Builds the localization key for a transaction type descriptor, namespaced by chain.
 * @param {number|string} type - The chain-specific transaction type enum value.
 * @param {ChainName} chainName - The blockchain name (e.g., 'symbol', 'ethereum').
 * @returns {string} Localization key, e.g. 'transactionDescriptor_symbol_16724'.
 */
export const getTransactionTypeTranslationKey = (type, chainName) => `transactionDescriptor_${chainName}_${type}`;

/**
 * Computes the signed supply delta for a mosaic supply change transaction.
 * @param {object} transaction - The mosaic supply change transaction.
 * @param {string} transaction.action - Supply change action ('Increase' or 'Decrease').
 * @param {number} transaction.delta - Unsigned supply change magnitude.
 * @returns {number} Signed supply delta (negative for a decrease).
 */
export const getSignedSupplyDelta = ({ action, delta }) => {
	const isDecrease = action === MosaicSupplyChangeActionMessage[MosaicSupplyChangeAction.Decrease];

	return isDecrease ? -delta : delta;
};

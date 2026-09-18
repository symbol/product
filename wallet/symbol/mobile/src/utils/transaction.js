import { MosaicSupplyChangeAction, MosaicSupplyChangeActionMessage } from '@/app/constants';

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

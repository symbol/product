import { constants } from 'wallet-common-symbol';

export const { HarvestingStatus } = constants;

/** @typedef {import('wallet-common-symbol').HarvestingStatus} HarvestingStatus */

/**
 * Harvesting action types.
 * @enum {string}
 */
export const HarvestingAction = {
	START: 'start',
	STOP: 'stop'
};

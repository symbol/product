/** @typedef {import('@/app/screens/mosaic/types/Mosaic').MosaicFlags} MosaicFlags */
/** @typedef {import('@/app/types/Transaction').TransactionFeeTierLevel} TransactionFeeTierLevel */

/** @type {TransactionFeeTierLevel} */
export const DEFAULT_TRANSACTION_SPEED = 'medium';

/** @type {MosaicFlags} */
export const DEFAULT_MOSAIC_FLAGS = {
	isSupplyMutable: true,
	isTransferable: true,
	isRestrictable: false,
	isRevokable: false
};

export const DEFAULT_MOSAIC_DIVISIBILITY = '0';
export const DEFAULT_MOSAIC_SUPPLY = '';
export const DEFAULT_MOSAIC_DURATION = '';
export const DEFAULT_MOSAIC_IS_NEVER_EXPIRING = true;

// The duration value the network treats as a non-expiring mosaic.
export const MOSAIC_NEVER_EXPIRING_DURATION = 0;

export const MOSAIC_DIVISIBILITY_MIN = 0;
export const MOSAIC_DIVISIBILITY_MAX = 6;
export const MOSAIC_SUPPLY_MIN = 1;
export const MOSAIC_SUPPLY_MAX = 9999999999;
export const MOSAIC_DURATION_MIN = 1;
// 3650 days (the network mosaic duration limit) of 30 second blocks.
export const MOSAIC_DURATION_MAX = 10512000;

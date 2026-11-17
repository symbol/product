/** @typedef {import('@/app/screens/mosaic/types/Mosaic').MosaicFlags} MosaicFlags */
/** @typedef {import('@/app/types/Transaction').TransactionFeeTierLevel} TransactionFeeTierLevel */

/** @type {TransactionFeeTierLevel} */
export const DEFAULT_TRANSACTION_SPEED = 'medium';

/** @type {MosaicFlags} */
export const DEFAULT_MOSAIC_FLAGS = {
	isTransferable: true,
	isSupplyMutable: false,
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

// The network caps a mosaic supply in absolute (atomic) units, independent of divisibility.
export const MOSAIC_MAX_ATOMIC_UNITS = '8999999999000000';
export const MOSAIC_MIN_ATOMIC_UNITS = '1';

export const MOSAIC_DURATION_MIN = 1;
export const MOSAIC_DURATION_MAX = 10512000;

export const SECONDS_PER_MINUTE = 60;
export const SECONDS_PER_HOUR = 3600;
export const SECONDS_PER_DAY = 86400;
export const SECONDS_PER_YEAR = 365 * SECONDS_PER_DAY;
export const SECONDS_PER_MONTH = SECONDS_PER_YEAR / 12;

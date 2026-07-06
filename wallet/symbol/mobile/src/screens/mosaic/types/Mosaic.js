/**
 * Mosaic feature flags configuration.
 * @typedef {object} MosaicFlags
 * @property {boolean} isSupplyMutable - Whether the supply can be changed after creation.
 * @property {boolean} isTransferable - Whether the mosaic can be transferred between arbitrary accounts.
 * @property {boolean} isRestrictable - Whether the mosaic supports custom restrictions.
 * @property {boolean} isRevokable - Whether the creator can revoke the mosaic from holders.
 */

/**
 * A mosaic flag name. One of the MosaicFlags properties.
 * @typedef {'isSupplyMutable' | 'isTransferable' | 'isRestrictable' | 'isRevokable'} MosaicFlagName
 */

/**
 * A human duration unit used by the duration builder.
 * @typedef {object} DurationUnit
 * @property {string} key - The unique unit key (plural, lowercase).
 * @property {string} labelKey - The localization key for the unit label shown on selector controls.
 * @property {string} amountKey - The localization key for the pluralized unit amount (e.g. "1 minute", "6 months").
 * @property {number} seconds - The unit length in seconds.
 */

/**
 * Display segments of the supply amount preview.
 * @typedef {object} SupplyDisplayData
 * @property {string} integer - The thousand-grouped integer part.
 * @property {string} enteredFraction - The entered fractional digits, truncated to the divisibility.
 * @property {string} paddingFraction - The zero padding filling the remaining decimal capacity.
 */

export {};

/** @typedef {import('@/app/types/Network').ChainName} ChainName */

/**
 * Route parameters for the RevokeMosaic screen.
 * @typedef {object} RevokeMosaicRouteParams
 * @property {ChainName} [chainName] - The blockchain name.
 * @property {string} tokenId - The mosaic identifier to revoke.
 * @property {string} [senderAddress] - Pre-selected creator (signer) address.
 * @property {string} [sourceAddress] - Pre-filled holder address to revoke the mosaic from.
 * @property {string} [amount] - Pre-filled amount to revoke.
 */

/**
 * Route parameters for the ModifyMosaic screen.
 * @typedef {object} ModifyMosaicRouteParams
 * @property {ChainName} [chainName] - The blockchain name.
 * @property {string} tokenId - The mosaic identifier to modify.
 * @property {string} [senderAddress] - Pre-selected creator (signer) address.
 */

/**
 * The change between a mosaic's current and requested total supply.
 * @typedef {object} SupplyDeltaData
 * @property {string} delta - The change magnitude in relative units, always unsigned. Zero when the
 *   requested supply equals the current one.
 * @property {number|null} action - The supply change action, or null when the supply is unchanged.
 */

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
 * @property {number} maxCount - The largest whole count offered for this unit.
 */

/**
 * Display segments of the supply amount preview.
 * @typedef {object} SupplyDisplayData
 * @property {string} integer - The thousand-grouped integer part.
 * @property {string} enteredFraction - The entered fractional digits, truncated to the divisibility.
 * @property {string} paddingFraction - The zero padding filling the remaining decimal capacity.
 */

export {};

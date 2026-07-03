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

export {};

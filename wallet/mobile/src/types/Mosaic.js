/**
 * @typedef {Object} RawMosaic
 * @property {string} id - The mosaic id.
 * @property {string} name - The mosaic name.
 * @property {number} amount - The mosaic amount.
 */

/**
 * @typedef {Object} MosaicInfo
 * @property {string} id - Mosaic id.
 * @property {string} name - Mosaic linked namespace name or id.
 * @property {string[]} names - Mosaic linked namespace name list.
 * @property {number} divisibility - Mosaic divisibility.
 * @property {number} duration - Mosaic duration in blocks.
 * @property {number} startHeight - Mosaic registration height.
 * @property {number} endHeight - Mosaic expiration height.
 * @property {boolean} isUnlimitedDuration - Mosaic unlimited duration flag.
 * @property {string} creator - Mosaic creator address.
 * @property {number} supply - Mosaic total supply.
 * @property {boolean} isSupplyMutable - Mosaic supply mutable flag.
 * @property {boolean} isTransferable - Mosaic transferable flag.
 * @property {boolean} isRestrictable - Mosaic restrictable flag.
 * @property {boolean} isRevokable - Mosaic revokable flag.
 */

/**
 * @typedef {RawMosaic & MosaicInfo} Mosaic
 */

export default {};

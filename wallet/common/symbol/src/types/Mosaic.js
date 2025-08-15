/**
 * @typedef {Object} MosaicDTO
 * @property {string} id - The mosaic id.
 * @property {string} name - The mosaic name.
 * @property {number} amount - The mosaic amount.
 */

/**
 * @typedef {Object} RawMosaic
 * @property {string} id - The mosaic id.
 * @property {string} name - The mosaic id is used as the name.
 * @property {null} amount - The mosaic relative amount is unavailable in raw data.
 * @property {number} absoluteAmount - The mosaic absolute amount.
 */

/**
 * @typedef {Object} BaseMosaic
 * @property {string} id - The mosaic id.
 * @property {string} name - Mosaic linked namespace name or id.
 * @property {number} amount - The mosaic relative amount.
 * @property {number} divisibility - Mosaic divisibility.
 */

/**
 * @typedef {Object} MosaicInfo
 * @property {string} id - Mosaic id.
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
 * @typedef {MosaicInfo} Mosaic
 * @property {number} amount - The mosaic relative amount.
 * @property {string} name - Mosaic linked namespace name or id.
 */

export default {};

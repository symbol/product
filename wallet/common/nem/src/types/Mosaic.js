/**
 * @typedef {object} MosaicInfo
 * @property {string} id - Mosaic ID string in 'namespace.name' format (e.g. 'nem.xem').
 * @property {string} name - Mosaic display name (defaults to the mosaic id).
 * @property {number} divisibility - Mosaic divisibility.
 * @property {number} [supply] - Total initial supply in whole mosaic units. Used for mosaic fee calculation.
 * @property {boolean} [isSupplyMutable] - Mosaic supply mutable flag.
 * @property {boolean} [isTransferable] - Mosaic transferable flag.
 */

/**
 * @typedef {MosaicInfo} Mosaic
 * @property {string} amount - The mosaic relative amount.
 * @property {string} name - Mosaic display name (defaults to the mosaic id).
 */

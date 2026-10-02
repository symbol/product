/**
 * @typedef {Object} MosaicDTO
 * @property {string} id - The mosaic id.
 * @property {string} amount - The mosaic amount.
 */

/**
 * @typedef {Object} RawToken
 * @property {string} id - The token id.
 * @property {string} name - The token id is used as the name.
 * @property {null} amount - The token relative amount is unavailable in raw data.
 * @property {string} absoluteAmount - The token absolute amount.
 */

/**
 * @typedef {Object} TokenInfo
 * @property {string} id - Token id.
 * @property {string[]} names - Token linked namespace name list.
 * @property {number} divisibility - Token divisibility.
 * @property {number} duration - Token duration in blocks.
 * @property {number} startHeight - Token registration height.
 * @property {number} endHeight - Token expiration height.
 * @property {boolean} isUnlimitedDuration - Token unlimited duration flag.
 * @property {string} creator - Token creator address.
 * @property {string} supply - Token total supply in relative units.
 * @property {boolean} isSupplyMutable - Token supply mutable flag.
 * @property {boolean} isTransferable - Token transferable flag.
 * @property {boolean} isRestrictable - Token restrictable flag.
 * @property {boolean} isRevokable - Token revokable flag.
 */

/**
 * @typedef {TokenInfo} Token
 * @property {string} amount - The token relative amount.
 */

/**
 * @typedef {Object} TokenOwner
 * @property {string} address - The holder account address.
 * @property {string} amount - The held amount in relative units.
 */

export default {};

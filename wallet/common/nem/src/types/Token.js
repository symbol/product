/**
 * @typedef {object} TokenInfo
 * @property {string} id - Token ID string in 'namespace.name' format (e.g. 'nem.xem').
 * @property {string} name - Token display name. In NEM the token id doubles as the name.
 * @property {number} divisibility - Token divisibility.
 * @property {number} [supply] - Total initial supply in whole token units. Used for token fee calculation.
 * @property {boolean} [isSupplyMutable] - Token supply mutable flag.
 * @property {boolean} [isTransferable] - Token transferable flag.
 */

/**
 * @typedef {TokenInfo} Token
 * @property {string} amount - The token relative amount.
 */

/**
 * @typedef {object} RawToken
 * @property {string} id - The token id.
 * @property {string} name - The token id is used as the name.
 * @property {null} amount - The token relative amount is unavailable in raw data.
 * @property {number} absoluteAmount - The token absolute amount.
 * @property {null} divisibility - The token divisibility is unavailable in raw data.
 */

export default {};

/**
 * @typedef {object} TokenInfo
 * @property {string} id - Token ID string in 'namespace.name' format (e.g. 'nem.xem').
 * @property {string} name - Token name; equals the id.
 * @property {number} divisibility - Token divisibility.
 * @property {string} [creator] - Token creator address.
 * @property {number} [supply] - Total supply in whole token units. Used for token fee calculation.
 * @property {boolean} [isSupplyMutable] - Token supply mutable flag.
 * @property {boolean} [isTransferable] - Token transferable flag.
 */

/**
 * @typedef {TokenInfo} Token
 * @property {string} amount - The token relative amount.
 */

/**
 * Raw token with raw absolute amount.
 * @typedef {import('wallet-common-core/src/types/Token').RawToken} RawToken
 */

export default {};

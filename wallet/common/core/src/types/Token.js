/**
 * @typedef {Object} Token
 * @property {string} id - token id or contract address.
 * @property {string|null} name - resolved human-readable token name, or null when the token has none.
 * @property {string} amount - token relative amount.
 * @property {number} divisibility - token divisibility.
 */

/**
 * @typedef {Object} TokenInfo
 * @property {string} id - token id or contract address.
 * @property {string|null} name - resolved human-readable token name, or null when the token has none.
 * @property {number} divisibility - token divisibility.
 */

/**
 * @typedef {Object} RawToken
 * @property {string} id - token id or contract address.
 * @property {string|null} [name] - resolved token name, when available.
 * @property {null} amount - amount is unknown for a raw token.
 * @property {string} absoluteAmount - token absolute amount.
 */

export default {};

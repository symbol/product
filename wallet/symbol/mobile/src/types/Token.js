/** @typedef {import('wallet-common-core/src/types/Token').TokenInfo} TokenInfo */
/** @typedef {import('wallet-common-core/src/types/Token').Token} BaseToken */
/** @typedef {import('wallet-common-symbol/src/types/Mosaic').Mosaic} Mosaic */
/** @typedef {BaseToken | Mosaic} Token */

/**
 * Expiration inputs for a token's expiration progress display.
 * @typedef {object} TokenExpiration
 * @property {number} startHeight - Block height when the token was created.
 * @property {number} endHeight - Block height when the token expires.
 * @property {number} chainHeight - Current chain height.
 * @property {number} blockGenerationTargetTime - Average block generation time in seconds.
 */

/**
 * Resolved display data for a token: the known-token identity merged with the token's own
 * identifier and amount.
 * @typedef {object} TokenDisplayData
 * @property {string} tokenId - Actual token id (a token contract address).
 * @property {string} name - Actual token name. Got from the token object or known token config.
 * @property {string|null} ticker - Actual token ticker. Got from the token object or known token config. Null when unknown.
 * @property {string} nameText - Formatted name text that should be used as a full token name. 
 * Constructed from known name + optional ticker. Fallback to token name or token id.
 * @property {string} tickerText - Text that should be used as a token ticker.
 * Not always a ticker - uses known ticker or token ticker when available, or fallback to name or id.
 * @property {string|null} imageId - The known token image identifier, or null when unknown.
 * @property {string|null} amount - The token amount.
 */

export {};

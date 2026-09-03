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
 * @property {string} tokenId - The token identifier.
 * @property {string} amount - The token amount, passed through from the input token.
 * @property {string} name - The resolved display name (known name, token name, or the token id).
 * @property {string|null} ticker - The resolved ticker, or null when unknown.
 * @property {string|null} imageId - The known token image identifier, or null when unknown.
 */

export {};

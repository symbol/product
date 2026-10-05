/**
 * @typedef {Object} MosaicDTO
 * @property {string} id - The mosaic id.
 * @property {string} amount - The mosaic amount.
 */

/**
 * Raw token with raw absolute amount.
 * @typedef {import('wallet-common-core/src/types/Token').RawToken} RawToken
 */

/**
 * @typedef {Object} TokenInfo
 * @property {string} id - Token id.
 * @property {string|null} name - The first linked namespace name, or null when the token has no name.
 * @property {string[]} names - Namespace names linked to the token.
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

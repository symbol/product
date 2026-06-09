/** @typedef {import('@/app/types/Network').ChainName} ChainName */
/** @typedef {import('@/app/types/ColorVariants').SemanticRoleColorVariants} SemanticRoleColorVariants */
/** @typedef {import('@/app/types/Token').Token} Token */

/**
 * Token display information resolved from known tokens registry.
 * @typedef {object} ResolvedTokenData
 * @property {string} name - Display name with optional ticker suffix.
 * @property {string} [ticker] - Token ticker symbol.
 * @property {string} [imageId] - Token avatar image identifier.
 */

/**
 * Token expiration status data.
 * @typedef {object} TokenExpirationDisplayData
 * @property {boolean} isTokenExpired - Whether the token has expired.
 * @property {boolean} isExpirationSectionShown - Whether to show expiration section.
 * @property {boolean} isAlertVisible - Whether to show expiration alert.
 * @property {SemanticRoleColorVariants} alertVariant - Alert color variant.
 * @property {string} alertText - Alert message text.
 */

/**
 * Assets list section.
 * @typedef {object} AssetSection
 * @property {string} title - Section title (address).
 * @property {ChainName} chainName - Chain name identifier.
 * @property {string} address - Account address.
 * @property {Token[]} data - Array of tokens in this section.
 */

export {};

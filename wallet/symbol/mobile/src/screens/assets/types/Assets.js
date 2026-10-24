/** @typedef {import('@/app/types/Network').ChainName} ChainName */
/** @typedef {import('@/app/types/Network').NetworkIdentifier} NetworkIdentifier */
/** @typedef {import('@/app/types/Network').NetworkProperties} NetworkProperties */
/** @typedef {import('@/app/types/Account').WalletAccount} WalletAccount */
/** @typedef {import('@/app/types/ColorVariants').SemanticRoleColorVariants} SemanticRoleColorVariants */
/** @typedef {import('@/app/types/Token').Token} Token */
/** @typedef {import('react')} React */

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
 * @property {NetworkIdentifier} networkIdentifier - Network identifier.
 * @property {string} address - Account address.
 * @property {Token[]} data - Array of tokens in this section.
 */

/**
 * Props that TokenDetails passes to action item component.
 * @typedef {object} TokenDetailsActionProps
 * @property {Token} token - Token shown on the screen.
 * @property {ChainName} chainName - Chain token belongs to.
 * @property {string} tokenOwnerAccountAddress - Address of the account that holds the token.
 * @property {WalletAccount} currentAccount - Current account of the token chain.
 * Might be different from the token owner for which we show balance.
 * @property {NetworkProperties} networkProperties - Network properties of the token chain.
 */

/**
 * Action sections displayed at the bottom of TokenDetails.
 * @typedef {object} TokenDetailsActionItem
 * @property {string} id - Unique key in the list.
 * @property {function(TokenDetailsActionProps): React.ReactNode} Component - Action block component.
 */

/**
 * TokenDetails screen config.
 * @typedef {object} TokenDetailsScreenConfig
 * @property {Record<string, TokenDetailsActionItem[]>} actionsByChain - Action blocks per token chain name, in display order.
 */

export {};

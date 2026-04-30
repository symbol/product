/** @typedef {import('@/app/types/Wallet').WalletController} WalletController */
/** @typedef {import('@/app/types/Account').WalletAccount} WalletAccount */
/** @typedef {import('@/app/types/Token').Token} Token */
/** @typedef {import('@/app/types/Token').TokenInfo} TokenInfo */
/** @typedef {import('@/app/types/Network').NetworkIdentifier} NetworkIdentifier */
/** @typedef {import('@/app/types/Network').ChainName} ChainName */
/** @typedef {import('wallet-common-core/src/lib/bridge/BridgeManager').BridgeManager} BridgeManager */
/** @typedef {import('wallet-common-core/src/types/Bridge').BridgeEstimation} BridgeEstimation */
/** @typedef {import('wallet-common-core/src/types/Bridge').BridgeRequest} BridgeRequest */
/** @typedef {import('@/app/types/ColorVariants').SemanticRoleColorVariants} SemanticRoleColorVariants */

/**
 * Bridge operation mode.
 * @typedef {'wrap' | 'unwrap'} BridgeModeType
 */

/**
 * Token with balance information for swap operations.
 * @typedef {object} SwapToken
 * @property {string} id - Token identifier.
 * @property {string} name - Token name.
 * @property {string} amount - Token balance amount in relative units.
 */

/**
 * Represents one side of a swap operation (source or target).
 * @typedef {object} SwapSide
 * @property {SwapToken} token - The token being swapped with balance.
 * @property {ChainName} chainName - The name of the blockchain network (e.g., 'symbol').
 * @property {NetworkIdentifier} networkIdentifier - The identifier for the network (e.g., 'mainnet').
 * @property {WalletController} walletController - The wallet controller associated with this swap side.
 */

/**
 * Represents a pair of swappable tokens from different chains.
 * @typedef {object} SwapPair
 * @property {SwapSide} source - The source swap side.
 * @property {SwapSide} target - The target swap side.
 * @property {BridgeManager} bridge - The bridge manager for this swap pair.
 * @property {BridgeModeType} mode - The bridge operation mode (wrap or unwrap).
 */

/**
 * Account information for bridge operations.
 * @typedef {object} BridgeAccountDisplayData
 * @property {ChainName} chainName - The blockchain name.
 * @property {string} ticker - The native currency ticker symbol.
 * @property {boolean} isActive - Whether the account is active.
 * @property {WalletAccount|null} account - The account object or null if not active.
 * @property {number} balance - The account balance.
 * @property {Token[]} tokens - The account token balances.
 * @property {boolean} isAccountInfoLoaded - Whether account info has been fetched.
 */

/**
 * Account data for swap side details display.
 * @typedef {object} ResolvedAccountData
 * @property {string} address - The account address.
 * @property {string|null} name - The account name.
 * @property {string|null} imageId - The account avatar image identifier.
 */

/**
 * Token data for swap side details display.
 * @typedef {object} ResolvedTokenData
 * @property {string} name - The token name.
 * @property {string|null} ticker - The token ticker symbol.
 * @property {string|null} imageId - The token image identifier.
 * @property {string|null} amount - The token amount.
 */

/**
 * Formatted data for displaying swap source or target details.
 * @typedef {object} SwapSideDisplayData
 * @property {ChainName} chainName - The blockchain name.
 * @property {NetworkIdentifier} networkIdentifier - The network identifier.
 * @property {ResolvedTokenData} token - Token information.
 * @property {ResolvedAccountData|null} account - Account information.
 * @property {string|null} transactionHash - The transaction hash.
 */

/**
 * Swap status display information.
 * @typedef {object} SwapStatusDisplayData
 * @property {SemanticRoleColorVariants} variant - Status color variant (e.g., 'warning', 'success', 'danger').
 * @property {string} iconName - Status icon name.
 * @property {string} text - Status text label.
 */

/**
 * Swap status caption display information.
 * @typedef {object} SwapStatusCaptionDisplayData
 * @property {boolean} isVisible - Whether the caption should be visible.
 * @property {string|null} text - Caption text.
 * @property {string|null} textStyle - Text style identifier.
 * @property {string|null} textType - Text type identifier.
 */

/**
 * Bridge pairs loading status.
 * @typedef {'not_configured' | 'loading' | 'ok' | 'no_pairs' | 'error'} BridgePairsStatusType
 */

/**
 * Bridge request confirmation status.
 * @typedef {'unconfirmed' | 'confirmed' | 'error'} BridgeRequestStatusType
 */

/**
 * Bridge payout processing status.
 * @typedef {0 | 1 | 2 | 3} BridgePayoutStatusType
 */

/**
 * Swap side type identifier.
 * @typedef {'source' | 'target'} SwapSideTypeValue
 */

/** Bridge operation mode constants. */
export const BridgeMode = {
	WRAP: /** @type {BridgeModeType} */ ('wrap'),
	UNWRAP: /** @type {BridgeModeType} */ ('unwrap')
};

/** Bridge pairs loading status constants. */
export const BridgePairsStatus = {
	NOT_CONFIGURED: /** @type {BridgePairsStatusType} */ ('not_configured'),
	LOADING: /** @type {BridgePairsStatusType} */ ('loading'),
	OK: /** @type {BridgePairsStatusType} */ ('ok'),
	NO_PAIRS: /** @type {BridgePairsStatusType} */ ('no_pairs'),
	ERROR: /** @type {BridgePairsStatusType} */ ('error')
};

/** Bridge request confirmation status constants. */
export const BridgeRequestStatus = {
	UNCONFIRMED: /** @type {BridgeRequestStatusType} */ ('unconfirmed'),
	CONFIRMED: /** @type {BridgeRequestStatusType} */ ('confirmed'),
	ERROR: /** @type {BridgeRequestStatusType} */ ('error')
};

/** Bridge payout processing status constants. */
export const BridgePayoutStatus = {
	UNPROCESSED: /** @type {BridgePayoutStatusType} */ (0),
	SENT: /** @type {BridgePayoutStatusType} */ (1),
	COMPLETED: /** @type {BridgePayoutStatusType} */ (2),
	FAILED: /** @type {BridgePayoutStatusType} */ (3)
};

/** Swap side type constants. */
export const SwapSideType = {
	SOURCE: /** @type {SwapSideTypeValue} */ ('source'),
	TARGET: /** @type {SwapSideTypeValue} */ ('target')
};

export {};

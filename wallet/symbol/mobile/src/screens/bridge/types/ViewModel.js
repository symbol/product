/** @typedef {import('@/app/screens/bridge/types/Bridge').BridgeError} BridgeError */
/** @typedef {import('@/app/screens/bridge/types/Bridge').BridgeRequest} BridgeRequest */
/** @typedef {import('@/app/screens/bridge/types/Bridge').PriceImpactSeverityValue} PriceImpactSeverityValue */
/** @typedef {import('@/app/screens/bridge/types/Bridge').SwapSide} SwapSide */
/** @typedef {import('@/app/types/Account').WalletAccount} WalletAccount */
/** @typedef {import('@/app/types/ActivityLog').ActivityLogItem} ActivityLogItem */
/** @typedef {import('@/app/types/ColorVariants').SemanticRoleColorVariants} SemanticRoleColorVariants */
/** @typedef {import('@/app/types/Network').ChainName} ChainName */
/** @typedef {import('@/app/types/Network').NetworkIdentifier} NetworkIdentifier */
/** @typedef {import('@/app/types/Token').Token} Token */

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
 * One line of the estimation summary card.
 * @typedef {object} EstimationSummaryRow
 * @property {string} title - Localized row title; kept on continuation rows for the accessibility label.
 * @property {string} value - Ready text, for example '0.000655 ETH', '6.00% · High', 'Unknown' or '-'.
 * @property {boolean} isContinuation - Whether the row continues the row above (connector instead of the title).
 * @property {PriceImpactSeverityValue|null} severity - Severity of the price impact row; null on every other row.
 */

/**
 * View model of the estimation summary card.
 * @typedef {object} EstimationSummaryViewModel
 * @property {string} key - Changes with the selected pair; the card replays its fade-in on it.
 * @property {EstimationSummaryRow[]} rows - Rows in display order.
 */

/**
 * One selectable side of the swap selector, ready to render.
 * @typedef {object} SwapSideOption
 * @property {string} key - `${chainName}|${tokenId}`; the dropdown value.
 * @property {string} label - Token name with its ticker, for example 'Symbol • XYM'.
 * @property {string|null} imageId - Token avatar image identifier.
 * @property {ChainName} chainName - Chain shown next to the label.
 * @property {string} amount - Balance in relative units.
 * @property {SwapSide} side - Domain value handed back by the change callbacks.
 */

/**
 * View model of the swap selector.
 * @typedef {object} SwapSelectorViewModel
 * @property {SwapSideOption|null} source - Selected source option; null while nothing is selected.
 * @property {SwapSideOption|null} target - Selected target option; null while nothing is selected.
 * @property {SwapSideOption[]} sourceOptions - Selectable source options.
 * @property {SwapSideOption[]} targetOptions - Selectable target options.
 */

/**
 * One row of the swap history list, ready to render.
 * @typedef {object} SwapHistoryItem
 * @property {string} key - Request transaction hash.
 * @property {string} actionText - Localized action label.
 * @property {string} dateText - Formatted request date.
 * @property {{ chainName: ChainName, imageId: string|null }} source - Source chain and its token avatar.
 * @property {{ chainName: ChainName, imageId: string|null }} target - Target chain and its token avatar.
 * @property {SwapStatusDisplayData|null} status - Payout status; null while the payout status is unknown.
 * @property {{ value: string, ticker: string }|null} amount - Payout amount; null before a payout exists.
 * @property {SwapStatusCaptionDisplayData} caption - Caption under the row.
 * @property {boolean} isPending - Request confirmed, payout not processed yet; the row is highlighted.
 * @property {BridgeRequest|BridgeError} request - Domain item, handed back on press.
 */

/**
 * View model of the swap history list.
 * @typedef {object} SwapHistoryViewModel
 * @property {SwapHistoryItem[]} items - Rows in list order.
 * @property {string} pageSizeText - Note under the list when the page is full; empty otherwise.
 */

/**
 * View model of the swap details screen.
 * @typedef {object} SwapDetailsViewModel
 * @property {SwapStatusDisplayData} status - Overall swap status.
 * @property {SwapSideDisplayData} source - Source side.
 * @property {SwapSideDisplayData} target - Target side.
 * @property {ActivityLogItem[]} activityLog - Step-by-step progress.
 */

export {};

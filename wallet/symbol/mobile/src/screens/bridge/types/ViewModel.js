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
 * Bridge account display data.
 * @typedef {object} BridgeAccountDisplayData
 * @property {ChainName} chainName - Blockchain name.
 * @property {string} ticker - Native currency ticker symbol.
 * @property {boolean} isActive - Whether the account is active.
 * @property {WalletAccount|null} account - Account, or null when inactive.
 * @property {number} balance - Account balance.
 * @property {Token[]} tokens - Account token balances.
 * @property {boolean} isAccountInfoLoaded - Whether account info has been fetched.
 */

/**
 * Account display data.
 * @typedef {object} ResolvedAccountData
 * @property {string} address - Account address.
 * @property {string|null} name - Account name.
 * @property {string|null} imageId - Account avatar image identifier.
 */

/**
 * Token display data.
 * @typedef {object} ResolvedTokenData
 * @property {string} name - Token name.
 * @property {string|null} ticker - Token ticker symbol.
 * @property {string|null} imageId - Token image identifier.
 * @property {string|null} amount - Token amount.
 */

/**
 * Swap side display data.
 * @typedef {object} SwapSideDisplayData
 * @property {ChainName} chainName - Blockchain name.
 * @property {NetworkIdentifier} networkIdentifier - Network identifier.
 * @property {ResolvedTokenData} token - Token data.
 * @property {ResolvedAccountData|null} account - Account data.
 * @property {string|null} transactionHash - Transaction hash.
 */

/**
 * Swap status display data.
 * @typedef {object} SwapStatusDisplayData
 * @property {SemanticRoleColorVariants} variant - Status color variant (e.g., 'warning', 'success', 'danger').
 * @property {string} iconName - Status icon name.
 * @property {string} text - Status text label.
 */

/**
 * Swap request caption display data.
 * @typedef {object} SwapRequestCaptionDisplayData
 * @property {boolean} isVisible - Whether the caption should be visible.
 * @property {string|null} text - Caption text.
 * @property {string|null} textStyle - Text style identifier.
 * @property {string|null} textType - Text type identifier.
 */

/**
 * Row of the estimation summary card.
 * @typedef {object} EstimationSummaryRow
 * @property {string} title - Localized row title; kept on continuation rows for the accessibility label.
 * @property {string} value - Ready text, for example '0.000655 ETH', '6.00% · High', 'Unknown' or '-'.
 * @property {boolean} isContinuation - Whether the row continues the row above (connector instead of the title).
 * @property {PriceImpactSeverityValue|null} severity - Severity of the price impact row; null on every other row.
 */

/**
 * Estimation summary card view model.
 * @typedef {object} EstimationSummaryViewModel
 * @property {string} key - Changes with the selected pair; the card replays its fade-in on it.
 * @property {EstimationSummaryRow[]} rows - Rows in display order.
 */

/**
 * Selectable side option in the swap selector.
 * @typedef {object} SwapSideOption
 * @property {string} key - `${chainName}|${tokenId}`; the dropdown value.
 * @property {string} label - Token name with its ticker, for example 'Symbol • XYM'.
 * @property {string|null} imageId - Token avatar image identifier.
 * @property {ChainName} chainName - Chain shown next to the label.
 * @property {string} amount - Balance in relative units.
 * @property {SwapSide} side - Domain value handed back by the change callbacks.
 */

/**
 * Swap selector view model.
 * @typedef {object} SwapSelectorViewModel
 * @property {SwapSideOption|null} source - Selected source option; null while nothing is selected.
 * @property {SwapSideOption|null} target - Selected target option; null while nothing is selected.
 * @property {SwapSideOption[]} sourceOptions - Selectable source options.
 * @property {SwapSideOption[]} targetOptions - Selectable target options.
 */

/**
 * Swap history item display data.
 * @typedef {object} SwapHistoryItem
 * @property {string} key - Request transaction hash.
 * @property {string} actionText - Localized action label.
 * @property {string} dateText - Formatted request date.
 * @property {{ chainName: ChainName, imageId: string|null }} source - Source chain and its token avatar.
 * @property {{ chainName: ChainName, imageId: string|null }} target - Target chain and its token avatar.
 * @property {SwapStatusDisplayData|null} status - Payout status; null while the payout status is unknown.
 * @property {{ value: string, ticker: string }|null} amount - Payout amount; null before a payout exists.
 * @property {SwapRequestCaptionDisplayData} caption - Caption under the row.
 * @property {boolean} isPending - Request confirmed, payout not processed yet; the row is highlighted.
 * @property {BridgeRequest|BridgeError} request - Domain item, handed back on press.
 */

/**
 * Swap history list view model.
 * @typedef {object} SwapHistoryViewModel
 * @property {SwapHistoryItem[]} items - Rows in list order.
 * @property {string} pageSizeText - Note under the list when the page is full; empty otherwise.
 */

/**
 * Swap details view model.
 * @typedef {object} SwapDetailsViewModel
 * @property {SwapStatusDisplayData} status - Overall swap status.
 * @property {SwapSideDisplayData} source - Source side.
 * @property {SwapSideDisplayData} target - Target side.
 * @property {ActivityLogItem[]} activityLog - Step-by-step progress.
 */

export {};

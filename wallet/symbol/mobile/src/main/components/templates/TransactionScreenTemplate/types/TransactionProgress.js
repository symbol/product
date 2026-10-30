/** @typedef {import('@/app/types/ActivityLog').ActivityLogItem} ActivityLogItem */
/** @typedef {import('@/app/types/Network').NetworkIdentifier} NetworkIdentifier */
/** @typedef {import('@/app/types/Network').ChainName} ChainName */
/** @typedef {import('@/app/types/ColorVariants').SemanticRoleColorVariants} SemanticRoleColorVariants */

/**
 * Resolved status information including icon, variant, title, description and type for display.
 * @typedef {object} StatusInfo
 * @property {string} type - The transaction status info type from TransactionWorkflowStatus.
 * @property {string} icon - Icon name to display for the status.
 * @property {SemanticRoleColorVariants} variant - Visual variant for styling the status indicator.
 * @property {string} title - Localised title text for the status card.
 * @property {string} description - Localised description text for the status card.
 */

/**
 * A block explorer link entry for a single transaction.
 * @typedef {object} ExplorerLink
 * @property {ChainName} chainName - The blockchain network name (e.g., 'symbol', 'nem').
 * @property {NetworkIdentifier} networkIdentifier - Network identifier ('mainnet' or 'testnet').
 * @property {string} hash - The transaction hash.
 */

/**
 * View model for the transaction status dialog, containing all derived display data for the current workflow state.
 * @typedef {object} TransactionProgressViewModel
 * @property {boolean} isCloseButtonDisabled - True while any workflow step is actively processing.
 * @property {ActivityLogItem[]} activityLogData - Activity log items for each workflow step (create, sign, announce, confirm).
 * @property {StatusInfo} statusInfo - Pre-resolved status card display info (title, description, icon, variant).
 * @property {ExplorerLink[]} explorerLinks - Block explorer links for each announced transaction; empty until announcement is complete.
 */

export {};

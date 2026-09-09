/** @typedef {import('@/app/types/Wallet').WalletController} WalletController */
/** @typedef {import('@/app/types/Token').TokenInfo} TokenInfo */
/** @typedef {import('@/app/types/Network').NetworkIdentifier} NetworkIdentifier */
/** @typedef {import('@/app/types/Network').ChainName} ChainName */
/** @typedef {import('wallet-common-core/src/lib/bridge/SwapWorkflowManager').SwapWorkflowManager} SwapWorkflowManager */
/** @typedef {import('wallet-common-core/src/lib/bridge/SwapWorkflowManager').PairManager} SwapStep */
/** @typedef {import('wallet-common-core/src/types/Bridge').BridgeEstimation} BridgeEstimation */
/** @typedef {import('wallet-common-core/src/types/Bridge').BridgeRequest} BridgeRequest */
/** @typedef {import('wallet-common-core/src/types/Bridge').BridgeError} BridgeError */
/** @typedef {import('@/app/types/Transaction').TransactionFeeTiers} TransactionFeeTiers */

/**
 * Bridge operation mode.
 * @typedef {'wrap' | 'unwrap'} BridgeModeType
 */

/**
 * Token.
 * @typedef {object} SwapToken
 * @property {string} id - Token identifier.
 * @property {string} name - Token name.
 * @property {number} divisibility - Token divisibility.
 * @property {string} amount - Amount in relative units.
 * @property {string} [ticker] - Token ticker.
 */

/**
 * Side of a swap operation - target or the source.
 * @typedef {object} SwapSide
 * @property {SwapToken} token - The token being swapped with balance.
 * @property {ChainName} chainName - The name of the blockchain network (e.g., 'symbol').
 * @property {NetworkIdentifier} networkIdentifier - The identifier for the network (e.g., 'mainnet').
 * @property {WalletController} walletController - The wallet controller associated with this swap side.
 */

/**
 * Swappable pair of tokens and their swap workflow manager.
 * @typedef {object} SwapPair
 * @property {SwapSide} source - The source swap side.
 * @property {SwapSide} target - The target swap side.
 * @property {SwapWorkflowManager} bridge - The bridge manager for this swap pair.
 */

/**
 * Loading status.
 * @typedef {'not_configured' | 'loading' | 'ok' | 'no_pairs' | 'disabled' | 'error'} BridgePairsStatusType
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
 * Type of the swap side.
 * @typedef {'source' | 'target'} SwapSideTypeValue
 */

/**
 * Fees info for a swap step.
 * @typedef {object} StepFees
 * @property {number} stepIndex - Zero-based step index.
 * @property {ChainName} chainName - Chain the step's transactions run on.
 * @property {NetworkIdentifier} networkIdentifier - Network identifier of that chain.
 * @property {TransactionFeeTiers[]|null} feeTiers - Fee tier list or null until fetched.
 */

/**
 * Metadata for a one swap side.
 * @typedef {object} WorkflowMetaSide
 * @property {TokenInfo|null} tokenInfo - Token info for this side.
 * @property {ChainName} chainName - Blockchain name.
 * @property {NetworkIdentifier} networkIdentifier - Network identifier.
 */

/**
 * Metadata for a single-step workflow.
 * @typedef {object} SingleWorkflowMeta
 * @property {WorkflowMetaSide} source - Source side metadata.
 * @property {WorkflowMetaSide} target - Target side metadata.
 */

/**
 * Metadata for a single step in a two-step workflow.
 * @typedef {object} WorkflowStepMeta
 * @property {WorkflowMetaSide} source - Source side metadata.
 * @property {WorkflowMetaSide} target - Target side metadata.
 */

/**
 * Metadata for a dual-step workflow.
 * @typedef {object} DualWorkflowMeta
 * @property {WorkflowStepMeta} step1 - First step metadata.
 * @property {WorkflowStepMeta} step2 - Second step metadata.
 */

/**
 * Severity level for price impact.
 * @typedef {'none' | 'warning' | 'critical'} PriceImpactSeverityValue
 */

/** Operation modes for bridge. */
export const BridgeMode = {
	WRAP: /** @type {BridgeModeType} */ ('wrap'),
	UNWRAP: /** @type {BridgeModeType} */ ('unwrap')
};

/** Loading status. */
export const BridgePairsStatus = {
	NOT_CONFIGURED: /** @type {BridgePairsStatusType} */ ('not_configured'),
	LOADING: /** @type {BridgePairsStatusType} */ ('loading'),
	OK: /** @type {BridgePairsStatusType} */ ('ok'),
	NO_PAIRS: /** @type {BridgePairsStatusType} */ ('no_pairs'),
	DISABLED: /** @type {BridgePairsStatusType} */ ('disabled'),
	ERROR: /** @type {BridgePairsStatusType} */ ('error')
};

/** Confirmation status of bridge requests. */
export const BridgeRequestStatus = {
	UNCONFIRMED: /** @type {BridgeRequestStatusType} */ ('unconfirmed'),
	CONFIRMED: /** @type {BridgeRequestStatusType} */ ('confirmed'),
	ERROR: /** @type {BridgeRequestStatusType} */ ('error')
};

/** Payout processing status. */
export const BridgePayoutStatus = {
	UNPROCESSED: /** @type {BridgePayoutStatusType} */ (0),
	SENT: /** @type {BridgePayoutStatusType} */ (1),
	COMPLETED: /** @type {BridgePayoutStatusType} */ (2),
	FAILED: /** @type {BridgePayoutStatusType} */ (3)
};

/** Swap side type. */
export const SwapSideType = {
	SOURCE: /** @type {SwapSideTypeValue} */ ('source'),
	TARGET: /** @type {SwapSideTypeValue} */ ('target')
};

export {};

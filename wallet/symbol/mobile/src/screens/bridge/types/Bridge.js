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
 * Token with balance information for swap operations.
 * @typedef {object} SwapToken
 * @property {string} id - Token identifier.
 * @property {string} name - Token name.
 * @property {number} divisibility - Token divisibility.
 * @property {string} amount - Token balance amount in relative units.
 * @property {string} [ticker] - Contract-reported ticker; Ethereum tokens only.
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
 * @property {SwapWorkflowManager} bridge - The bridge manager for this swap pair.
 */

/**
 * Bridge pairs loading status.
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
 * Swap side type identifier.
 * @typedef {'source' | 'target'} SwapSideTypeValue
 */

/**
 * Fee data of one route step.
 * @typedef {object} StepFees
 * @property {number} stepIndex - Zero-based step index.
 * @property {ChainName} chainName - Chain the step's transactions run on.
 * @property {NetworkIdentifier} networkIdentifier - Network identifier of that chain.
 * @property {TransactionFeeTiers[]|null} feeTiers - One tier set per transaction of the step's bundle; null until fetched.
 */

/**
 * Metadata describing one side (source or target) of a workflow step.
 * @typedef {object} WorkflowMetaSide
 * @property {TokenInfo|null} tokenInfo - Token info for this side.
 * @property {ChainName} chainName - The blockchain name.
 * @property {NetworkIdentifier} networkIdentifier - The network identifier.
 */

/**
 * Metadata for a single-step workflow.
 * @typedef {object} SingleWorkflowMeta
 * @property {WorkflowMetaSide} source - Source side metadata.
 * @property {WorkflowMetaSide} target - Target side metadata.
 */

/**
 * Metadata for one step within a dual-step workflow.
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
 * Price impact severity tier.
 * @typedef {'none' | 'warning' | 'critical'} PriceImpactSeverityValue
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
	DISABLED: /** @type {BridgePairsStatusType} */ ('disabled'),
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

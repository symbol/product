/** @typedef {import('@/app/types/Transaction').TransactionBundle} TransactionBundle */
/** @typedef {import('@/app/types/AsyncManager').AsyncManager} AsyncManager */

/**
 * Base transaction workflow interface with core methods common to all workflow types.
 * @typedef {object} TransactionWorkflow
 * @property {TransactionBundle|null} transaction - The current transaction bundle, or null if none.
 * @property {string} status - Current workflow status, a TransactionWorkflowStatus value.
 * @property {function(): Promise<TransactionBundle>} createTransaction - Creates a new transaction bundle.
 * @property {function(): Promise<void>} executeSignAndAnnounce - Signs and announces the current bundle.
 * @property {function(): void} reset - Resets all workflow state.
 */

/**
 * Full transaction workflow returned by useStandardTransactionWorkflow.
 * Extends TransactionWidget with manager state, hash tracking, and derived status flags.
 * @typedef {TransactionWorkflow & object} StandardTransactionWorkflow
 * @property {boolean} isSending - Whether a transaction is currently being sent.
 * @property {boolean} isFailed - Whether the last transaction attempt failed.
 * @property {boolean} isSent - Whether the transaction has been successfully sent.
 * @property {object} managers - Collection of managers for different workflow stages.
 * @property {AsyncManager} managers.createManager - Manager for creating transactions.
 * @property {AsyncManager} managers.signManager - Manager for signing transactions.
 * @property {AsyncManager} managers.announceManager - Manager for announcing transactions.
 * @property {object} hashes - Tracking for various transaction state hashes.
 * @property {string[]} hashes.signed - List of signed transaction hashes.
 * @property {string[]} hashes.confirmed - List of confirmed transaction hashes.
 * @property {string[]} hashes.failed - List of failed transaction hashes.
 * @property {string[]} hashes.partial - List of partial transaction hashes.
 */

export {};

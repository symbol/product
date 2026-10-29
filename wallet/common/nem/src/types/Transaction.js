/** @typedef {import('./Network').TransactionFeeTier} TransactionFeeTier */

/**
 * @typedef {Object} Transaction
 * @property {number} type - The transaction type.
 * @property {string|null} signerPublicKey - The public key of the transaction signer.
 * @property {string|null} signerAddress - The address of the transaction signer.
 * @property {TransactionFeeTier|null} [fee] - The transaction fee.
 * @property {Deadline|null} [deadline] - The transaction deadline.
 * @property {number|null} [timestamp] - Timestamp the transaction is created.
 * @property {number|null} [height] - The block height the transaction is included in.
 * @property {string|null} [hash] - The transaction hash.
 */

/**
 * @typedef {Object} Deadline
 * @property {number} timestamp - UI-ready expiry time (Unix ms).
 * @property {{ timestamp: number, deadline: number }} adjusted - SDK-ready NEM times (seconds since the NEM
 * epoch): the creation `timestamp` and the expiry `deadline`.
 */

/**
 * @typedef {Object} SignedTransactionDTO
 * @property {string} data - The transaction serialized without the signature (hex).
 * @property {string} signature - The transaction signature (hex).
 */

/**
 * @typedef {Object} CosignedTransactionDTO
 * @property {string} data - The cosignature transaction serialized without the signature.
 * @property {string} signature - The cosignature transaction signature.
 */

/**
 * @typedef {Object} SignedTransaction
 * @property {SignedTransactionDTO} dto - Transaction data transfer object.
 * @property {string} hash - The transaction hash.
 */

/**
 * @typedef {Object} CosignedTransaction
 * @property {CosignedTransactionDTO} dto - Transaction data transfer object.
 * @property {string} hash - The cosignature transaction hash.
 * @property {string} signerPublicKey - The public key of the cosigner.
 */

export default {};

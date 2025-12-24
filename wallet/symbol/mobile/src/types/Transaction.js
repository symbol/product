/**
 * @typedef {Object} Transaction
 * @property {string} type - The transaction type.
 * @property {string} signerPublicKey - The public key of the transaction signer.
 * @property {string} signerAddress - The address of the transaction signer.
 * @property {number} fee - The transaction fee.
 * @property {number} [deadline] - The transaction deadline.
 * @property {number} [timestamp] - Timestamp the transaction is confirmed.
 * @property {number} [height] - The block height the transaction is included in.
 * @property {string} [hash] - The transaction hash.
 */

/**
 * @typedef {Object} TransactionMessage
 * @property {string} payload - The message payload HEX.
 * @property {number} type - The message type. The first byte of the payload.
 * @property {string} text - Utf-8 decoded payload.
 */

/**
 * @typedef {Object} SignedTransactionDTO
 * @property {string} payload - The transaction payload.
 */

/**
 * @typedef {Object} CosignedTransactionDTO
 * @property {string} parentHash - The hash of the parent transaction.
 * @property {string} signerPublicKey - The public key of the cosigner.
 * @property {string} signature - The cosigner signature.
 * @property {string} version - The transaction version.
 */

/**
 * @typedef {Object} SignedTransaction
 * @property {SignedTransactionDTO} dto - Transaction data transfer object.
 * @property {string} hash - The transaction hash.
 */

/**
 * @typedef {Object} CosignedTransaction
 * @property {CosignedTransactionDTO} dto - Transaction data transfer object.
 * @property {string} hash - The transaction hash.
 */

export default {};

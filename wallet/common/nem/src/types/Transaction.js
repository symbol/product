/**
 * @typedef {object} Message
 * @property {number} type - MessageType value (1=plain, 2=encrypted).
 * @property {string|null} text - Decoded text (null for encrypted).
 * @property {string} payload - Hex-encoded raw payload.
 */

/**
 * @typedef {object} Mosaic
 * @property {string} id - Mosaic ID string (e.g. 'nem.xem').
 * @property {string} name
 * @property {number} amount - Relative amount.
 * @property {number} divisibility
 */

/**
 * @typedef {object} Deadline
 * @property {number} timestamp - UI-ready expiry time (Unix ms).
 * @property {{ timestamp: number, deadline: number }} adjusted - SDK-ready NEM times (seconds since the NEM
 * epoch): the creation `timestamp` and the expiry `deadline`.
 */

/**
 * @typedef {object} Transaction
 * @property {number} type - TransactionType value.
 * @property {string|null} hash
 * @property {number|null} timestamp - Transaction date/time from the history API (Unix ms).
 * @property {Deadline|null} [deadline]
 * @property {number|null} height
 * @property {number|null} fee - Relative fee in native currency.
 * @property {string|null} signerAddress
 * @property {string|null} signerPublicKey
 * @property {string|null} [recipientAddress]
 * @property {number} [amount] - Signed amount (positive=incoming, negative=outgoing).
 * @property {Mosaic[]} [mosaics]
 * @property {Message|null} [message]
 * @property {Transaction|null} [innerTransaction]
 * @property {Transaction[]} [innerTransactions]
 * @property {Array} [cosignatures]
 */

/**
 * @typedef {object} SignedTransaction
 * @property {string} hash - Transaction hash (hex).
 * @property {string} payload - Serialized transaction (hex).
 * @property {{ data: string, signature: string }} dto - Body for NEM /transaction/announce.
 */

/**
 * @typedef {object} CosignedTransaction
 * @property {string} hash
 * @property {string} signerPublicKey
 * @property {string} payload
 * @property {{ data: string, signature: string }} dto
 */

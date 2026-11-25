/**
 * @typedef {object} Mosaic
 * @property {string} id - The mosaic id.
 * @property {string} name - The first linked namespace name, or the mosaic id when the mosaic has no name.
 * @property {number} amount - The mosaic relative amount.
 */

/**
 * @typedef {object} TransactionListItem
 * @property {string} type - The transaction type.
 * @property {string} group - The transaction group.
 * @property {string} hash - The transaction hash. An embedded transaction has the hash of its aggregate.
 * @property {string|null} timestamp - Timestamp the transaction is confirmed, null when the transaction is not confirmed.
 * @property {string} signer - The address of the transaction signer.
 * @property {string} sender - The sender address.
 * @property {string|null} recipient - The recipient address, null when the transaction has no recipient.
 * @property {string|null} account - The recipient address when the requested account is the sender, otherwise the sender address.
 * @property {'incoming'|'outgoing'|null} direction - The transaction direction for the requested account,
 * null when the account is not the sender or the recipient.
 * @property {number|null} height - The block height the transaction is included in, null when the transaction is not confirmed.
 * @property {number|null} fee - The transaction fee charged by the network, null for an embedded or unconfirmed transaction.
 * @property {number} amount - The transferred native mosaic amount.
 * @property {Mosaic[]} value - The transaction mosaics.
 */

/**
 * @typedef {object} Page
 * @property {TransactionListItem[]} data - The items of the page.
 * @property {number} pageNumber - The page number.
 */

/**
 * @typedef {object} TransactionBodyItem
 * @property {string} type - The transaction type.
 * @property {string} sender - The sender address.
 * @property {string|null} recipient - The recipient address, null when the transaction has no recipient.
 */

/**
 * @typedef {object} Cosignature
 * @property {string} signer - The address of the cosigner.
 * @property {string} signature - The cosigner signature.
 */

/**
 * @typedef {object} AccountStateChange
 * @property {string} address - The account address.
 * @property {Array<'send'|'receive'|'none'>} action - The type of change for each mosaic.
 * @property {Mosaic[]} mosaic - List of mosaic changes for this account. The amount is the relative change
 * (can be positive or negative).
 */

/**
 * @typedef {object} TransactionInfo
 * @property {string} type - The transaction type.
 * @property {string} group - The transaction group.
 * @property {string} hash - The transaction hash.
 * @property {string|null} timestamp - Timestamp the transaction is confirmed, null when the transaction is not confirmed.
 * @property {string} deadline - The transaction deadline.
 * @property {string} signer - The address of the transaction signer.
 * @property {string} sender - The sender address.
 * @property {string|null} recipient - The recipient address, null when the transaction has no recipient.
 * @property {number|null} height - The block height the transaction is included in, null when the transaction is not confirmed.
 * @property {string} signature - The transaction signature.
 * @property {number} fee - The transaction fee. Represents the maximum declared fee before transaction confirmation
 * or the actual network charge after confirmation.
 * @property {number} amount - The transferred native mosaic amount.
 * @property {Mosaic[]} value - The transaction mosaics.
 * @property {TransactionBodyItem[]} body - The body items, one for the transaction or one for each embedded transaction.
 * @property {number} size - The transaction size in bytes.
 * @property {number} version - The transaction version.
 * @property {Cosignature[]} signatures - The cosignatures of an aggregate transaction.
 * @property {AccountStateChange[]} accountStateChange - The mosaic balance changes of the involved accounts.
 */

export {};

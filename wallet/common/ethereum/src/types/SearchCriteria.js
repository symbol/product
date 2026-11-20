/** @typedef {import('wallet-common-core/src/types/SearchCriteria').PageCursor} PageCursor */
/** @typedef {import('wallet-common-core/src/types/SearchCriteria').PageSearchCriteria} PageSearchCriteria */
/**
 * @template T
 * @typedef {import('wallet-common-core/src/types/SearchCriteria').Page<T>} Page
 */

/**
 * @typedef {Object} TransactionFiler
 * @property {string} [from] - The sender address.
 * @property {string} [to] - The recipient address.
 * @property {string} [type] - The transaction type.
 */

/**
 * @typedef {PageSearchCriteria} TransactionSearchCriteria
 * @property {"confirmed" | "partial" | "unconfirmed"} group - The transaction group.
 * @property {TransactionFiler} [filter] - The transaction filter.
 */

export default {};

/**
 * @typedef {Object} SearchCriteria
 * @property {number} pageNumber - The page number.
 * @property {number} pageSize - The page size.
 */

/**
 * @typedef {SearchCriteria} SortableSearchCriteria
 * @property {"asc" | "desc"} order - The sort order.
 */

/**
 * @typedef {Object} TransactionFiler
 * @property {string} [from] - The sender address.
 * @property {string} [to] - The recipient address.
 * @property {string} [type] - The transaction type.
 */

/**
 * @typedef {SortableSearchCriteria} TransactionSearchCriteria
 * @property {"confirmed" | "partial" | "unconfirmed"} group - The transaction group.
 * @property {TransactionFiler} [filter] - The transaction filter.
 */

/**
 * @typedef {SortableSearchCriteria} HarvestedBlockSearchCriteria
 */

export default {};

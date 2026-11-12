/**
 * @typedef {string} PageCursor - The marker from which next page is fetched. Can be a page number or a cursor value depending on the API.
 */

/**
 * @template T
 * @typedef {Object} Page
 * @property {T[]} data - The items of the page.
 * @property {PageCursor|null} nextCursor - The cursor of the next page, null when no next page is available.
 */

/**
 * @typedef {Object} PageSearchCriteria
 * @property {PageCursor|null} [cursor] - The cursor of the page to fetch. The first page is fetched when omitted.
 * @property {number} [pageSize] - The page size.
 * @property {"asc" | "desc"} [order] - The sort order.
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

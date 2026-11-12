/** @typedef {import('wallet-common-core/src/types/SearchCriteria').PageCursor} PageCursor */
/**
 * @template T
 * @typedef {import('wallet-common-core/src/types/SearchCriteria').Page<T>} Page
 */

/**
 * @typedef {object} TransactionSearchCriteria
 * @property {string} [group] - TransactionGroup value (defaults to 'confirmed').
 * @property {PageCursor|null} [cursor] - The transaction id from which to fetch the next page.
 * @property {number} [pageSize] - Number of transactions per page.
 * @property {{ direction?: 'incoming'|'outgoing' }} [filter] - Optional direction filter.
 */

export default {};

/**
 * Render variant for a table row, determining how the value is displayed.
 * @typedef {'account' | 'token' | 'copy' | 'text'} TableRowType
 */

/**
 * A single row in a detail table, with a title, value, and render type.
 * @typedef {object} TableRow
 * @property {string} title - Row title/label.
 * @property {any} value - Row value (address for account, tokenId for token, string for copy/text).
 * @property {TableRowType} type - How to render the row.
 * @property {string} [amount] - Token amount (for token type).
 */

export {};

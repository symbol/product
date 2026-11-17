/** @typedef {import('@/app/types/Table').TableRow} TableRow */
/** @typedef {import('@/app/types/Network').ChainName} ChainName */

/**
 * A section of transaction preview data for the confirmation dialog.
 * @typedef {object} ConfirmationDialogSection
 * @property {string} id - Unique identifier for the section.
 * @property {string} title - Display title for the section.
 * @property {ChainName} chainName - Chain name for this transaction.
 * @property {TableRow[]} tableData - Table rows for previewing this transaction.
 */

export {};

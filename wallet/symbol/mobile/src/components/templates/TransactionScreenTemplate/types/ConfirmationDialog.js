/** @typedef {import('@/app/types/Table').TableRow} TableRow */
/** @typedef {import('@/app/types/Wallet').AddressBookModule} AddressBookModule */
/** @typedef {import('@/app/types/Account').WalletAccount} WalletAccount */
/** @typedef {import('@/app/types/Network').NetworkIdentifier} NetworkIdentifier */
/** @typedef {import('@/app/types/Network').ChainName} ChainName */

/**
 * A section of transaction preview data for the confirmation dialog.
 * @typedef {object} ConfirmationDialogSection
 * @property {string} id - Unique identifier for the section.
 * @property {string} title - Display title for the section.
 * @property {ChainName} chainName - Chain name for this transaction.
 * @property {NetworkIdentifier} networkIdentifier - Network identifier for this transaction.
 * @property {AddressBookModule} addressBook - Address book instance for this chain.
 * @property {WalletAccount[]} walletAccounts - Wallet accounts for this chain.
 * @property {TableRow[]} tableData - Table rows for previewing this transaction.
 */

export {};

/** @typedef {import('wallet-common-core/src/types/Account').PublicAccount} PublicAccount */

/** @typedef {import('wallet-common-core/src/types/Account').WalletAccount} WalletAccount */

/** @typedef {import('wallet-common-core/src/types/Account').PrivateAccount} PrivateAccount */

/** @typedef {import('wallet-common-symbol/src/types/Account').AccountInfo} SymbolAccountInfo */

/** @typedef {import('wallet-common-symbol/src/types/Account').HarvesterAccountInfo} HarvesterAccountInfo */

/** @typedef {import('wallet-common-ethereum/src/types/Account').AccountInfo} EthereumAccountInfo */

/** @typedef {SymbolAccountInfo | EthereumAccountInfo} AccountInfo */

/**
 * Resolved display data for an account, consumed by the account display components.
 * @typedef {object} AccountDisplayData
 * @property {string} address - The account address.
 * @property {string|null} name - The display name for the account, or null when unresolved.
 * @property {string|null} imageId - The image ID for the account avatar, or null if not available.
 * @property {string} color - The generated color for the account avatar when no image is available.
 */

export {};

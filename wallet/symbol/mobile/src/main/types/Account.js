/** @typedef {import('wallet-common-core/src/types/Account').PublicAccount} PublicAccount */

/** @typedef {import('wallet-common-core/src/types/Account').WalletAccount} WalletAccount */

/** @typedef {import('wallet-common-core/src/types/Account').PrivateAccount} PrivateAccount */

/** @typedef {import('wallet-common-symbol/src/types/Account').AccountInfo} SymbolAccountInfo */

/** @typedef {import('wallet-common-symbol/src/types/Account').HarvesterAccountInfo} HarvesterAccountInfo */

/** @typedef {import('wallet-common-ethereum/src/types/Account').AccountInfo} EthereumAccountInfo */

/** @typedef {SymbolAccountInfo | EthereumAccountInfo} AccountInfo */

/** @typedef {import('@/app/types/Network').ChainName} ChainName */

/** @typedef {import('@/app/types/Network').NetworkIdentifier} NetworkIdentifier */

/** @typedef {import('@/app/types/Wallet').AddressBookModule} AddressBookModule */

/**
 * Options for resolving account display information.
 * @typedef {object} AccountResolveOptions
 * @property {WalletAccount[]} walletAccounts - Wallet accounts associated with the current network.
 * @property {AddressBookModule} [addressBook] - Address book module (if available).
 * @property {ChainName} chainName - Blockchain name (e.g. 'symbol', 'ethereum').
 * @property {NetworkIdentifier} networkIdentifier - Network identifier (e.g., 'mainnet', 'testnet').
 */

/**
 * Resolved display data for an account, consumed by the account display components.
 * @typedef {object} AccountDisplayData
 * @property {string} address - The account address.
 * @property {string|null} name - The display name for the account, or null when unresolved.
 * @property {string|null} imageId - The image ID for the account avatar, or null if not available.
 * @property {string} color - The generated color for the account avatar when no image is available.
 */

export {};

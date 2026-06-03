/**
 * @typedef {object} KeyPair
 * @property {string} publicKey - Hex-encoded public key.
 * @property {string} privateKey - Hex-encoded private key.
 */

/**
 * @typedef {object} PublicAccount
 * @property {string} address - NEM address (40-char Base32).
 * @property {string} publicKey - Hex-encoded public key.
 * @property {string} networkIdentifier - 'mainnet' | 'testnet'.
 * @property {string} [accountType] - Account type (e.g. 'bip32').
 * @property {number} [index] - BIP32 account index.
 */

/**
 * @typedef {object} PrivateAccount
 * @property {string} address
 * @property {string} publicKey
 * @property {string} privateKey
 * @property {string} networkIdentifier
 * @property {string} [accountType]
 * @property {number} [index]
 */

/**
 * @typedef {object} WalletAccount
 * @property {string} address
 * @property {string} publicKey
 * @property {string} networkIdentifier
 * @property {string} name
 * @property {string} accountType
 * @property {number} [index]
 */

/**
 * @typedef {object} AccountInfo
 * @property {string} address
 * @property {string|null} publicKey
 * @property {import('./Mosaic').Mosaic[]} mosaics
 * @property {number} balance - Native currency balance (relative).
 * @property {number} importance
 * @property {boolean} isMultisig - Whether the account is a multisig account.
 * @property {string[]} multisigAddresses
 * @property {string[]} cosignatories
 * @property {number} [minApproval] - Minimum number of cosignatories required for transaction approval.
 */

/**
 * @typedef {object} MultisigAccountInfo
 * @property {string[]} cosignatories
 * @property {string[]} multisigAddresses
 * @property {number} minApproval
 */

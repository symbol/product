/**
 * @typedef {Object} KeyPair
 * @property {string} privateKey - The private key as a string.
 * @property {string} publicKey - The public key as a string.
 */

/**
 * @typedef {Object} PublicAccount
 * @property {string} address - Account address.
 * @property {string} publicKey - Account public key.
 * @property {string} networkIdentifier - Network identifier the account belongs to.
 * @property {string} accountType - Account type 'mnemonic' or 'external'
 * @property {number} [index] - Seed account index
 */

/**
 * @typedef {PublicAccount} PrivateAccount
 * @property {string} privateKey - Account private key.
 */

/**
 * @typedef {PublicAccount} WalletAccount
 * @property {string} name - Account name.
 */

export default {};

/** @typedef {import('./Token').Token} Token */

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
 * @property {string} [accountType] - Account type 'mnemonic' or 'external'
 * @property {number} [index] - Seed account index
 */

/**
 * @typedef {PublicAccount} PrivateAccount
 * @property {string} privateKey - Account private key.
 */

/**
 * @typedef {PublicAccount} WalletAccount
 * @property {string} name - Account name.
 * @property {string} accountType - Account type 'mnemonic' or 'external'
 */

/**
 * @typedef {Object} LinkedKeys
 * @property {string} linkedPublicKey - Linked public key.
 * @property {string} nodePublicKey - Node public key.
 * @property {string} vrfPublicKey - VRF public key.
 */

/**
 * @typedef {Object} BaseAccountInfo
 * @property {string} address - Account address.
 * @property {Token[]} tokens - Account owned tokens (e.g. ETH, ERC-20).
 * @property {number} balance - Account native currency balance (ETH).
 */

/**
 * @typedef {BaseAccountInfo} AccountInfo
 */

export default {};

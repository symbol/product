/** @typedef {import('./Mosaic').Mosaic} Mosaic */
/** @typedef {import('./Namespace').Namespace} Namespace */
/** @typedef {import('./Transaction').TransactionLocation} TransactionLocation */

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
 * @property {string} publicKey - Account public key.
 * @property {Mosaic[]} mosaics - Account owned mosaics.
 * @property {number} balance - Account native currency balance.
 * @property {number} importance - Account importance score used in harvesting.
 * @property {LinkedKeys} linkedKeys - Linked public keys used in harvesting.
 */

/**
 * @typedef {Object} MultisigAccountInfo
 * @property {string[]} multisigAddresses - List of multisig account addresses which the account is cosignatory of.
 * @property {string[]} cosignatories - If an account is multisig, contains the list of its cosignatories.
 * @property {number} minApproval - Minimum number of cosignatories required for transaction approval.
 * @property {number} minRemoval - Minimum number of cosignatories required for removal of cosignatories.
 */

/**
 * @typedef {BaseAccountInfo} AccountInfo
 * @property {boolean} isMultisig - Whether the account is a multisig account.
 * @property {string[]} cosignatories - List of cosignatories.
 * @property {string[]} multisigAddresses - List of multisig addresses.
 * @property {Namespace[]} namespaces - Account created namespaces.
 */

/**
 * @typedef {Object} UnresolvedAddressWithLocation
 * @property {string} namespaceId - The unresolved address (namespace id).
 * @property {TransactionLocation} [location] - The transaction location where the unresolved address is found.
 */

export default {};

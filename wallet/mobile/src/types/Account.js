import * as MosaicTypes from './Mosaic'; // eslint-disable-line no-unused-vars
import * as NamespaceTypes from './Namespace'; // eslint-disable-line no-unused-vars

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
 */

/**
 * @typedef {Object} WalletAccount
 * @property {string} address - Account address.
 * @property {string} publicKey - Account public key.
 * @property {string} name - Account name.
 * @property {string} networkIdentifier - Network identifier.
 * @property {string} accountType - Account type 'seed' or 'external'
 * @property {number} [index] - Seed account index
 */

/**
 * @typedef {WalletAccount} WalletStorageAccount
 * @property {string} privateKey - Account private key.
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
 * @property {MosaicTypes.Mosaic[]} mosaics - Account owned mosaics.
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
 * @property {NamespaceTypes.Namespace[]} namespaces - Account created namespaces.
 */

export default {};

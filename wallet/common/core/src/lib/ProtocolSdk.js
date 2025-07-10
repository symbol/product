import { validateFields } from '../utils/helper';

/** @typedef {import('../types/Account').PrivateAccount} PrivateAccount */
/** @typedef {import('../types/Network').NetworkProperties} NetworkProperties */
/** @typedef {import('../types/Transaction').Transaction} Transaction */
/** @typedef {import('../types/Transaction').SignedTransaction} SignedTransaction */
/** @typedef {import('../types/Transaction').CosignedTransaction} CosignedTransaction */

/**
 * @callback SignTransactionFn
 * @param {NetworkProperties} networkProperties - The network properties.
 * @param {Transaction} transaction - The transaction object.
 * @param {string} privateKey - The signer account private key.
 * @returns {SignedTransaction} The signed transaction.
 */

/**
 * @callback CosignTransactionFn
 * @param {NetworkProperties} networkProperties - The network properties.
 * @param {Transaction} transaction - The transaction object.
 * @param {string} privateKey - The cosigner account private key.
 * @returns {CosignedTransaction} The cosigned transaction.
 */

/** 
 * @callback EncryptMessageFn
 * @param {string} messageText - The message text.
 * @param {string} recipientPublicKey - The recipient public key.
 * @param {string} privateKey - Current account private key.
 * @returns {string} The resulting payload HEX string.
 */

/**
 * @callback DecryptMessageFn
 * @param {string} encryptedMessageHex - The encrypted message HEX string.
 * @param {string} senderOrRecipientPublicKey - The sender or recipient public key.
 * @param {string} privateKey - Current account private key.
 * @returns {string} The resulting message text.
 */

/**
 * @callback CreatePrivateAccountFn
 * @param {string} privateKey - The private key.
 * @param {string} networkIdentifier - The network identifier.
 * @param {string} accountType - The account type.
 * @param {number} [index] - The account index.
 * @returns {PrivateAccount} The wallet storage account object.
 */

/**
 * @callback CreatePrivateKeysFromMnemonicFn
 * @param {string} mnemonic - The mnemonic phrase string used to generate the private keys.
 * @param {number[]} seedIndexes - An array of indexes to derive private keys from the mnemonic.
 * @param {string} networkIdentifier - The network identifier.
 * @returns {string[]} An array of private keys derived from the mnemonic.
 */

const requiredMethods = [
	'signTransaction',
	'cosignTransaction',
	'encryptMessage',
	'decryptMessage',
	'createPrivateAccount',
	'createPrivateKeysFromMnemonic'
];

/**
 * @description This class provides protocol-related wallet functionality using injected methods.
 */
export class ProtocolSdk {
	/**
	 * @type {SignTransactionFn}
	 * @description Signs a transaction using the provided network properties, transaction object, and private key.
	 */
	signTransaction;

	/**
	 * @type {CosignTransactionFn}
	 * @description Cosigns a transaction using the provided network properties, transaction object, and private key.
	 */
	cosignTransaction;

	/**
	 * @type {EncryptMessageFn}
	 * @description Encrypts a message text string using the provided recipient public key and current account private key.
	 */
	encryptMessage;

	/**
	 * @type {DecryptMessageFn}
	 * @description Decrypts an encrypted message HEX string 
	 * using the provided sender or recipient public key and current account private key.
	 */
	decryptMessage;

	/**
	 * @type {CreatePrivateAccountFn}
	 * @description Creates a private account using the provided private key, network identifier, account type, and optional index.
	 */
	createPrivateAccount;

	/**
	 * @type {CreatePrivateKeysFromMnemonicFn}
	 * @description Creates private keys from a mnemonic phrase using the provided seed indexes and network identifier.
	 */
	createPrivateKeysFromMnemonic;

	/**
	 * @description Constructs a ProtocolSdk instance with the required methods.
	 * @param {object} methods - An object containing the required methods.
	 * @param {SignTransactionFn} methods.signTransaction - Function to sign a transaction.
	 * @param {CosignTransactionFn} methods.cosignTransaction - Function to cosign a transaction.
	 * @param {EncryptMessageFn} methods.encryptMessage - Function to encrypt a message.
	 * @param {DecryptMessageFn} methods.decryptMessage - Function to decrypt a message.
	 * @param {CreatePrivateAccountFn} methods.createPrivateAccount - Function to create a private account.
	 * @param {CreatePrivateKeysFromMnemonicFn} methods.createPrivateKeysFromMnemonic - Function to create private keys from a mnemonic 
	 * phrase.
	 * @throws {Error} If any of the required methods are missing or not functions.
	 */
	constructor(methods) {
		validateFields(methods, requiredMethods.map(method => ({ key: method, type: 'function' })));
		const _this = this;
		requiredMethods.forEach(method => {
			_this[method] = methods[method];
		});
	}
}

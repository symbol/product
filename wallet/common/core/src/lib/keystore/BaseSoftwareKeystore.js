import { KeystoreError } from '../../error/KeystoreError';
import { getAccountWithoutPrivateKey } from '../../utils/account';
import { createNetworkMap } from '../../utils/network';
import { SecureStorageRepository } from '../storage/SecureStorageRepository';

/** @typedef {import('../../types/Account').PublicAccount} PublicAccount */
/** @typedef {import('../../types/Network').NetworkArrayMap} NetworkArrayMap */
/** @typedef {import('../../types/Network').NetworkProperties} NetworkProperties */

/**
 * @constructor BaseSoftwareKeystore
 * @description A base class for software-based keystores. It provides a common interface for managing accounts
 * and performing cryptographic operations like signing, cosigning, and message encryption/decryption.
 * This class is intended to be extended by concrete keystore implementations.
 * It relies on a `_state` property, which must be initialized and managed by the extending child class.
 */
export class BaseSoftwareKeystore {
	/**
	 * Creates an instance of BaseSoftwareKeystore.
	 * @param {object} options - The constructor options.
	 * @param {object} options.secureStorageInterface - The secure storage instance for persisting sensitive data.
	 * @param {object} options.sdk - The SDK instance providing protocol related functions.
	 * @param {string[]} options.networkIdentifiers - An array of supported network identifiers.
	 */
	constructor({ secureStorageInterface, sdk, networkIdentifiers }) {
		this.sdk = sdk;
		this.secureStorageRepository = new SecureStorageRepository(secureStorageInterface);
		this.networkIdentifiers = networkIdentifiers;
	}

	/**
	 * Retrieves all accounts managed by the keystore, grouped by network.
	 * The private keys are omitted from the returned account objects for security.
	 * @returns {Promise<NetworkArrayMap<PublicAccount>>} 
	 * A promise that resolves to a map where keys are network identifiers
	 * and values are arrays of account objects (without private keys).
	 */
	getAccounts = async () => {
		const { privateAccounts } = this._state;
		
		return createNetworkMap(
			networkIdentifier =>
				privateAccounts[networkIdentifier]
					? privateAccounts[networkIdentifier].map(getAccountWithoutPrivateKey)
					: [],
			this.networkIdentifiers
		);
	};

	/**
	 * Retrieves the private key for a specific account.
	 * @param {PublicAccount} account - The account for which to retrieve the private key.
	 * @throws {KeystoreError} If the account is not found in the keystore.
	 * @returns {Promise<string>} A promise that resolves to the account's private key.
	 */
	getPrivateKey = async account => {
		const { networkIdentifier, publicKey } = account;
		const { privateAccounts } = this._state;

		const networkAccounts = privateAccounts[networkIdentifier] || [];
		const privateAccount = networkAccounts.find(acc => acc.publicKey === publicKey);

		if (!privateAccount)
			throw new KeystoreError('Failed to get account private key. Account is missing in the keystore.');

		return privateAccount.privateKey;
	};

	/**
	 * Signs a transaction using the private key of the specified account.
	 * @param {NetworkProperties} networkProperties - The network properties required for signing.
	 * @param {object} transaction - The transaction object to be signed.
	 * @param {PublicAccount} account - The account to use for signing.
	 * @returns {Promise<object>} A promise that resolves to the signed transaction payload.
	 */
	signTransaction = async (networkProperties, transaction, account) => {
		const privateKey = await this.getPrivateKey(account);

		return this.sdk.signTransaction(networkProperties, transaction, privateKey);
	};

	/**
	 * Cosigns partial transaction.
	 * @param {object} transaction - Partial transaction to cosign.
	 * @param {PublicAccount} account - The account to use for cosigning.
	 * @returns {Promise<object>} A promise that resolves to the cosignature object.
	 */
	cosignTransaction = async (transaction, account) => {
		const privateKey = await this.getPrivateKey(account);

		return this.sdk.cosignTransaction(transaction, privateKey);
	};

	/**
	 * Encrypts a plain text message for a recipient.
	 * @param {string} messageText - The plain text message to encrypt.
	 * @param {string} recipientPublicKey - The public key of the message recipient.
	 * @param {PublicAccount} account - The sender's account to use for encryption.
	 * @returns {Promise<string>} A promise that resolves to the encrypted message in hexadecimal format.
	 */
	encryptMessage = async (messageText, recipientPublicKey, account) => {
		const privateKey = await this.getPrivateKey(account);

		return this.sdk.encryptMessage(messageText, recipientPublicKey, privateKey);
	};

	/**
	 * Decrypts an encrypted message.
	 * @param {string} encryptedMessageHex - The encrypted message in hexadecimal format.
	 * @param {string} senderOrRecipientPublicKey - The public key of the other party (either sender or recipient).
	 * @param {PublicAccount} account - The account to use for decryption.
	 * @returns {Promise<string>} A promise that resolves to the decrypted plain text message.
	 */
	decryptMessage = async (encryptedMessageHex, senderOrRecipientPublicKey, account) => {
		const privateKey = await this.getPrivateKey(account);

		return this.sdk.decryptMessage(encryptedMessageHex, senderOrRecipientPublicKey, privateKey);
	};
}

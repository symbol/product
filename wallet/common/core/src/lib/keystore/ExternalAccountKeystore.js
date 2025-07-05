import { BaseSoftwareKeystore } from './BaseSoftwareKeystore';
import { WalletAccountType } from '../../constants';
import * as AccountTypes from '../../types/Account';
import { getAccountWithoutPrivateKey } from '../../utils/account';
import { cloneNetworkArrayMap, createNetworkMap } from '../../utils/network';

const createDefaultState = networkIdentifiers => ({
	privateAccounts: createNetworkMap(() => ([]), networkIdentifiers)
});

export class ExternalAccountKeystore extends BaseSoftwareKeystore {
	static type = WalletAccountType.EXTERNAL;

	constructor({ secureStorageInterface, sdk, networkIdentifiers }) {
		super({
			secureStorageInterface,
			sdk,
			networkIdentifiers
		});

		this._state = createDefaultState(networkIdentifiers);
	}

	/**
	 * Loads accounts from secure storage and initializes the keystore state.
	 * @param {string} [password] - The password to access secure storage.
	 * @returns {Promise<void>} A promise that resolves when the accounts are loaded.
	 */
	loadCache = async password => {
		const accountsOrNull = await this.secureStorageRepository.getAccounts(password);
		this._state.privateAccounts = cloneNetworkArrayMap(accountsOrNull, this.networkIdentifiers, this._state.privateAccounts);
	};

	/**
	 * Adds a new account to the keystore.
	 * @param {string} privateKey - The private key of the new account.
	 * @param {string} networkIdentifier - The network identifier for the new account.
	 * @param {string} [password] - The password to access secure storage.
	 * @returns {Promise<AccountTypes.WalletAccount>} A promise that resolves to the newly added account without the private key.
	 * @throws {Error} If the network is not supported or if the account already exists.
	 */
	addAccount = async (privateKey, networkIdentifier, password) => {
		// Check if the network is supported
		const isNetworkSupported = this.networkIdentifiers.includes(networkIdentifier);

		if (!isNetworkSupported)
			throw new Error(`Failed to add account. Network "${networkIdentifier}" is not supported by this keystore.`);

		// Create a new private account
		const newAccount = this.sdk.createPrivateAccount(
			privateKey,
			networkIdentifier,
			WalletAccountType.EXTERNAL
		);

		// Load existing accounts from secure storage and check if the account already exists
		await this.loadCache(password);
		const { privateAccounts } = this._state;

		if (privateAccounts[networkIdentifier].some(acc => acc.publicKey === newAccount.publicKey))
			throw new Error('Failed to add account. Account already exists in the keystore.');

		privateAccounts[networkIdentifier].push(newAccount);
		
		// Save the accounts securely
		await this.secureStorageRepository.setAccounts(privateAccounts, password);
		await this.loadCache(password);

		return getAccountWithoutPrivateKey(newAccount);
	};

	/**
	 * Removes an account from the keystore.
	 * @param {string} publicKey - The public key of the account to remove.
	 * @param {string} networkIdentifier - The network identifier of the account to remove.
	 * @param {string} [password] - The password to access secure storage.
	 * @returns {Promise<void>} A promise that resolves when the account is removed.
	 * @throws {Error} If the network is not supported or if the account does not exist.
	 */
	removeAccount = async (publicKey, networkIdentifier, password) => {
		// Check if the network is supported
		const isNetworkSupported = this.networkIdentifiers.includes(networkIdentifier);

		if (!isNetworkSupported)
			throw new Error(`Failed to remove account. Network "${networkIdentifier}" is not supported by this keystore.`);


		// Load existing accounts from secure storage and find the account to remove
		await this.loadCache(password);
		const { privateAccounts } = this._state;
		const privateAccount = privateAccounts[networkIdentifier].find(acc => acc.publicKey === publicKey);

		if (!privateAccount)
			throw new Error('Failed to remove account. Account is missing in the keystore.');

		// Remove the account from the existing accounts
		privateAccounts[networkIdentifier] = privateAccounts[networkIdentifier].filter(acc => acc.publicKey !== publicKey);

		// Save the updated accounts securely
		await this.secureStorageRepository.setAccounts(privateAccounts, password);
		await this.loadCache(password);
	};

	/**
	 * Clears the keystore by resetting the state and removing all accounts from secure storage.
	 * @param {string} [password] - The password to access secure storage.
	 * @returns {Promise<void>} A promise that resolves when the keystore is cleared.
	 */
	clear = async password => {
		this._state = createDefaultState(this.networkIdentifiers);
		await this.secureStorageRepository.clear(password);
	};
}

import * as AccountTypes from '../../types/Account';
import * as NetworkTypes from '../../types/Network';
import * as StorageTypes from '../../types/Storage';
import { decodeJson } from '../../utils/storage';

/**
 * Class representing secure storage for wallet mnemonics and accounts.
 */
export class SecureStorageRepository {
	static STORAGE_KEYS = {
		MNEMONIC: 'MNEMONIC',
		ACCOUNTS: 'ACCOUNTS'
	};

	/**
	 * Create a SecureStorageRepository instance.
	 * @param {StorageTypes.StorageInterface} storage - The storage backend implementing get, set, and removeItem methods.
	 */
	constructor(storage) {
		this.storage = storage;
	}

	/**
	 * Retrieve the stored mnemonic.
	 * @returns {Promise<string|null>} The mnemonic string, or null if not set.
	 */
	getMnemonic = async () => {
		return this.storage.getItem(SecureStorageRepository.STORAGE_KEYS.MNEMONIC) || null;
	};

	/**
	 * Store the mnemonic.
	 * @param {string} payload - The mnemonic string to store.
	 * @returns {Promise<void>} - Promise resolving when the mnemonic is stored.
	 */
	setMnemonic = async payload => {
		return this.storage.setItem(SecureStorageRepository.STORAGE_KEYS.MNEMONIC, payload);
	};

	/**
	 * Retrieve the stored accounts.
	 * @returns {Promise<NetworkTypes.NetworkArrayMap<AccountTypes.PrivateAccount>>} The accounts mapped by network.
	 */
	getAccounts = async () => {
		const accounts = await this.storage.getItem(SecureStorageRepository.STORAGE_KEYS.ACCOUNTS);

		return decodeJson(accounts);
	};

	/**
	 * Store the accounts.
	 * @param {NetworkTypes.NetworkArrayMap<AccountTypes.PrivateAccount>} payload - The accounts to store.
	 * @returns {Promise<void>} - Promise resolving when the accounts are stored.
	 */
	setAccounts = async payload => {
		return this.storage.setItem(SecureStorageRepository.STORAGE_KEYS.ACCOUNTS, JSON.stringify(payload));
	};

	/**
	 * Clear all stored wallet data (mnemonic and accounts).
	 * @returns {Promise<void>} - Promise resolving when all keys are removed.
	 */
	clear = async () => {
		return Promise.all(Object.values(SecureStorageRepository.STORAGE_KEYS).map(key => this.storage.removeItem(key)));
	};
}

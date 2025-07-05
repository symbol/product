import * as AccountTypes from '../../types/Account';
import * as NetworkTypes from '../../types/Network';
import * as StorageTypes from '../../types/Storage';
import { decodeJson, decodeNullableString, encodeNullableString } from '../../utils/storage';

/* eslint-disable-next-line valid-jsdoc */
/**
 * Class representing persistent storage for wallet data.
 */
export class PersistentStorageRepository {
	static STORAGE_KEYS = {
		DATA_SCHEMA_VERSION: 'DATA_SCHEMA_VERSION',
		ACCOUNTS: 'ACCOUNTS',
		NETWORK_IDENTIFIER: 'NETWORK_IDENTIFIER',
		SELECTED_NODE: 'SELECTED_NODE',
		CURRENT_ACCOUNT_PUBLIC_KEY: 'CURRENT_ACCOUNT_PUBLIC',
		SELECTED_LANGUAGE: 'SELECTED_LANGUAGE',
		SEED_ADDRESSES: 'SEED_ADDRESSES',
		LATEST_TRANSACTIONS: 'LATEST_TRANSACTIONS',
		ACCOUNT_INFOS: 'ACCOUNT_INFOS',
		ADDRESS_BOOK: 'ADDRESS_BOOK',
		USER_CURRENCY: 'USER_CURRENCY',
		NETWORK_PROPERTIES: 'NETWORK_PROPERTIES'
	};

	/**
	 * Create a PersistentStorageRepository instance.
	 * @param {StorageTypes.StorageInterface} storage - The storage backend implementing get, set, and removeItem methods.
	 */
	constructor(storage) {
		this.storage = storage;
	}

	/**
	 * Get the current data schema version.
	 * @returns {Promise<number|null>} The current data schema version, or null if not set.
	 */
	getDataSchemaVersion = async () => {
		const version = await this.storage.getItem(PersistentStorageRepository.STORAGE_KEYS.DATA_SCHEMA_VERSION);

		return version === null ? null : parseInt(version);
	};

	/**
	 * Set the data schema version.
	 * @param {number} payload - The data schema version to set.
	 * @returns {Promise<void>} A promise that resolves when the version is set.
	 */
	setDataSchemaVersion = async payload => {
		return this.storage.setItem(PersistentStorageRepository.STORAGE_KEYS.DATA_SCHEMA_VERSION, payload.toString());
	};

	/**
	 * Get the accounts stored in persistent storage.
	 * @returns {Promise<NetworkTypes.NetworkArrayMap<AccountTypes.WalletAccount>|null>} A promise that resolves 
	 * to an array of wallet accounts or null if no accounts are stored.
	 */
	getAccounts = async () => {
		const json = await this.storage.getItem(PersistentStorageRepository.STORAGE_KEYS.ACCOUNTS);

		return decodeJson(json);
	};

	/**
	 * Set the accounts in persistent storage.
	 * @param {NetworkTypes.NetworkArrayMap<AccountTypes.WalletAccount>} payload - The accounts to set.
	 * @returns {Promise<void>} A promise that resolves when the accounts are set.
	 */
	setAccounts = async payload => {
		return this.storage.setItem(PersistentStorageRepository.STORAGE_KEYS.ACCOUNTS, JSON.stringify(payload));
	};

	/**
	 * Get the network identifier.
	 * @returns {Promise<string|null>} A promise that resolves to the network identifier or null if not set.
	 */
	getNetworkIdentifier = async () => {
		return this.storage.getItem(PersistentStorageRepository.STORAGE_KEYS.NETWORK_IDENTIFIER);
	};

	/**
	 * Set the network identifier.
	 * @param {string} payload - The network identifier to set.
	 * @returns {Promise<void>} A promise that resolves when the network identifier is set.
	 */
	setNetworkIdentifier = async payload => {
		return this.storage.setItem(PersistentStorageRepository.STORAGE_KEYS.NETWORK_IDENTIFIER, payload);
	};

	// Selected Node
	getSelectedNode = async () => {
		const nodeUrl = await this.storage.getItem(PersistentStorageRepository.STORAGE_KEYS.SELECTED_NODE);

		return decodeNullableString(nodeUrl);
	};

	setSelectedNode = async payload => {
		const encoded = encodeNullableString(payload);

		return this.storage.setItem(PersistentStorageRepository.STORAGE_KEYS.SELECTED_NODE, encoded);
	};

	// Current Account Public Key
	getCurrentAccountPublicKey = async () => {
		return this.storage.getItem(PersistentStorageRepository.STORAGE_KEYS.CURRENT_ACCOUNT_PUBLIC_KEY);
	};

	setCurrentAccountPublicKey = async payload => {
		return this.storage.setItem(PersistentStorageRepository.STORAGE_KEYS.CURRENT_ACCOUNT_PUBLIC_KEY, payload);
	};

	// Selected Language
	getSelectedLanguage = async () => {
		return this.storage.getItem(PersistentStorageRepository.STORAGE_KEYS.SELECTED_LANGUAGE);
	};

	setSelectedLanguage = async payload => {
		return this.storage.setItem(PersistentStorageRepository.STORAGE_KEYS.SELECTED_LANGUAGE, payload);
	};

	// Seed Addresses
	getSeedAddresses = async () => {
		const json = await this.storage.getItem(PersistentStorageRepository.STORAGE_KEYS.SEED_ADDRESSES);

		return decodeJson(json);
	};

	setSeedAddresses = async payload => {
		return this.storage.setItem(PersistentStorageRepository.STORAGE_KEYS.SEED_ADDRESSES, JSON.stringify(payload));
	};

	// Transactions
	getLatestTransactions = async () => {
		const json = await this.storage.getItem(PersistentStorageRepository.STORAGE_KEYS.LATEST_TRANSACTIONS);
		
		return decodeJson(json);
	};

	setLatestTransactions = async payload => {
		return this.storage.setItem(PersistentStorageRepository.STORAGE_KEYS.LATEST_TRANSACTIONS, JSON.stringify(payload));
	};

	// Account Infos
	getAccountInfos = async () => {
		const json = await this.storage.getItem(PersistentStorageRepository.STORAGE_KEYS.ACCOUNT_INFOS);

		return decodeJson(json);
	};

	setAccountInfos = async payload => {
		return this.storage.setItem(PersistentStorageRepository.STORAGE_KEYS.ACCOUNT_INFOS, JSON.stringify(payload));
	};

	// Address Book
	getAddressBook = async () => {
		const json = await this.storage.getItem(PersistentStorageRepository.STORAGE_KEYS.ADDRESS_BOOK);

		return decodeJson(json);
	};

	setAddressBook = async payload => {
		return this.storage.setItem(PersistentStorageRepository.STORAGE_KEYS.ADDRESS_BOOK, JSON.stringify(payload));
	};

	// User Currency
	getUserCurrency = async () => {
		return this.storage.getItem(PersistentStorageRepository.STORAGE_KEYS.USER_CURRENCY);
	};

	setUserCurrency = async payload => {
		return this.storage.setItem(PersistentStorageRepository.STORAGE_KEYS.USER_CURRENCY, payload);
	};

	// Network Properties
	getNetworkProperties = async () => {
		const value = await this.storage.getItem(PersistentStorageRepository.STORAGE_KEYS.NETWORK_PROPERTIES);
		
		return decodeJson(value);
	};

	setNetworkProperties = async payload => {
		return this.storage.setItem(PersistentStorageRepository.STORAGE_KEYS.NETWORK_PROPERTIES, JSON.stringify(payload));
	};

	clear = async () => {
		return Promise.all(Object.values(PersistentStorageRepository.STORAGE_KEYS).map(key => this.storage.removeItem(key))); 
	};
}

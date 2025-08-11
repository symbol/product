import { decodeJson, decodeNullableString, encodeNullableString } from '../../utils/storage';

/** @typedef {import('../../types/Account').WalletAccount} WalletAccount */
/** @typedef {import('../../types/Network').NetworkArrayMap} NetworkArrayMap */
/** @typedef {import('../../types/Network').NetworkObjectMap} NetworkObjectMap */
/** @typedef {import('../../types/Network').NetworkProperties} NetworkProperties */
/** @typedef {import('../../types/Storage').StorageInterface} StorageInterface */

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
		NETWORK_PROPERTIES: 'NETWORK_PROPERTIES',
		SELECTED_LANGUAGE: 'SELECTED_LANGUAGE'
	};

	/**
	 * Create a PersistentStorageRepository instance.
	 * @param {StorageInterface} storage - The storage backend implementing get, set, and removeItem methods.
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
	 * @returns {Promise<NetworkArrayMap<WalletAccount>|null>} A promise that resolves
	 * to a network map of wallet account arrays or null if no accounts are stored.
	 */
	getAccounts = async () => {
		const json = await this.storage.getItem(PersistentStorageRepository.STORAGE_KEYS.ACCOUNTS);

		return decodeJson(json);
	};

	/**
	 * Set the accounts in persistent storage.
	 * @param {NetworkArrayMap<WalletAccount>} payload - The accounts to set.
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

	/**
	 * Get the selected node URL.
	 * @returns {Promise<string|null>} A promise that resolves to the selected node URL or null if not set.
	 */
	getSelectedNode = async () => {
		const nodeUrl = await this.storage.getItem(PersistentStorageRepository.STORAGE_KEYS.SELECTED_NODE);

		return decodeNullableString(nodeUrl);
	};

	/**
	 * Set the selected node URL.
	 * @param {string|null} payload - The node URL to set.
	 * @returns {Promise<void>} A promise that resolves when the node URL is set.
	 */
	setSelectedNode = async payload => {
		const encoded = encodeNullableString(payload);

		return this.storage.setItem(PersistentStorageRepository.STORAGE_KEYS.SELECTED_NODE, encoded);
	};

	/**
	 * Get the public key of the current account.
	 * @returns {Promise<string|null>} A promise that resolves to the public key or null if not set.
	 */
	getCurrentAccountPublicKey = async () => {
		return this.storage.getItem(PersistentStorageRepository.STORAGE_KEYS.CURRENT_ACCOUNT_PUBLIC_KEY);
	};

	/**
	 * Set the public key of the current account.
	 * @param {string} payload - The public key to set.
	 * @returns {Promise<void>} A promise that resolves when the public key is set.
	 */
	setCurrentAccountPublicKey = async payload => {
		return this.storage.setItem(PersistentStorageRepository.STORAGE_KEYS.CURRENT_ACCOUNT_PUBLIC_KEY, payload);
	};

	/**
	 * Get the selected language.
	 * @returns {Promise<string|null>} A promise that resolves to the selected language code or null if not set.
	 */
	getSelectedLanguage = async () => {
		return this.storage.getItem(PersistentStorageRepository.STORAGE_KEYS.SELECTED_LANGUAGE);
	};

	/**
	 * Set the selected language.
	 * @param {string} payload - The language code to set.
	 * @returns {Promise<void>} A promise that resolves when the language is set.
	 */
	setSelectedLanguage = async payload => {
		return this.storage.setItem(PersistentStorageRepository.STORAGE_KEYS.SELECTED_LANGUAGE, payload);
	};

	/**
	 * Get the seed addresses.
	 * @returns {Promise<NetworkArrayMap<WalletAccount>|null>} A promise that resolves 
	 * to the seed addresses network array map or null if not set.
	 */
	getSeedAddresses = async () => {
		const json = await this.storage.getItem(PersistentStorageRepository.STORAGE_KEYS.SEED_ADDRESSES);

		return decodeJson(json);
	};

	/**
	 * Set the seed addresses.
	 * @param {NetworkArrayMap<WalletAccount>} payload - The seed addresses object to set.
	 * @returns {Promise<void>} A promise that resolves when the seed addresses are set.
	 */
	setSeedAddresses = async payload => {
		return this.storage.setItem(PersistentStorageRepository.STORAGE_KEYS.SEED_ADDRESSES, JSON.stringify(payload));
	};

	/**
	 * Get the latest transactions.
	 * @returns {Promise<NetworkObjectMap|null>} A promise that resolves to the latest transactions object or null if not set.
	 */
	getLatestTransactions = async () => {
		const json = await this.storage.getItem(PersistentStorageRepository.STORAGE_KEYS.LATEST_TRANSACTIONS);

		return decodeJson(json);
	};

	/**
	 * Set the latest transactions.
	 * @param {NetworkObjectMap} payload - The latest transactions object to set.
	 * @returns {Promise<void>} A promise that resolves when the transactions are set.
	 */
	setLatestTransactions = async payload => {
		return this.storage.setItem(PersistentStorageRepository.STORAGE_KEYS.LATEST_TRANSACTIONS, JSON.stringify(payload));
	};

	/**
	 * Get the account information.
	 * @returns {Promise<NetworkObjectMap|null>} A promise that resolves to the account information object or null if not set.
	 */
	getAccountInfos = async () => {
		const json = await this.storage.getItem(PersistentStorageRepository.STORAGE_KEYS.ACCOUNT_INFOS);

		return decodeJson(json);
	};

	/**
	 * Set the account information.
	 * @param {NetworkObjectMap} payload - The account information object to set.
	 * @returns {Promise<void>} A promise that resolves when the account information is set.
	 */
	setAccountInfos = async payload => {
		return this.storage.setItem(PersistentStorageRepository.STORAGE_KEYS.ACCOUNT_INFOS, JSON.stringify(payload));
	};

	/**
	 * Get the address book.
	 * @returns {Promise<NetworkArrayMap|null>} A promise that resolves to the address book object or null if not set.
	 */
	getAddressBook = async () => {
		const json = await this.storage.getItem(PersistentStorageRepository.STORAGE_KEYS.ADDRESS_BOOK);

		return decodeJson(json);
	};

	/**
	 * Set the address book.
	 * @param {NetworkArrayMap} payload - The address book object to set.
	 * @returns {Promise<void>} A promise that resolves when the address book is set.
	 */
	setAddressBook = async payload => {
		return this.storage.setItem(PersistentStorageRepository.STORAGE_KEYS.ADDRESS_BOOK, JSON.stringify(payload));
	};

	/**
	 * Get the user's preferred currency.
	 * @returns {Promise<string|null>} A promise that resolves to the user currency string or null if not set.
	 */
	getUserCurrency = async () => {
		return this.storage.getItem(PersistentStorageRepository.STORAGE_KEYS.USER_CURRENCY);
	};

	/**
	 * Set the user's preferred currency.
	 * @param {string} payload - The user currency string to set.
	 * @returns {Promise<void>} A promise that resolves when the user currency is set.
	 */
	setUserCurrency = async payload => {
		return this.storage.setItem(PersistentStorageRepository.STORAGE_KEYS.USER_CURRENCY, payload);
	};

	/**
	 * Get the network properties.
	 * @returns {Promise<object|null>} A promise that resolves to the network properties object or null if not set.
	 */
	getNetworkProperties = async () => {
		const value = await this.storage.getItem(PersistentStorageRepository.STORAGE_KEYS.NETWORK_PROPERTIES);

		return decodeJson(value);
	};

	/**
	 * Set the network properties.
	 * @param {object} payload - The network properties object to set.
	 * @returns {Promise<void>} A promise that resolves when the network properties are set.
	 */
	setNetworkProperties = async payload => {
		return this.storage.setItem(PersistentStorageRepository.STORAGE_KEYS.NETWORK_PROPERTIES, JSON.stringify(payload));
	};

	/**
	 * Get the selected language.
	 * @returns {Promise<string|null>} A promise that resolves to the selected language string or null if not set.
	 */
	getSelectedLanguage = async () => {
		return this.storage.getItem(PersistentStorageRepository.STORAGE_KEYS.SELECTED_LANGUAGE);
	};

	/**
	 * Set the selected language.
	 * @param {string} payload - The selected language string to set.
	 * @returns {Promise<void>} A promise that resolves when the selected language is set.
	 */
	setSelectedLanguage = async payload => {
		return this.storage.setItem(PersistentStorageRepository.STORAGE_KEYS.SELECTED_LANGUAGE, payload);
	};

	/**
	 * Clears all data managed by this repository from storage.
	 * @returns {Promise<void>} A promise that resolves when all items have been removed.
	 */
	clear = async () => {
		await Promise.all(Object.values(PersistentStorageRepository.STORAGE_KEYS).map(key => this.storage.removeItem(key)));
	};
}

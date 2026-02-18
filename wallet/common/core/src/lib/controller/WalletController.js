import { EventController } from './EventController';
import { NetworkManager } from './NetworkManager';
import {
	ControllerEventName,
	ErrorCode,
	MAX_SEED_ACCOUNTS_PER_NETWORK,
	NetworkConnectionStatus,
	REQUIRED_API_METHODS,
	REQUIRED_SDK_METHODS,
	TransactionGroup,
	WalletAccountType
} from '../../constants';
import { ControllerError } from '../../error/ControllerError';
import { validateFacade, validateNamespacedFacade } from '../../utils/helper';
import { createLogger } from '../../utils/logger';
import { cloneNetworkArrayMap, cloneNetworkObjectMap, createNetworkMap } from '../../utils/network';
import { TransactionBundle } from '../models/TransactionBundle';
import { PersistentStorageRepository } from '../storage/PersistentStorageRepository';
import { StorageInterface } from '../storage/StorageInterface';

/** @typedef {import('../../types/Account').PublicAccount} PublicAccount */
/** @typedef {import('../../types/Account').WalletAccount} WalletAccount */
/** @typedef {import('../../types/Network').NetworkArrayMap} NetworkArrayMap */
/** @typedef {import('../../types/Network').NetworkProperties} NetworkProperties */
/** @typedef {import('../../types/ProtocolNetworkApi').ProtocolNetworkApi} ProtocolNetworkApi */
/** @typedef {import('../../types/ProtocolWalletSdk').ProtocolWalletSdk} ProtocolWalletSdk */
/** @typedef {import('../../types/Transaction').Transaction} Transaction */
/** @typedef {import('../../types/Logger').Logger} Logger */

const STORAGE_ROOT_SCOPE = 'wallet';

const createDefaultState = (networkIdentifiers, createDefaultNetworkProperties) => ({
	isCacheLoaded: false, // whether cached data is loaded from the persistent storage

	// network
	networkIdentifier: networkIdentifiers[0], // selected network
	networkProperties: createDefaultNetworkProperties(networkIdentifiers[0]), // network properties for the selected network
	networkStatus: NetworkConnectionStatus.INITIAL, // 'offline' 'failed-auto' 'failed-current' 'connected'
	nodeUrls: createNetworkMap(() => [], networkIdentifiers), // node urls available for each network
	selectedNodeUrl: null, // preferred node url, selected by the user

	// wallet
	walletAccounts: createNetworkMap(() => [], networkIdentifiers), // all user accounts in the wallet without private keys
	accountInfos: createNetworkMap(() => ({}), networkIdentifiers), // account related information. See "defaultAccountInfo"
	currentAccountPublicKey: null, // selected user account public key. Used as an ID
	seedAddresses: createNetworkMap(() => [], networkIdentifiers), // list of seed addresses generated from mnemonic

	// transactions (confirmed)
	latestTransactions: createNetworkMap(() => ({}), networkIdentifiers)
});


export class WalletController {
	modules = {};

	/** @type {string} */
	#chainName;

	/** @type {string} */
	#ticker;

	/** @type {string[]} */
	networkIdentifiers;

	/** @type {function(string): Object} */
	#createDefaultNetworkProperties;

	/** @type {function(function): void} */
	#setStateProcessor;

	#notificationChannel;

	/** @type {ProtocolNetworkApi} */
	_api;

	/** @type {NetworkManager} */
	_networkManager;

	/** @type {PersistentStorageRepository} */
	_persistentStorageRepository;

	/** @type {Object} */
	_state;

	/** @type {Object} */
	_keystores;

	/**
	 * Constructs a new WalletController instance.
	 *
	 * @param {object} params - The parameters for the WalletController.
	 * @param {string} params.chainName - The the blockchain protocol name (e.g., 'symbol').
	 * @param {string} params.ticker - The ticker symbol of the main network currency (e.g., 'XYM').
	 * @param {ProtocolNetworkApi} params.api - The API instance used for network communication.
	 * @param {ProtocolWalletSdk} params.sdk - The SDK instance for blockchain interactions.
	 * @param {StorageInterface} params.persistentStorageInterface - The persistent storage provider.
	 * @param {StorageInterface} params.secureStorageInterface - The encrypted storage provider.
	 * @param {object[]} params.keystores - An array of keystore instances.
	 * @param {object[]} params.modules - An array of module constructors to be initialized.
	 * @param {string[]} params.networkIdentifiers - Network identifiers for multi-network support.
	 * @param {number} params.networkPollingInterval - Interval for network polling.
	 * @param {function(string): Object} params.createDefaultNetworkProperties - Function to create default network properties.
	 * @param {Logger} [params.logger] - Logger instance for logging.
	 * @param {function(function): void} [params.setStateProcessor] - Optional function to process state changes.
	 */
	constructor({
		chainName,
		ticker,
		api,
		sdk,
		persistentStorageInterface,
		secureStorageInterface,
		keystores,
		modules,
		networkIdentifiers,
		networkPollingInterval,
		logger,
		createDefaultNetworkProperties,
		setStateProcessor
	}) {
		validateNamespacedFacade(api, REQUIRED_API_METHODS);
		validateFacade(sdk, REQUIRED_SDK_METHODS);

		this.#chainName = chainName;
		this.#ticker = ticker;
		this._api = api;
		this.networkIdentifiers = networkIdentifiers;
		this.#createDefaultNetworkProperties = createDefaultNetworkProperties;
		this.#setStateProcessor = setStateProcessor;
		this.#notificationChannel = new EventController();

		const scopedPersistentStorageInterface = persistentStorageInterface.createScope(STORAGE_ROOT_SCOPE);
		const scopedSecureStorageInterface = secureStorageInterface.createScope(STORAGE_ROOT_SCOPE);
		this._persistentStorageRepository = new PersistentStorageRepository(scopedPersistentStorageInterface);

		this.modules = Object.fromEntries(modules.map(module => {
			const moduleName = module.constructor.name;
			module.init({
				networkIdentifiers,
				persistentStorageInterface: scopedPersistentStorageInterface.createScope(moduleName),
				secureStorageInterface: scopedSecureStorageInterface.createScope(moduleName),
				api,
				sdk,
				walletController: this,
				onStateChange: this._handleModuleStateChange
			});

			return [moduleName, module];
		}));
		this._keystores = Object.fromEntries(keystores.map(Keystore => {
			const keystoreInstance = new Keystore({
				networkIdentifiers,
				secureStorageInterface: scopedSecureStorageInterface.createScope(Keystore.type),
				sdk
			});

			return [keystoreInstance.constructor.type, keystoreInstance];
		}));
		this._networkManager = new NetworkManager({
			logger: createLogger(logger),
			api,
			networkIdentifiers,
			pollingInterval: networkPollingInterval,
			createDefaultNetworkProperties,
			onConnectionStatusChange: this._handleNetworkConnectionStatusChange,
			onPropertiesUpdate: this._handleNetworkPropertiesUpdate,
			onChainEvent: this._handleChainEvent
		});

		this.resetState();
	}

	/**
	 * Returns the blockchain protocol name.
	 * @returns {string} - The blockchain protocol name.
	 */
	get chainName() {
		return this.#chainName;
	}

	/**
	 * Returns the network API instance.
	 * @returns {ProtocolNetworkApi} - The network API instance.
	 */
	get networkApi() {
		return this._api;
	}

	/**
	 * Returns the ticker symbol of the main network currency.
	 * @returns {string} - The ticker symbol of the main network currency.
	 */
	get ticker() {
		return this.#ticker;
	}

	/**
	 * Returns true if wallet contains at least one account.
	 * @returns {boolean} - true if wallet has accounts, false otherwise.
	 */
	get hasAccounts() {
		let hasAccounts = false;

		Object.values(this._state.walletAccounts).forEach(networkAccounts => {
			if (networkAccounts.length > 0)
				hasAccounts = true;
		});

		return hasAccounts;
	}

	/**
	 * Returns all user accounts in the wallet.
	 * @returns {NetworkArrayMap<WalletAccount>} - All user accounts grouped by network.
	 */
	get accounts() {
		return this._state.walletAccounts;
	}

	/**
	 * Returns account infos of all the user accounts in the wallet.
	 * @returns {NetworkArrayMap<object>} - Account infos grouped by network.
	 */
	get accountInfos() {
		return this._state.accountInfos;
	}

	/**
	 * Returns seed addresses generated from mnemonic.
	 * @returns {NetworkArrayMap<PublicAccount>} - Seed accounts grouped by network.
	 */
	get seedAddresses() {
		return this._state.seedAddresses;
	}

	/**
	 * Returns the currently selected user account.
	 * @returns {WalletAccount|null} - The currently selected user account or null if not selected.
	 */
	get currentAccount() {
		const { currentAccountPublicKey, walletAccounts, networkIdentifier } = this._state;
		const currentAccount = walletAccounts[networkIdentifier].find(account => account.publicKey === currentAccountPublicKey);

		return currentAccount || null;
	}

	/**
	 * Returns the currently selected user account information.
	 * @returns {object|null} - The currently selected user account information or null if not loaded.
	 */
	get currentAccountInfo() {
		const { accountInfos, currentAccountPublicKey, networkIdentifier } = this._state;
		return accountInfos[networkIdentifier][currentAccountPublicKey] || null;
	}

	/**
	 * Returns the list of latest transactions for the currently selected user account.
	 * @returns {Array<Transaction>} - The list of latest transactions or an empty array if not loaded.
	 */
	get currentAccountLatestTransactions() {
		const { latestTransactions, currentAccountPublicKey, networkIdentifier } = this._state;
		return latestTransactions[networkIdentifier][currentAccountPublicKey] || [];
	}

	/**
	 * Returns the network identifier of the selected network.
	 * @returns {string} - The network identifier.
	 */
	get networkIdentifier() {
		return this._state.networkIdentifier;
	}

	/**
	 * Returns the network properties of the selected network.
	 * @returns {object} - The network properties.
	 */
	get networkProperties() {
		return this._state.networkProperties;
	}

	/**
	 * Returns the selected node URL.
	 * @returns {string} - The selected node URL.
	 */
	get selectedNodeUrl() {
		return this._state.selectedNodeUrl;
	}

	/**
	 * Returns the network status.
	 * @returns {string} - The network status.
	 */
	get networkStatus() {
		return this._state.networkStatus;
	}

	/**
	 * Returns true if network connection is ready for making requests.
	 * @returns {boolean} - True if network connection is ready, false otherwise.
	 */
	get isNetworkConnectionReady() {
		return this.networkStatus === NetworkConnectionStatus.CONNECTED;
	}

	/**
	 * Returns true if wallet state is loaded from cache.
	 * @returns {boolean} - True if wallet state is ready, false otherwise.
	 */
	get isStateReady() {
		return this._state.isCacheLoaded;
	}

	/**
	 * Returns true if wallet state is loaded from cache and network connection is ready.
	 * @returns {boolean} - True if wallet is ready, false otherwise.
	 */
	get isWalletReady() {
		return this.isStateReady && this.isNetworkConnectionReady;
	}

	#accessKeystore = type => {
		const keystore = this._keystores[type];

		if (!keystore) {
			throw new ControllerError(
				`Failed to access keystore. "${type}" keystore is not available.`,
				ErrorCode.FAILED_ACCESS_KEYSTORE
			);
		}

		return keystore;
	};

	/**
	 * Initialize the wallet controller and load the cache from the storage
	 * @param {string} [password] - wallet password
	 * @returns {Promise<void>} - a promise that resolves when the cache is loaded
	 */
	loadCache = async password => {
		const [
			walletAccounts,
			accountInfos,
			seedAddresses,
			currentAccountPublicKey,
			networkIdentifier,
			networkProperties,
			latestTransactions,
			selectedNodeUrl
		] = await Promise.all([
			this._persistentStorageRepository.getAccounts(),
			this._persistentStorageRepository.getAccountInfos(),
			this._persistentStorageRepository.getSeedAddresses(),
			this._persistentStorageRepository.getCurrentAccountPublicKey(),
			this._persistentStorageRepository.getNetworkIdentifier(),
			this._persistentStorageRepository.getNetworkProperties(),
			this._persistentStorageRepository.getLatestTransactions(),
			this._persistentStorageRepository.getSelectedNode()
		]);

		this.resetState();
		const defaultState = createDefaultState(this.networkIdentifiers, this.#createDefaultNetworkProperties);
		const finalNetworkIdentifier = networkIdentifier || this.networkIdentifiers[0];
		const finalNetworkProperties = networkProperties || defaultState.networkProperties;
		const finalSelectedNodeUrl = selectedNodeUrl || defaultState.selectedNodeUrl;
		this.#setState(() => {
			this._state.walletAccounts = cloneNetworkArrayMap(
				walletAccounts,
				this.networkIdentifiers,
				defaultState.walletAccounts
			);
			this._state.accountInfos = cloneNetworkObjectMap(
				accountInfos,
				this.networkIdentifiers,
				defaultState.accountInfos
			);
			this._state.seedAddresses = cloneNetworkArrayMap(
				seedAddresses,
				this.networkIdentifiers,
				defaultState.seedAddresses
			);
			this._state.currentAccountPublicKey = currentAccountPublicKey;
			this._state.networkIdentifier = finalNetworkIdentifier;
			this._state.networkProperties = finalNetworkProperties;
			this._state.latestTransactions = cloneNetworkObjectMap(
				latestTransactions,
				this.networkIdentifiers,
				defaultState.latestTransactions
			);
			this._state.selectedNodeUrl = finalSelectedNodeUrl;
			this._state.isCacheLoaded = true;
		});

		this._networkManager.init(finalNetworkIdentifier, finalNetworkProperties, finalSelectedNodeUrl);

		await Promise.all(Object.values(this._keystores)
			.filter(keystore => keystore.loadCache)
			.map(keystore => keystore.loadCache(password)));

		await Promise.all(Object.values(this.modules)
			.filter(module => module.loadCache)
			.map(module => module.loadCache()));

		if (currentAccountPublicKey)
			this.selectAccount(currentAccountPublicKey);
	};

	/**
	 * Select wallet account
	 * @param {string} publicKey - account public key
	 * @returns {Promise<WalletAccount>} - a promise that resolves when the account is selected
	 */
	selectAccount = async publicKey => {
		const { walletAccounts, networkIdentifier } = this._state;
		const accountToSelect = walletAccounts[networkIdentifier].find(account => account.publicKey === publicKey);

		if (!accountToSelect) {
			throw new ControllerError(
				'Failed to select account. Account is missing in the wallet',
				ErrorCode.WALLET_SELECTED_ACCOUNT_MISSING
			);
		}

		await this._persistentStorageRepository.setCurrentAccountPublicKey(publicKey);
		this.#setState(() => {
			this._state.currentAccountPublicKey = publicKey;
		});

		this._emit(ControllerEventName.ACCOUNT_CHANGE);

		this._networkManager.setListenAddress(accountToSelect.address);

		return accountToSelect;
	};

	/**
	 * Setup a new wallet. Save the mnemonic, generate accounts and select the first account
	 * @param {object} options - wallet setup options
	 * @param {string} options.mnemonic - mnemonic phrase
	 * @param {string} options.name - first account name
	 * @param {number} options.accountPerNetworkCount - number of accounts to generate per network
	 * @param {string} [password] - wallet password
	 * @returns {Promise<WalletAccount>} - a promise that resolves when the wallet is created to the selected account
	 */
	saveMnemonicAndGenerateAccounts = async ({ mnemonic, name, accountPerNetworkCount = MAX_SEED_ACCOUNTS_PER_NETWORK }, password) => {
		// Create wallet in mnemonic keystore and get seed accounts
		const mnemonicKeystore = this.#accessKeystore(WalletAccountType.MNEMONIC);
		await mnemonicKeystore.createWallet(mnemonic, accountPerNetworkCount, password);
		const seedAccounts = await mnemonicKeystore.getAccounts();
		const walletAccounts = createNetworkMap(
			networkIdentifier =>
				[{ ...seedAccounts[networkIdentifier][0], name }],
			this.networkIdentifiers
		);

		// Save accounts (without private keys) to persistent storage
		await this.#setAccounts(walletAccounts);
		await this._persistentStorageRepository.setSeedAddresses(seedAccounts);
		this.#setState(() => {
			this._state.seedAddresses = seedAccounts;
		});

		// Select first account
		const currentAccount = walletAccounts[this._state.networkIdentifier][0];

		return this.selectAccount(currentAccount.publicKey);
	};

	/**
	 * Add seed account from mnemonic or hardware wallet
	 * @param {object} options - account options
	 * @param {string} options.name - account name
	 * @param {string} options.networkIdentifier - network identifier
	 * @param {number} options.index - account index
	 * @param {string} options.type - account keystore type (e.g. 'mnemonic', 'hardware')
	 * @returns {Promise<WalletAccount>} - a promise that resolves to the added account object
	 */
	addSeedAccount = async ({ name, networkIdentifier, index, type = WalletAccountType.MNEMONIC }) => {
		// Add account FROM keystore (by index)
		const keystore = this.#accessKeystore(type);
		const account = await keystore.getSeedAccount(networkIdentifier, index);
		account.name = name;

		// Add account to the wallet
		return this.#addAccount(account);
	};

	/**
	 * Add a new account to the wallet
	 * @param {object} options - account options
	 * @param {string} options.privateKey - account private key
	 * @param {string} options.name - account name
	 * @param {string} options.networkIdentifier - network identifier of the account
	 * @param {string} [password] - wallet password
	 * @returns {Promise<WalletAccount>} - a promise that resolves when the account is added
	 */
	addExternalAccount = async ({ privateKey, name, networkIdentifier }, password) => {
		// Add account TO keystore (by private key)
		const keystore = this.#accessKeystore(WalletAccountType.EXTERNAL);
		const account = await keystore.addAccount(privateKey, networkIdentifier, password);
		account.name = name;

		// Add account to the wallet
		return this.#addAccount(account);
	};

	/**
	 * Add an account to the wallet. Used internally by addSeedAccount and addExternalAccount methods.
	 * @param {WalletAccount} account - account object to add
	 * @returns {Promise<WalletAccount>} - a promise that resolves when the account is added
	 * @throws {ControllerError} - if the account already exists in the wallet
	 */
	#addAccount = async account => {
		// Load existing accounts from persistent storage
		const accounts = await this.#loadAccounts();
		const networkAccounts = accounts[account.networkIdentifier];

		// Check if the account already in the wallet
		const isAccountAlreadyExists = networkAccounts.find(acc => account.publicKey === acc.publicKey);

		if (isAccountAlreadyExists) {
			throw new ControllerError(
				'Failed to add account. Account already exists in the wallet.',
				ErrorCode.WALLET_ADD_ACCOUNT_ALREADY_EXISTS
			);
		}

		// Add account to the existing accounts
		networkAccounts.push(account);
		await this.#setAccounts(accounts);

		return account;
	};

	/**
	 * Rename wallet account
	 * @param {object} options - account options
	 * @param {string} options.networkIdentifier - network identifier of the account
	 * @param {string} options.publicKey - account public key
	 * @param {string} options.name - new account name
	 * @returns {Promise<void>} - a promise that resolves when the account is renamed
	 */
	renameAccount = async ({ networkIdentifier, publicKey, name }) => {
		const account = this.#getAccount(networkIdentifier, publicKey);
		account.name = name;
		const accounts = await this.#loadAccounts();

		const updatedAccounts = createNetworkMap(currentNetworkIdentifier => {
			if (currentNetworkIdentifier === networkIdentifier) {
				return accounts[currentNetworkIdentifier].map(acc =>
					acc.publicKey === publicKey ? account : acc);
			}
			return accounts[currentNetworkIdentifier];
		}, this.networkIdentifiers);

		await this.#setAccounts(updatedAccounts);
	};

	/**
	 * Remove account from the wallet
	 * @param {object} options - account options
	 * @param {string} options.networkIdentifier - network identifier of the account
	 * @param {string} options.publicKey - account public key
	 * @param {string} [password] - wallet password
	 * @returns {Promise<void>} - a promise that resolves when the account is removed
	 */
	removeAccount = async ({ networkIdentifier, publicKey }, password) => {
		// Prevent removing the currently selected account
		if (this._state.currentAccountPublicKey === publicKey) {
			throw new ControllerError(
				'Cannot remove the currently selected account',
				ErrorCode.WALLET_REMOVE_CURRENT_ACCOUNT
			);
		}

		// Load accounts from storage and remove the account
		const account = this.#getAccount(networkIdentifier, publicKey);
		const isExternalAccount = account.accountType === WalletAccountType.EXTERNAL;

		if (isExternalAccount) {
			// Remove account from the keystore
			const keystore = this.#accessKeystore(WalletAccountType.EXTERNAL);
			await keystore.removeAccount(networkIdentifier, publicKey, password);
		}

		// Load existing accounts from persistent storage
		const accounts = await this.#loadAccounts();
		const updatedAccounts = createNetworkMap(currentNetworkIdentifier => {
			if (currentNetworkIdentifier === networkIdentifier) {
				return accounts[currentNetworkIdentifier].filter(acc =>
					acc.publicKey !== publicKey);
			}
			return accounts[currentNetworkIdentifier];
		}, this.networkIdentifiers);

		// Update the accounts in the storage and load them to the state
		await this.#setAccounts(updatedAccounts);
	};

	#getAccount = (networkIdentifier, publicKey) => {
		const { walletAccounts } = this._state;
		const accounts = walletAccounts[networkIdentifier];

		if (!accounts) {
			throw new ControllerError(
				`Failed to get account. Network "${networkIdentifier}" is not supported by the wallet.`,
				ErrorCode.WALLET_ACCOUNT_NOT_FOUND
			);
		}

		const account = accounts.find(account => account.publicKey === publicKey);

		if (!account) {
			throw new ControllerError(
				`Failed to get account. Account with public key "${publicKey}" is not found in the wallet.`,
				ErrorCode.WALLET_ACCOUNT_NOT_FOUND
			);
		}

		return { ...account };
	};

	/**
	 * Change accounts order
	 * @param {string} networkIdentifier - network identifier
	 * @param {Array} accountsOrder - array of account objects with public key
	 * @returns {Promise<void>} - a promise that resolves when the accounts order is changed
	 */
	changeAccountsOrder = async (networkIdentifier, accountsOrder) => {
		const accountsPublicKeys = accountsOrder.map(account => account.publicKey);
		const accounts = await this.#loadAccounts();
		accounts[networkIdentifier] = accounts[networkIdentifier].sort((a, b) => {
			return accountsPublicKeys.indexOf(a.publicKey) - accountsPublicKeys.indexOf(b.publicKey);
		});

		await this.#setAccounts(accounts);
	};

	/**
	 * Set accounts in the state and persistent storage
	 * @param {NetworkArrayMap<WalletAccount>} accounts - array of accounts to set
	 * @returns {Promise<void>} - a promise that resolves when the accounts are set
	 */
	#setAccounts = async accounts => {
		await this._persistentStorageRepository.setAccounts(accounts);
		this.#setState(() => {
			this._state.walletAccounts = accounts;
		});
	};

	/**
	 * Loads accounts from the persistent storage and returns them safely handled empty values.
	 * @returns {Promise<NetworkArrayMap<WalletAccount>>} - a promise that resolves to the accounts array map
	 */
	#loadAccounts = async () => {
		const accounts = await this._persistentStorageRepository.getAccounts();
		const defaultState = createDefaultState(this.networkIdentifiers, this.#createDefaultNetworkProperties);

		return cloneNetworkArrayMap(accounts, this.networkIdentifiers, defaultState.walletAccounts);
	};

	/**
	 * Fetch current account info
	 * @returns {Promise<object>} - account info
	 */
	fetchAccountInfo = async () => {
		const { networkIdentifier, networkProperties, currentAccountPublicKey: publicKey } = this._state;

		const baseAccountInfo = await this._api.account.fetchAccountInfo(networkProperties, this.currentAccount.address);
		const fetchedAt = Date.now();
		let accountInfo;

		if (baseAccountInfo)
			accountInfo = { ...baseAccountInfo, fetchedAt };
		else
			accountInfo = { fetchedAt };

		const accountInfosOrNull = await this._persistentStorageRepository.getAccountInfos();
		const accountInfos = cloneNetworkObjectMap(accountInfosOrNull, this.networkIdentifiers, this._state.accountInfos);
		accountInfos[networkIdentifier][publicKey] = accountInfo;

		await this._persistentStorageRepository.setAccountInfos(accountInfos);
		this.#setState(() => {
			this._state.accountInfos = accountInfos;
		});
		this._emit(ControllerEventName.ACCOUNT_INFO_CHANGE, accountInfo);

		return accountInfo;
	};

	/**
	 * Fetch current account transactions
	 * @param {object} options - fetch options
	 * @param {string} options.group - 'confirmed', 'unconfirmed' or 'partial'
	 * @param {number} options.pageNumber - page number
	 * @param {number} options.pageSize - page size
	 * @param {object} options.filter - filter object
	 * @returns {Promise<Array>} - a promise that resolves to the list of transactions
	 */
	fetchAccountTransactions = async (options = {}) => {
		const { group = TransactionGroup.CONFIRMED, pageNumber = 1, pageSize = 15, filter = {} } = options;
		const { networkIdentifier, networkProperties } = this._state;
		const { publicKey } = this.currentAccount;

		// Fetch transactions from chain
		const transactions = await this._api.transaction.fetchAccountTransactions(networkProperties, this.currentAccount, {
			group,
			filter,
			pageNumber,
			pageSize
		});

		// Cache transactions for current account
		const isFilterActivated = filter && Object.keys(filter).length > 0;
		if (!isFilterActivated && group === TransactionGroup.CONFIRMED && pageNumber === 1) {
			const latestTransactionsOrNull = await this._persistentStorageRepository.getLatestTransactions();
			const defaultState = createDefaultState(this.networkIdentifiers, this.#createDefaultNetworkProperties);
			const latestTransactions = cloneNetworkObjectMap(
				latestTransactionsOrNull,
				this.networkIdentifiers,
				defaultState.latestTransactions
			);
			latestTransactions[networkIdentifier][publicKey] = transactions;

			await this._persistentStorageRepository.setLatestTransactions(latestTransactions);
			this.#setState(() => {
				this._state.latestTransactions = latestTransactions;
			});
		}

		return transactions;
	};

	/**
	 * Fetch transaction status by transaction hash
	 * @param {string} transactionHash - transaction hash
	 * @returns {Promise<{group: string}>} - transaction status object
	 */
	fetchTransactionStatus = async transactionHash => {
		const { networkProperties } = this._state;

		return this._api.transaction.fetchTransactionStatus(networkProperties, transactionHash);
	};

	/**
	 * Return wallet mnemonic passphrase from the secure storage
	 * @returns {Promise<string>} - mnemonic passphrase
	 */
	getMnemonic = async () => {
		const mnemonicKeystore = this.#accessKeystore(WalletAccountType.MNEMONIC);

		return mnemonicKeystore.getMnemonic();
	};

	/**
	 * Return current account private key from the secure storage
	 * @returns {Promise<string>} - account private key
	 */
	getCurrentAccountPrivateKey = async () => {
		const keystore = this.#accessKeystore(this.currentAccount.accountType);

		return keystore.getPrivateKey(this.currentAccount);
	};

	/**
	 * Sign transaction with the current account private key
	 * @param {TransactionBundle} transactionBundle - transaction bundle
	 * @returns {Promise<TransactionBundle>} - signed transaction object
	 */
	signTransactionBundle = async transactionBundle => {
		const keystore = this.#accessKeystore(this.currentAccount.accountType);

		return keystore.signTransactionBundle(this.networkProperties, transactionBundle, this.currentAccount);
	};

	/**
	 * Sign transaction with the current account private key
	 * @param {Transaction} transaction - transaction
	 * @returns {Promise<object>} - signed transaction object
	 */
	signTransaction = async transaction => {
		const keystore = this.#accessKeystore(this.currentAccount.accountType);

		return keystore.signTransaction(this.networkProperties, transaction, this.currentAccount);
	};

	/**
	 * Add current account signature to partial transaction
	 * @param {object} transaction - partial transaction
	 * @returns {Promise<object>} - cosigned transaction object
	 */
	cosignTransaction = async transaction => {
		const keystore = this.#accessKeystore(this.currentAccount.accountType);

		return keystore.cosignTransaction(transaction, this.currentAccount);
	};

	/**
	 * Announce signed transaction
	 * @param {object} signedTransaction - signed transaction object
	 * @param {string} [group] - transaction group ('default', 'partial' or 'cosignature')
	 * @returns {Promise<object>} - transaction announce result
	 */
	announceSignedTransaction = async (signedTransaction, group) => {
		return this._api.transaction.announceTransaction(this.networkProperties, signedTransaction, group);
	};

	/**
	 * Announce signed transaction
	 * @param {TransactionBundle} signedTransactionBundle - signed transaction bundle
	 * @param {string} [group] - transaction group ('default', 'partial' or 'cosignature')
	 * @returns {Promise<object>} - transaction announce result
	 */
	announceSignedTransactionBundle = async (signedTransactionBundle, group) => {
		return this._api.transaction.announceTransactionBundle(this.networkProperties, signedTransactionBundle, group);
	};

	/**
	 * Encrypt message with recipient public key and current account private key
	 * @param {string} messageText - message text to encrypt
	 * @param {string} publicKey - second party (sender or recipient) public key
	 * @returns {Promise<string>} - encrypted message HEX payload
	 */
	encryptMessage = async (messageText, publicKey) => {
		const keystore = this.#accessKeystore(this.currentAccount.accountType);

		return keystore.encryptMessage(messageText, publicKey, this.currentAccount);
	};

	/**
	 * Decrypt message with sender (or recipient) public key and current account private key
	 * @param {string} encryptedMessage - encrypted message HEX payload
	 * @param {string} publicKey - second party (sender or recipient) public key
	 * @returns {Promise<string>} - decrypted message text
	 */
	decryptMessage = async (encryptedMessage, publicKey) => {
		const keystore = this.#accessKeystore(this.currentAccount.accountType);

		return keystore.decryptMessage(encryptedMessage, publicKey, this.currentAccount);
	};

	/**
	 * Clear all the data from the state, storage and remove all accounts
	 * @param {string} [password] - wallet storage password
	 * @returns {Promise<void>} - a promise that resolves when the clear is completed
	 */
	clear = async password => {
		// Clear all persistent and secure storages
		await this._persistentStorageRepository.clear();
		await Promise.all(Object.values(this._keystores)
			.filter(keystore => keystore.clear)
			.map(keystore => keystore.clear(password)));
		await Promise.all(Object.values(this.modules)
			.filter(module => module.clear)
			.map(module => module.clear()));

		this._networkManager.stopConnectionJob();
		this.resetState();
		this._emit(ControllerEventName.WALLET_CLEAR);
	};

	/**
	 * Connect to the network and start polling for network properties
	 * @returns {Promise<void>} - a promise that resolves when the connection run is completed
	 */
	connectToNetwork = async () => {
		await this._networkManager.runConnectionJob();
	};

	/**
	 * Select network and node
	 * @param {string} networkIdentifier - network identifier
	 * @param {string} [nodeUrl] - node url
	 * @returns {Promise<void>} - a promise that resolves when the network is selected
	 */
	selectNetwork = async (networkIdentifier, nodeUrl = null) => {
		if (!this.networkIdentifiers.includes(networkIdentifier)) {
			throw new ControllerError(
				`Failed to select network. Network "${networkIdentifier}" is not supported by the wallet.`,
				ErrorCode.WALLET_NETWORK_NOT_SUPPORTED
			);
		}

		const accounts = this._state.walletAccounts[networkIdentifier];
		const defaultNetworkProperties = this.#createDefaultNetworkProperties(networkIdentifier);

		await this._persistentStorageRepository.setNetworkProperties(defaultNetworkProperties);
		await this._persistentStorageRepository.setNetworkIdentifier(networkIdentifier);
		await this._persistentStorageRepository.setSelectedNode(nodeUrl);
		this.#setState(() => {
			this._state.networkIdentifier = networkIdentifier;
			this._state.networkProperties = defaultNetworkProperties;
			this._state.selectedNodeUrl = nodeUrl;
			this._state.networkStatus = NetworkConnectionStatus.INITIAL;
		});

		this._networkManager.selectNetwork(networkIdentifier, nodeUrl);
		this._emit(ControllerEventName.NETWORK_CHANGE);

		if (this.hasAccounts)
			await this.selectAccount(accounts[0].publicKey);
	};

	/**
	 * Callback handler for network connection status change
	 * @param {NetworkConnectionStatus} networkConnectionStatus - new network connection status
	 * @private
	 */
	_handleNetworkConnectionStatusChange = networkConnectionStatus => {
		const isStatusChanged = this._state.networkStatus !== networkConnectionStatus;

		if (!isStatusChanged)
			return;
		
		this.#setState(() => {
			this._state.networkStatus = networkConnectionStatus;
		});
		this._emit(ControllerEventName.NETWORK_STATUS_CHANGE, networkConnectionStatus);

		if (networkConnectionStatus === NetworkConnectionStatus.CONNECTED)
			this._emit(ControllerEventName.NETWORK_CONNECTED);
	};

	/**
	 * Callback handler for network properties update
	 * @param {NetworkProperties} networkProperties - new network properties
	 * @private
	 */
	_handleNetworkPropertiesUpdate = async networkProperties => {
		await this._persistentStorageRepository.setNetworkProperties(networkProperties);
		this.#setState(() => {
			this._state.networkProperties = networkProperties;
		});

		this._emit(ControllerEventName.NETWORK_PROPERTIES_CHANGE, networkProperties);
	};

	/**
	 * Callback handler for chain events
	 * @param {string} eventName - name of the event
	 * @param {object} payload - event payload
	 * @private
	 */
	_handleChainEvent = async (eventName, payload) => {
		this._emit(eventName, payload);
	};

	_handleModuleStateChange = () => {
		this._emit(ControllerEventName.STATE_CHANGE);
	};

	/**
	 * Reset the wallet state to the default values
	 */
	resetState = () => {
		this._state = createDefaultState(this.networkIdentifiers, this.#createDefaultNetworkProperties);

		Object.values(this.modules).forEach(module => module.resetState?.());

		this._emit(ControllerEventName.STATE_CHANGE);
	};

	#setState = callback => {
		if (this.#setStateProcessor) {
			this.#setStateProcessor(callback);
		} else {
			callback.bind(this);
			callback();
		}

		this._emit(ControllerEventName.STATE_CHANGE);
	};

	/**
	 * Subscribe to the controller events
	 * @param {string} eventName - event name
	 * @param {Function} listener - callback function
	 * @returns {void}
	 */
	on = (eventName, listener) => {
		this.#notificationChannel.on(eventName, listener);
	};

	/**
	 * Unsubscribe from the controller events
	 * @param {string} eventName - event name
	 * @param {Function} listener - callback function
	 * @returns {void}
	 */
	removeListener = (eventName, listener) => {
		this.#notificationChannel.removeListener(eventName, listener);
	};

	/**
	 * Emit controller event
	 * @param {string} eventName - event name
	 * @param {object} payload - event payload
	 * @returns {void}
	 * @private
	 */
	_emit = (eventName, payload) => {
		this.#notificationChannel.emit(eventName, payload);
	};
}

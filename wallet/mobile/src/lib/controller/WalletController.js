import { cloneDeep, omit } from 'lodash';
import SafeEventEmitter from '@metamask/safe-event-emitter';
import { makeAutoObservable, runInAction } from 'mobx';
import { config } from '@/app/config';
import {
    ControllerEventName,
    DEFAULT_ACCOUNT_NAME,
    MAX_SEED_ACCOUNTS_PER_NETWORK,
    NetworkConnectionStatus,
    NetworkIdentifier,
    TransactionAnnounceGroup,
    TransactionGroup,
    TransactionType,
    WalletAccountType,
} from '@/app/constants';
import { AccountService, ListenerService, NamespaceService, NetworkService, TransactionService } from '@/app/lib/services';
import { addressFromPublicKey, createWalletAccount, createWalletStorageAccount, publicAccountFromPublicKey } from '@/app/utils/account';
import { createNetworkMap } from '@/app/utils/network';
import { createPrivateKeysFromMnemonic } from '@/app/utils/wallet';
import { cosignTransaction, decryptMessage, encryptMessage, signTransaction } from '@/app/utils';
import { AppError } from '@/app/lib/error';

const defaultNetworkProperties = {
    nodeUrl: null, // currently connected node url. Used for fetching the data
    networkIdentifier: null, // currently connected network identifier (e.g. "mainnet", "testnet")
    generationHash: null,
    epochAdjustment: null, // used in date-time calculations (e.g. transaction deadline, timestamp, etc.)
    transactionFees: {
        minFeeMultiplier: null,
        averageFeeMultiplier: null,
    },
    networkCurrency: {
        // network currency mosaic. By default is "symbol.xym"
        mosaicId: null,
        divisibility: null,
    },
    chainHeight: null, // node chain height
};

const defaultAccountInfo = {
    isLoaded: false,
    isMultisig: false, // wether account is multisig
    cosignatories: [], // if an account is multisig, contains the list of its cosigners
    multisigAddresses: [], // list of multisig addresses which the account is cosignatory of
    balance: 0, // currency mosaic amount
    mosaics: [], // account owned mosaics
    namespaces: [], // account owned namespaces
    importance: 0,
    linkedKeys: {
        linkedPublicKey: null,
        nodePublicKey: null,
        vrfPublicKey: null,
    },
};

const defaultState = {
    isCacheLoaded: false, // whether cached data is loaded from the persistent storage

    // network
    chainHeight: null, // current chain height
    chainListener: null, // listener instance
    networkConnectionTimer: null,
    networkIdentifier: NetworkIdentifier.MAIN_NET, // selected network
    networkProperties: cloneDeep(defaultNetworkProperties), // network and chain info fetched from currently connected node
    networkStatus: NetworkConnectionStatus.INITIAL, // 'offline' 'failed-auto' 'failed-current' 'connected'
    nodeUrls: createNetworkMap(() => []), // node urls available for each network
    selectedNodeUrl: null, // preferred node url, selected by the user

    // wallet
    accountInfos: createNetworkMap(() => ({})), // account related information. See "defaultAccountInfo"
    currentAccount: null, // selected user account
    currentAccountPublicKey: null, // selected user account public key. Used as an ID
    mosaicInfos: createNetworkMap(() => ({})),
    seedAddresses: createNetworkMap(() => []), // list of seed addresses generated from mnemonic
    walletAccounts: createNetworkMap(() => []), // all user accounts in the wallet

    // transactions (confirmed)
    latestTransactions: createNetworkMap(() => ({})),
};

export class WalletController {
    modules = {};

    /** @type {SafeEventEmitter} */
    _notificationChannel;

    /** @type {Object} */
    _persistentStorage;

    /** @type {Object} */
    _secureStorage;

    /** @type {defaultState} */
    _state;

    constructor({ persistentStorage, secureStorage, isObservable, modules = [] }) {
        this._state = cloneDeep(defaultState);

        if (isObservable) makeAutoObservable(this);

        this._notificationChannel = new SafeEventEmitter();
        this._persistentStorage = persistentStorage;
        this._secureStorage = secureStorage;
        this.modules = Object.fromEntries(
            modules.map((Module) => {
                const moduleInstance = new Module({ root: this, isObservable });

                return [moduleInstance.name, moduleInstance];
            })
        );
    }

    // all user accounts in the wallet. Grouped by network
    get accounts() {
        return this._state.walletAccounts;
    }

    // account infos of all the user accounts in the wallet. Grouped by network
    get accountInfos() {
        return this._state.accountInfos;
    }

    // seed addresses generated from mnemonic. Grouped by network
    get seedAddresses() {
        return this._state.seedAddresses;
    }

    // currently selected user account
    get currentAccount() {
        return this._state.currentAccount;
    }

    // currently selected user account information
    get currentAccountInfo() {
        const { accountInfos, currentAccountPublicKey, networkIdentifier } = this._state;
        return accountInfos[networkIdentifier][currentAccountPublicKey] || defaultAccountInfo;
    }

    // the list of latest transactions for the currently selected account
    get currentAccountLatestTransactions() {
        const { latestTransactions, currentAccountPublicKey, networkIdentifier } = this._state;
        return latestTransactions[networkIdentifier][currentAccountPublicKey] || [];
    }

    // network identifier of the selected network
    get networkIdentifier() {
        return this._state.networkIdentifier;
    }

    // network and chain info fetched from currently connected node
    get networkProperties() {
        const { networkProperties, nodeUrls } = this._state;
        return {
            ...networkProperties,
            nodeUrls: nodeUrls[networkProperties.networkIdentifier],
        };
    }

    // current chain height
    get chainHeight() {
        return this._state.chainHeight;
    }

    // node urls available for each network
    get nodeUrls() {
        return this._state.nodeUrls;
    }

    // preferred node url, selected by the user
    get selectedNodeUrl() {
        return this._state.selectedNodeUrl;
    }

    // network connection is ready for making requests
    get isNetworkConnectionReady() {
        return this.networkStatus === NetworkConnectionStatus.CONNECTED && !!this.networkProperties.nodeUrl;
    }

    // wallet cache is loaded from the storage
    get isStateReady() {
        return this._state.isCacheLoaded;
    }

    // wallet cache is loaded and network connection is ready
    get isWalletReady() {
        return this._state.isCacheLoaded && this.isNetworkConnectionReady;
    }

    // network connection status
    get networkStatus() {
        return this._state.networkStatus;
    }

    // native currency symbol
    get ticker() {
        return config.ticker;
    }

    /**
     * Returns true if the wallet contains at least one account
     * @returns {Promise<boolean>}
     */
    isWalletCreated = async () => {
        return await this._secureStorage.isAccountsValueSet();
    };

    /**
     * Initialize the wallet controller and load the cache from the storage
     * @param {string} [password] - wallet password
     * @returns {Promise<void>}
     */
    loadCache = async (password) => {
        const [
            accountInfos,
            seedAddresses,
            currentAccountPublicKey,
            networkIdentifier,
            networkProperties,
            latestTransactions,
            selectedNodeUrl,
        ] = await Promise.all([
            this._persistentStorage.getAccountInfos(),
            this._persistentStorage.getSeedAddresses(),
            this._persistentStorage.getCurrentAccountPublicKey(),
            this._persistentStorage.getNetworkIdentifier(),
            this._persistentStorage.getNetworkProperties(),
            this._persistentStorage.getLatestTransactions(),
            this._persistentStorage.getSelectedNode(),
        ]);

        this.clearState();
        await this._loadAccounts(password);
        runInAction(() => {
            this._state.accountInfos = accountInfos;
            this._state.seedAddresses = seedAddresses;
            this._state.currentAccountPublicKey = currentAccountPublicKey;
            this._state.networkIdentifier = networkIdentifier;
            this._state.networkProperties = networkProperties || defaultNetworkProperties;
            this._state.latestTransactions = latestTransactions;
            this._state.selectedNodeUrl = selectedNodeUrl;
            this._state.isCacheLoaded = true;
        });

        if (currentAccountPublicKey) this._setCurrentAccount(currentAccountPublicKey);

        await Promise.all(
            Object.values(this.modules)
                .filter((module) => module.loadCache)
                .map((module) => module.loadCache())
        );
    };

    /**
     * Load accounts from the secure storage to the state
     * @param {string} [password] - wallet password
     * @returns {Promise<void>}
     * @private
     */
    _loadAccounts = async (password) => {
        const accounts = await this._secureStorage.getAccounts(password);
        const walletAccounts = createNetworkMap((networkIdentifier) =>
            accounts[networkIdentifier].map((account) =>
                createWalletAccount(account.privateKey, account.networkIdentifier, account.name, account.accountType, account.index)
            )
        );

        runInAction(() => {
            this._state.walletAccounts = walletAccounts;
        });
    };

    /**
     * Setup a new wallet. Save the mnemonic, generate accounts and select the first account
     * @param {Object} options
     * @param {string} options.mnemonic - mnemonic phrase
     * @param {string} options.name - first account name
     * @param {string} [password] - wallet password
     * @returns {Promise<void>}
     */
    saveMnemonicAndGenerateAccounts = async ({ mnemonic, name }, password) => {
        // Save mnemonic and verify it is stored correctly
        await this._secureStorage.setMnemonic(mnemonic, password);
        const savedMnemonic = await this._secureStorage.getMnemonic(password);
        if (mnemonic !== savedMnemonic) {
            throw new AppError('error_mnemonic_does_not_match', 'Mnemonic does not match the saved mnemonic');
        }

        // Generate and save seed accounts
        const seedIndexes = [...Array(MAX_SEED_ACCOUNTS_PER_NETWORK).keys()];
        const accounts = createNetworkMap((networkIdentifier) =>
            createPrivateKeysFromMnemonic(mnemonic, seedIndexes, networkIdentifier).map((privateKey, index) =>
                createWalletStorageAccount(
                    privateKey,
                    networkIdentifier,
                    `${DEFAULT_ACCOUNT_NAME} ${index + 1}`,
                    WalletAccountType.SEED,
                    index
                )
            )
        );
        const addresses = {};

        for (const networkIdentifier of Object.keys(accounts)) {
            addresses[networkIdentifier] = accounts[networkIdentifier].map((account) => omit(account, 'privateKey'));
            const account = accounts[networkIdentifier][0];

            await this.addAccount(
                {
                    accountType: WalletAccountType.SEED,
                    privateKey: account.privateKey,
                    name,
                    networkIdentifier,
                    index: account.index,
                },
                password
            );
        }

        await this._persistentStorage.setSeedAddresses(addresses, password);

        // Select first account of the default network
        const defaultAccount = accounts[config.defaultNetworkIdentifier][0];
        await this.selectAccount(defaultAccount.publicKey);
    };

    /**
     * Generate a new seed account from mnemonic and add it to the wallet
     * @param {Object} options
     * @param {string} options.name - account name
     * @param {string} options.networkIdentifier - network identifier
     * @param {number} options.index - account index
     * @param {string} [password] - wallet password
     * @returns {Promise<void>}
     */
    addSeedAccount = async ({ name, networkIdentifier, index }, password) => {
        const mnemonic = await this._secureStorage.getMnemonic(password);
        const privateKey = createPrivateKeysFromMnemonic(mnemonic, [index], networkIdentifier)[0];

        await this.addAccount(
            {
                accountType: WalletAccountType.SEED,
                privateKey,
                name,
                networkIdentifier,
                index,
            },
            password
        );
    };

    /**
     * Add a new account to the wallet
     * @param {Object} options
     * @param {string} options.accountType - account type
     * @param {string} options.privateKey - account private key
     * @param {string} options.name - account name
     * @param {string} options.networkIdentifier - network identifier of the account
     * @param {number} options.index - account index
     * @param {string} [password] - wallet password
     * @returns {Promise<void>}
     */
    addAccount = async ({ accountType, privateKey, name, networkIdentifier, index }, password) => {
        const account = createWalletStorageAccount(privateKey, networkIdentifier, name, accountType, index);
        const accounts = await this._secureStorage.getAccounts(password);
        const networkAccounts = accounts[networkIdentifier];
        const isAccountAlreadyExists = networkAccounts.find((account) => account.privateKey === privateKey);

        if (isAccountAlreadyExists) {
            throw new AppError(
                'error_failed_add_account_already_exists',
                'Failed to add account. Account with provided private key already exists'
            );
        }

        networkAccounts.push(account);
        await this._secureStorage.setAccounts(accounts, password);
        await this._loadAccounts(password);
    };

    /**
     * Rename wallet account
     * @param {Object} options
     * @param {string} options.networkIdentifier - network identifier of the account
     * @param {string} options.publicKey - account public key
     * @param {string} options.name - new account name
     * @param {string} [password] - wallet password
     * @returns {Promise<void>}
     */
    renameAccount = async ({ networkIdentifier, publicKey, name }, password) => {
        const accounts = await this._secureStorage.getAccounts(password);
        const account = accounts[networkIdentifier].find((account) => account.publicKey == publicKey);
        account.name = name;

        await this._secureStorage.setAccounts(accounts, password);
        await this._loadAccounts(password);
        this._setCurrentAccount(this._state.currentAccountPublicKey);
    };

    /**
     * Remove account from the wallet
     * @param {Object} options
     * @param {string} options.networkIdentifier - network identifier of the account
     * @param {string} options.publicKey - account public key
     * @param {string} [password] - wallet password
     * @returns {Promise<void>}
     */
    removeAccount = async ({ networkIdentifier, publicKey }, password) => {
        const accounts = await this._secureStorage.getAccounts(password);
        accounts[networkIdentifier] = accounts[networkIdentifier].filter((account) => account.publicKey !== publicKey);

        await this._secureStorage.setAccounts(accounts, password);
        await this._loadAccounts(password);

        if (this._state.currentAccountPublicKey === publicKey) {
            await this.selectAccount(this.walletAccounts[networkIdentifier][0].publicKey);
        }
    };

    /**
     * Change accounts order
     * @param {string} networkIdentifier - network identifier
     * @param {Array} accountsOrder - array of account objects with public key
     * @param {string} password - wallet password
     * @returns {Promise<void>}
     */
    changeAccountsOrder = async (networkIdentifier, accountsOrder, password) => {
        const accountsPublicKeys = accountsOrder.map((account) => account.publicKey);
        const accounts = await this._secureStorage.getAccounts(password);
        accounts[networkIdentifier] = accounts[networkIdentifier].sort((a, b) => {
            return accountsPublicKeys.indexOf(a.publicKey) - accountsPublicKeys.indexOf(b.publicKey);
        });

        await this._secureStorage.setAccounts(accounts, password);
        await this._loadAccounts(password);
    };

    /**
     * Select wallet account
     * @param {string} publicKey - account public key
     * @returns {Promise<void>}
     */
    selectAccount = async (publicKey) => {
        this._setCurrentAccount(publicKey);
        await this._persistentStorage.setCurrentAccountPublicKey(publicKey);

        runInAction(() => {
            this._state.currentAccountPublicKey = publicKey;
        });
        this._emit(ControllerEventName.ACCOUNT_CHANGE);
    };

    /**
     * Set current account object
     * @param {string} publicKey - account public key
     * @returns {void}
     * @private
     */
    _setCurrentAccount = (publicKey) => {
        const { walletAccounts, networkIdentifier } = this._state;
        const currentAccount = walletAccounts[networkIdentifier].find((account) => account.publicKey === publicKey);

        if (!currentAccount) {
            throw new AppError('error_wallet_selected_account_missing', 'Selected account is missing in the wallet');
        }

        runInAction(() => {
            this._state.currentAccount = currentAccount;
        });
    };

    /**
     * Fetch current account info
     * @returns {Promise<Object>} - account info
     */
    fetchAccountInfo = async () => {
        const { networkIdentifier, networkProperties, currentAccountPublicKey } = this._state;
        const publicKey = currentAccountPublicKey;
        const address = addressFromPublicKey(publicKey, networkIdentifier);

        let baseAccountInfo = {};
        try {
            baseAccountInfo = await AccountService.fetchAccountInfo(networkProperties, address);
        } catch (error) {
            if (error.code !== 'error_fetch_not_found') {
                throw new AppError('error_fetch_account_info', error.message);
            }

            return null;
        }

        let isMultisig;
        let cosignatories = [];
        let multisigAddresses = [];
        try {
            const multisigInfo = await AccountService.fetchMultisigInfo(networkProperties, address);
            cosignatories = multisigInfo.cosignatories;
            multisigAddresses = multisigInfo.multisigAddresses;
            isMultisig = cosignatories.length > 0;
        } catch {
            isMultisig = false;
        }

        const namespaces = await NamespaceService.fetchAccountNamespaces(address, networkProperties);

        const accountInfo = {
            isLoaded: true,
            address: baseAccountInfo.address,
            publicKey: baseAccountInfo.publicKey,
            importance: baseAccountInfo.importance,
            linkedKeys: baseAccountInfo.linkedKeys,
            mosaics: baseAccountInfo.mosaics,
            balance: baseAccountInfo.balance,
            namespaces,
            isMultisig,
            cosignatories,
            multisigAddresses,
        };

        const accountInfos = await this._persistentStorage.getAccountInfos();
        accountInfos[networkIdentifier][publicKey] = accountInfo;
        await this._persistentStorage.setAccountInfos(accountInfos);

        runInAction(() => {
            this._state.accountInfos = accountInfos;
        });

        return accountInfo;
    };

    /**
     * Fetch current account transactions
     * @param {Object} options
     * @param {string} options.group - 'confirmed', 'unconfirmed' or 'partial'
     * @param {number} options.pageNumber - page number
     * @param {number} options.pageSize - page size
     * @param {Object} options.filter - filter object
     */
    fetchAccountTransactions = async (options = {}) => {
        const { group = TransactionGroup.CONFIRMED, pageNumber = 1, pageSize = 15, filter } = options;
        const { networkIdentifier, networkProperties } = this._state;
        const publicKey = this.currentAccount.publicKey;
        const account = publicAccountFromPublicKey(publicKey, networkIdentifier);

        // Fetch transactions from chain
        const transactions = await TransactionService.fetchAccountTransactions(account, networkProperties, {
            group,
            filter,
            pageNumber,
            pageSize,
        });

        // Cache transactions for current account
        const isFilterActivated = filter && Object.keys(filter).length > 0;
        if (!isFilterActivated && group === TransactionGroup.CONFIRMED && pageNumber === 1) {
            const latestTransactions = await this._persistentStorage.getLatestTransactions();
            latestTransactions[networkIdentifier][publicKey] = transactions;
            await this._persistentStorage.setLatestTransactions(latestTransactions);

            runInAction(() => {
                this._state.latestTransactions = latestTransactions;
            });
        }

        // Return transactions
        return {
            data: transactions,
            pageNumber,
        };
    };

    /**
     * Return wallet mnemonic passphrase from the secure storage
     * @param {string} [password] - wallet password
     * @returns {Promise<string>} - mnemonic passphrase
     */
    getMnemonic = async (password) => {
        return this._secureStorage.getMnemonic(password);
    };

    /**
     * Return current account private key from the secure storage
     * @param {string} [password] - wallet password
     * @returns {Promise<string>} - account private key
     */
    getCurrentAccountPrivateKey = async (password) => {
        const { currentAccountPublicKey, networkIdentifier } = this._state;
        const accounts = await this._secureStorage.getAccounts(password);
        const networkAccounts = accounts[networkIdentifier];
        const privateAccount = networkAccounts.find((account) => account.publicKey === currentAccountPublicKey);

        return privateAccount.privateKey;
    };

    /**
     * Sign transaction with the current account private key
     * @param {Object} transaction - transaction
     * @param {string} [password] - wallet password
     * @returns {Promise<Object>} - signed transaction object
     */
    signTransaction = async (transaction, password) => {
        const privateKey = await this.getCurrentAccountPrivateKey(password);

        return signTransaction(this.networkProperties, transaction, privateKey);
    };

    /**
     * Add current account signature to partial transaction
     * @param {Object} transaction - partial transaction
     * @param {string} [password] - wallet password
     * @returns {Promise<Object>} - cosigned transaction object
     */
    cosignTransaction = async (transaction, password) => {
        if (transaction.type !== TransactionType.AGGREGATE_BONDED) {
            throw new AppError(
                'error_failed_cosign_transaction_invalid_type',
                `Failed to cosign transaction. Invalid transaction type "${transaction.type}". Expected type "${TransactionType.AGGREGATE_BONDED}"`
            );
        }

        const privateKey = await this.getCurrentAccountPrivateKey(password);

        return cosignTransaction(this.networkProperties, transaction, privateKey);
    };

    /**
     * Announce signed transaction
     * @param {Object} signedTransaction - signed transaction object
     * @param {string} [group] - transaction group ('default', 'partial' or 'cosignature')
     * @returns {Promise<Object>} - transaction announce result
     */
    announceSignedTransaction = async (signedTransaction, group) => {
        return TransactionService.announceTransaction(signedTransaction.dto, this.networkProperties, group);
    };

    /**
     * Sign transaction with the current account private key and announce it
     * @param {Object} transaction - transaction
     * @param {boolean} sendHashLock - whether to send hash lock transaction before (if transaction is aggregate bonded)
     * @param {string} [password] - wallet password
     * @returns {Promise<Object>} - transaction announce result
     */
    signAndAnnounceTransaction = async (transaction, sendHashLock, password) => {
        return new Promise(async (resolve) => {
            // Sign transaction
            const signedTransaction = await this.signTransaction(transaction, password);
            const isHashLockNeedsToBeSent = sendHashLock && transaction.type === TransactionType.AGGREGATE_BONDED;

            // Announce transaction and exit if hash lock is not needed
            if (!isHashLockNeedsToBeSent) {
                return resolve(this.announceSignedTransaction(signedTransaction));
            }

            // Create and sign hash lock transaction
            const hashLockTransaction = {
                type: TransactionType.HASH_LOCK,
                signerPublicKey: this.currentAccount.publicKey,
                lockedAmount: 10,
                fee: 0.1,
                duration: 1000,
                aggregateHash: signedTransaction.hash,
            };
            const signedHashLockTransaction = await this.signTransaction(hashLockTransaction, password);

            // Announce main transaction after hash lock transaction is confirmed
            const listener = new ListenerService(this.networkProperties, this.currentAccount);
            await listener.open();
            listener.listenAddedTransactions(TransactionGroup.CONFIRMED, (transaction) => {
                if (transaction.hash === signedHashLockTransaction.hash) {
                    listener.close();
                    return resolve(this.announceSignedTransaction(signedTransaction, TransactionAnnounceGroup.PARTIAL));
                }
            });

            // Announce hash lock transaction
            await this.announceSignedTransaction(signedHashLockTransaction);
        });
    };

    /**
     * Cosign partial transaction with the current account private key and announce it
     * @param {Object} transaction - transaction
     * @param {string} [password] - wallet password
     * @returns {Promise<Object>} - transaction announce result
     */
    cosignAndAnnounceTransaction = async (transaction, password) => {
        const cosignedTransaction = await this.cosignTransaction(transaction, password);

        return this.announceSignedTransaction(cosignedTransaction, TransactionAnnounceGroup.COSIGNATURE);
    };

    /**
     * Encrypt message with recipient public key and current account private key
     * @param {string} messageText - message text to encrypt
     * @param {string} recipientPublicKey - recipient public key
     * @param {string} [password] - wallet password
     * @returns {Promise<string>} - encrypted message HEX payload
     */
    encryptMessage = async (messageText, recipientPublicKey, password) => {
        const privateKey = await this.getCurrentAccountPrivateKey(password);

        return encryptMessage(messageText, recipientPublicKey, privateKey);
    };

    /**
     * Decrypt message with sender (or recipient) public key and current account private key
     * @param {string} encryptedMessage - encrypted message HEX payload
     * @param {string} senderPublicKey - sender (or recipient) public key
     * @param {string} [password] - wallet password
     * @returns {Promise<string>} - decrypted message text
     */
    decryptMessage = async (encryptedMessage, publicKey, password) => {
        const privateKey = await this.getCurrentAccountPrivateKey(password);

        return decryptMessage(encryptedMessage, publicKey, privateKey);
    };

    /**
     * Complete wallet creation process
     * @returns {void}
     */
    notifyLoginCompleted = () => {
        this._emit(ControllerEventName.LOGIN);
    };

    /**
     * Logout and clear all the data from the storage
     * @returns {Promise<void>}
     */
    logoutAndClearStorage = async () => {
        await this._persistentStorage.removeAll();
        await this._secureStorage.removeAll();
        this.clearState();
        this._emit(ControllerEventName.LOGOUT);
    };

    clearState = () => {
        this._state = cloneDeep(defaultState);

        Object.values(this.modules).forEach((module) => module.clearState?.());
    };

    fetchNodeList = async () => {
        const { networkIdentifier, nodeUrls } = this._state;
        const updatedNodeUrls = { ...nodeUrls };
        updatedNodeUrls[networkIdentifier] = await NetworkService.fetchNodeList(networkIdentifier);

        runInAction(() => {
            this._state.nodeUrls = updatedNodeUrls;
        });
    };

    /**
     * Fetch network properties from the node
     * @param {string} nodeUrl - node url
     * @returns {Promise<void>}
     */
    fetchNetworkProperties = async (nodeUrl) => {
        const networkProperties = await NetworkService.fetchNetworkProperties(nodeUrl);

        if (networkProperties.networkIdentifier !== this.networkIdentifier) {
            throw new AppError(
                'error_fetch_network_properties_wrong_network',
                `Failed to fetch network properties. Wrong network identifier. Expected "${this.networkIdentifier}", got "${networkProperties.networkIdentifier}"`
            );
        }

        await this._persistentStorage.setNetworkProperties(networkProperties);

        runInAction(() => {
            this._state.networkProperties = networkProperties;
            this._state.chainHeight = networkProperties.chainHeight;
        });
    };

    /**
     * Select network and node
     * @param {string} networkIdentifier - network identifier
     * @param {string} [nodeUrl] - node url
     * @returns {Promise<void>}
     */
    selectNetwork = async (networkIdentifier, nodeUrl) => {
        const accounts = this._state.walletAccounts[networkIdentifier];
        await this._persistentStorage.setNetworkProperties(defaultNetworkProperties);
        await this._persistentStorage.setNetworkIdentifier(networkIdentifier);
        await this._persistentStorage.setSelectedNode(nodeUrl || null);

        runInAction(() => {
            this._state.nodeUrls = cloneDeep(defaultState.nodeUrls);
            this._state.networkIdentifier = networkIdentifier;
            this._state.networkProperties = defaultNetworkProperties;
            this._state.selectedNodeUrl = nodeUrl;
            this._state.chainHeight = 0;
            this._state.networkStatus = NetworkConnectionStatus.INITIAL;
        });
        this._emit(ControllerEventName.NETWORK_CHANGE);

        await this.selectAccount(accounts[0].publicKey);
    };

    /**
     * Start the network connection job. Try to connect to the node and fetch the network properties with the interval
     * @returns {void}
     */
    runConnectionJob = async () => {
        const { networkConnectionTimer, networkIdentifier } = this._state;
        const runAgain = () => {
            const newConnectionTimer = setTimeout(() => this.runConnectionJob(), config.connectionInterval);
            this._state.networkConnectionTimer = newConnectionTimer;
        };

        clearTimeout(networkConnectionTimer);

        // Try to connect to current node
        const currentNode = this.networkProperties.nodeUrl || this.selectedNodeUrl;
        if (currentNode) {
            try {
                await this.fetchNetworkProperties(currentNode);
                // Node is good.
                runInAction(() => {
                    this._state.networkStatus = NetworkConnectionStatus.CONNECTED;
                });
                this._startChainListener();
                runAgain();
                return;
            } catch {
                runInAction(() => {
                    this._state.networkStatus = NetworkConnectionStatus.FAILED_CURRENT_NODE;
                });
            }
        }

        // Try to fetch the node list to verify if it is not the internet connection issue
        try {
            await this.fetchNodeList();
        } catch {
            // Failed to fetch list. Seems like there is an internet connection issue.
            runInAction(() => {
                this._state.networkStatus = NetworkConnectionStatus.NO_INTERNET;
            });
            runAgain();
            return;
        }

        // If there is a selected node by user, skip auto selection
        if (this.selectedNodeUrl) {
            runAgain();
            return;
        }

        // Auto select the node. Try to connect to the node one by one from the list
        for (const nodeUrl of this._state.nodeUrls[networkIdentifier]) {
            try {
                await NetworkService.ping(nodeUrl);
                await this.fetchNetworkProperties(nodeUrl);
                this._startChainListener();
                runInAction(() => {
                    this._state.networkStatus = NetworkConnectionStatus.CONNECTED;
                });
                runAgain();
                return;
            } catch {}
        }

        runInAction(() => {
            this._state.networkStatus = NetworkConnectionStatus.FAILED_AUTO_SELECTION;
        });
        runAgain();
        return;
    };

    /**
     * Subscribe to the chain listener
     * @returns {void}
     * @private
     */
    _startChainListener = async () => {
        this._stopChainListener();

        try {
            const newListener = new ListenerService(this.networkProperties, this.currentAccount);
            await newListener.open();
            newListener.listenAddedTransactions(TransactionGroup.CONFIRMED, (transaction) => {
                this._emit(ControllerEventName.NEW_TRANSACTION_CONFIRMED, transaction);
            });
            newListener.listenAddedTransactions(TransactionGroup.UNCONFIRMED, (transaction) => {
                this._emit(ControllerEventName.NEW_TRANSACTION_UNCONFIRMED, transaction);
            });
            newListener.listenAddedTransactions(TransactionGroup.PARTIAL, (transaction) => {
                this._emit(ControllerEventName.NEW_TRANSACTION_PARTIAL, transaction);
            });
            newListener.listenTransactionError((error) => {
                this._emit(ControllerEventName.TRANSACTION_ERROR, error);
            });
            this._state.chainListener = newListener;
        } catch {}
    };

    /**
     * Unsubscribe from the chain listener
     * @returns {void}
     * @private
     */
    _stopChainListener = () => {
        const { chainListener } = this._state;

        if (chainListener) {
            chainListener.close();
        }
    };

    /**
     * Subscribe to the controller events
     * @param {string} eventName - event name
     * @param {Function} listener - callback function
     * @returns {void}
     */
    on = (eventName, listener) => {
        this._notificationChannel.on(eventName, listener);
    };

    /**
     * Unsubscribe from the controller events
     * @param {string} eventName - event name
     * @param {Function} listener - callback function
     * @returns {void}
     */
    removeListener = (eventName, listener) => {
        this._notificationChannel.removeListener(eventName, listener);
    };

    /**
     * Emit controller event
     * @param {string} eventName - event name
     * @param {Object} payload - event payload
     * @returns {void}
     * @private
     */
    _emit = (eventName, payload) => {
        this._notificationChannel.emit(eventName, payload);
    };
}

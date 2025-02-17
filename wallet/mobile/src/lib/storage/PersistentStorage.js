import AsyncStorage from '@react-native-async-storage/async-storage';
import { config } from '@/config';
import { createNetworkMap } from '@/utils/helper';
import _ from 'lodash';

export class PersistentStorage {
    // Keys
    static DATA_SCHEMA_VERSION = 'DATA_SCHEMA_VERSION';
    static NETWORK_IDENTIFIER_KEY = 'NETWORK_IDENTIFIER';
    static SELECTED_NODE_KEY = 'selectedNode';
    static CURRENT_ACCOUNT_PUBLIC_KEY = 'CURRENT_ACCOUNT_PUBLIC';
    static SELECTED_LANGUAGE_KEY = 'SELECTED_LANGUAGE';
    static SEED_ADDRESSES_KEY = 'SEED_ADDRESSES';
    static LATEST_TRANSACTIONS_KEY = 'LATEST_TRANSACTIONS';
    static ACCOUNT_INFOS_KEY = 'ACCOUNT_INFOS';
    static ADDRESS_BOOK_KEY = 'ADDRESS_BOOK';
    static USER_CURRENCY_KEY = 'USER_CURRENCY';
    static REQUEST_LIST_KEY = 'REQUEST_LIST';
    static APP_LAUNCH_MODE_KEY = 'APP_LAUNCH_MODE';
    static PERMISSIONS_KEY = 'PERMISSIONS';
    static NETWORK_PROPERTIES_KEY = 'NETWORK_PROPERTIES';

    // Data Schema Version
    static getDataSchemaVersion = async () => {
        const version = await this.get(this.DATA_SCHEMA_VERSION);

        if (version === null) {
            return null;
        }

        return parseInt(version);
    };

    static setDataSchemaVersion = (payload) => {
        return this.set(this.DATA_SCHEMA_VERSION, payload.toString());
    };

    // Network Identifier
    static getNetworkIdentifier = async () => {
        const networkIdentifier = (await this.get(this.NETWORK_IDENTIFIER_KEY)) || config.defaultNetworkIdentifier;

        try {
            return JSON.parse(networkIdentifier);
        } catch {
            return config.defaultNetworkIdentifier;
        }
    };

    static setNetworkIdentifier = (payload) => {
        return this.set(this.NETWORK_IDENTIFIER_KEY, JSON.stringify(payload));
    };

    // Selected Node
    static getSelectedNode = async () => {
        const nodeUrl = await this.get(this.SELECTED_NODE_KEY);
        return nodeUrl === 'null' ? null : nodeUrl;
    };

    static setSelectedNode = (payload) => {
        const nodeUrl = payload === null ? 'null' : payload;
        return this.set(this.SELECTED_NODE_KEY, nodeUrl);
    };

    // Current Account Public Key
    static getCurrentAccountPublicKey = () => {
        return this.get(this.CURRENT_ACCOUNT_PUBLIC_KEY);
    };

    static setCurrentAccountPublicKey = (payload) => {
        return this.set(this.CURRENT_ACCOUNT_PUBLIC_KEY, payload);
    };


    // Selected Language
    static getSelectedLanguage = () => {
        return this.get(this.SELECTED_LANGUAGE_KEY);
    };

    static setSelectedLanguage = (payload) => {
        return this.set(this.SELECTED_LANGUAGE_KEY, payload);
    };

    // Seed Addresses
    static async getSeedAddresses() {
        const addresses = await this.get(this.SEED_ADDRESSES_KEY);
        const defaultAccounts = createNetworkMap(() => []);

        try {
            return JSON.parse(addresses) || defaultAccounts;
        } catch {
            return defaultAccounts;
        }
    }

    static async setSeedAddresses(payload) {
        return this.set(this.SEED_ADDRESSES_KEY, JSON.stringify(payload));
    }

    // Transactions
    static async getLatestTransactions() {
        const latestTransactions = await this.get(this.LATEST_TRANSACTIONS_KEY);
        const defaultLatestTransactions = createNetworkMap(() => ({}));

        try {
            return JSON.parse(latestTransactions) || defaultLatestTransactions;
        } catch {
            return defaultLatestTransactions;
        }
    }

    static async setLatestTransactions(payload) {
        return this.set(this.LATEST_TRANSACTIONS_KEY, JSON.stringify(payload));
    }

    // Account Infos
    static async getAccountInfos() {
        const accountInfos = await this.get(this.ACCOUNT_INFOS_KEY);
        const defaultAccountInfos = createNetworkMap(() => ({}));

        try {
            return JSON.parse(accountInfos) || defaultAccountInfos;
        } catch {
            return defaultAccountInfos;
        }
    }

    static async setAccountInfos(payload) {
        return this.set(this.ACCOUNT_INFOS_KEY, JSON.stringify(payload));
    }

    // Address Book
    static async getAddressBook() {
        const rawAddressBook = await this.get(this.ADDRESS_BOOK_KEY);
        const defaultAddressBook = createNetworkMap(() => ([]));

        try {
            return JSON.parse(rawAddressBook) || defaultAddressBook;
        } catch {
            return defaultAddressBook;
        }
    }

    static async setAddressBook(payload) {
        return this.set(this.ADDRESS_BOOK_KEY, JSON.stringify(payload));
    }

    // User Currency
    static async getUserCurrency() {
        const value = await this.get(this.USER_CURRENCY_KEY);
        const defaultValue = 'USD';

        return value || defaultValue;
    }

    static async setUserCurrency(payload) {
        return this.set(this.USER_CURRENCY_KEY, payload);
    }

    // Request Action
    static async getRequestQueue() {
        const value = await this.get(this.REQUEST_LIST_KEY);
        const defaultValue = [];

        try {
            const parsedValue = JSON.parse(value);
            return _.isArray(parsedValue) ? parsedValue : defaultValue;
        } catch {
            return defaultValue;
        }
    }

    static async setRequestQueue(payload) {
        return this.set(this.REQUEST_LIST_KEY, JSON.stringify(payload));
    }

    // App Launch Mode
    static getAppLaunchMode = async () => {
        const defaultValue = 'confirm';
        const value = await this.get(this.APP_LAUNCH_MODE_KEY);

        return value || defaultValue;
    };

    static setAppLaunchMode = (payload) => {
        return this.set(this.APP_LAUNCH_MODE_KEY, payload);
    };

    // Permissions
    static async getPermissions() {
        const value = await this.get(this.PERMISSIONS_KEY);
        const defaultValue = {};

        try {
            return JSON.parse(value) || defaultValue;
        } catch {
            return defaultValue;
        }
    }

    static async setPermissions(payload) {
        return this.set(this.PERMISSIONS_KEY, JSON.stringify(payload));
    }

    // Network Properties
    static async getNetworkProperties() {
        const value = await this.get(this.NETWORK_PROPERTIES_KEY);
        const defaultValue = {};

        try {
            return JSON.parse(value) || defaultValue;
        } catch {
            return defaultValue;
        }
    }

    static async setNetworkProperties(payload) {
        return this.set(this.NETWORK_PROPERTIES_KEY, JSON.stringify(payload));
    }

    // API
    static set = (key, value) => {
        return AsyncStorage.setItem(key, value);
    };

    static get = (key) => {
        return AsyncStorage.getItem(key);
    };

    static remove = (key) => {
        return AsyncStorage.removeItem(key);
    };

    static removeAll = async () => {
        await Promise.all([
            this.remove(this.DATA_SCHEMA_VERSION),
            this.remove(this.NETWORK_IDENTIFIER_KEY),
            this.remove(this.CURRENT_ACCOUNT_PUBLIC_KEY),
            this.remove(this.SELECTED_NODE_KEY),
            this.remove(this.SELECTED_LANGUAGE_KEY),
            this.remove(this.SEED_ADDRESSES_KEY),
            this.remove(this.LATEST_TRANSACTIONS_KEY),
            this.remove(this.ACCOUNT_INFOS_KEY),
            this.remove(this.USER_CURRENCY_KEY),
            this.remove(this.REQUEST_LIST_KEY),
            this.remove(this.PERMISSIONS_KEY),
            this.remove(this.NETWORK_PROPERTIES_KEY),
        ]);
    };
}

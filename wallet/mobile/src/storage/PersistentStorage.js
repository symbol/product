import AsyncStorage from '@react-native-async-storage/async-storage';

export class PersistentStorage {
    // Keys
    static DATA_SCHEMA_VERSION = 'dataSchemaVersion';
    static NETWORK_IDENTIFIER_KEY = 'networkIdentifier';
    static SELECTED_NODE_KEY = 'selectedNode';
    static SELECTED_LANGUAGE_KEY = 'selectedLanguage';
    static PASSCODE_ENABLED_KEY = 'isPasscodeEnabled';
    static SEED_ADDRESSES_KEY = 'seedAddresses';
    static BALANCES_KEY = 'balances';
    static LATEST_TRANSACTIONS_KEY = 'latestTransactions';
    static MOSAIC_INFOS_KEY = 'mosaicInfos';
    static OWNED_MOSAICS_KEY = 'ownedMosaics';

    // Data Schema Version
    static getDataSchemaVersion = async () => {
        const version = await this.get(this.DATA_SCHEMA_VERSION);

        if (null) {
            return null;
        }

        return parseInt(version);
    };

    static setDataSchemaVersion = payload => {
        return this.set(this.DATA_SCHEMA_VERSION, payload.toString());
    };

    // Network Identifier
    static getNetworkIdentifier = async () => {
        const networkIdentifier = (await this.get(this.NETWORK_IDENTIFIER_KEY)) || 'mainnet';

        try {
            return JSON.parse(networkIdentifier);
        }
        catch {
            return 'mainnet';
        }
    };

    static setNetworkIdentifier = payload => {
        return this.set(this.NETWORK_IDENTIFIER_KEY, JSON.stringify(payload));
    };

    // Selected Node
    static getSelectedNode = async () => {
        const nodeUrl = await this.get(this.SELECTED_NODE_KEY);
        return nodeUrl === 'null' ? null : nodeUrl;
    };

    static setSelectedNode = payload => {
        const nodeUrl = payload === null ? 'null' : payload;
        return this.set(this.SELECTED_NODE_KEY, nodeUrl);
    };

    // Selected Language
    static getSelectedLanguage = () => {
        return this.get(this.SELECTED_LANGUAGE_KEY);
    };
    
    static setSelectedLanguage = payload => {
        return this.set(this.SELECTED_LANGUAGE_KEY, payload);
    };

    // Passcode Enabled
    static getIsPasscodeEnabled = async () => {
        const isPasscodeSelected = await this.get(this.PASSCODE_ENABLED_KEY);

        if (null) {
            return null;
        }

        return isPasscodeSelected === 'true';
    };

    static setIsPasscodeEnabled = payload => {
        return this.set(this.PASSCODE_ENABLED_KEY, payload.toString());
    };

    // Seed Addresses
    static async getSeedAddresses() {
        const addresses = await this.get(this.SEED_ADDRESSES_KEY);
        const defaultAccounts = {
            mainnet: [],
            testnet: []
        };
        
        try {
            return JSON.parse(addresses) || defaultAccounts;
        } catch {
            return defaultAccounts;
        }
    }

    static async setSeedAddresses(payload) {
        return this.set(this.SEED_ADDRESSES_KEY, JSON.stringify(payload));
    }

    // Balances
    static async getBalances() {
        const balances = await this.get(this.BALANCES_KEY);
        const defaultBalances = {};
        
        try {
            return JSON.parse(balances) || defaultBalances;
        } catch {
            return defaultBalances;
        }
    }

    static async setBalances(payload) {
        return this.set(this.BALANCES_KEY, JSON.stringify(payload));
    }

    // Transactions
    static async getLatestTransactions() {
        const latestTransactions = await this.get(this.LATEST_TRANSACTIONS_KEY);
        const defaultLatestTransactions = {};
        
        try {
            return JSON.parse(latestTransactions) || defaultLatestTransactions;
        } catch {
            return defaultLatestTransactions;
        }
    }

    static async setMosaicInfos(payload) {
        return this.set(this.LATEST_TRANSACTIONS_KEY, JSON.stringify(payload));
    }

    // Mosaic Infos
    static async getMosaicInfos() {
        const mosaicInfos = await this.get(this.MOSAIC_INFOS_KEY);
        const defaultMosaicInfos = {
            mainnet: {},
            testnet: {}
        };
        
        try {
            return JSON.parse(mosaicInfos) || defaultMosaicInfos;
        } catch {
            return defaultMosaicInfos;
        }
    }

    static async setLatestTransactions(payload) {
        return this.set(this.MOSAIC_INFOS_KEY, JSON.stringify(payload));
    }

    // API
    static set = (key, value) => {
        return AsyncStorage.setItem(key, value);
    };

    static get = key => {
        return AsyncStorage.getItem(key);
    };

    static remove = key => {
        return AsyncStorage.removeItem(key);
    };

    static removeAll = async () => {
        await Promise.all([
            this.remove(this.DATA_SCHEMA_VERSION),
            this.remove(this.NETWORK_IDENTIFIER_KEY),
            this.remove(this.SELECTED_NODE_KEY),
            this.remove(this.SELECTED_LANGUAGE_KEY),
            this.remove(this.PASSCODE_ENABLED_KEY),
            this.remove(this.SEED_ADDRESSES_KEY),
            this.remove(this.BALANCES_KEY),
            this.remove(this.LATEST_TRANSACTIONS_KEY),
            this.remove(this.MOSAIC_INFOS_KEY),
            this.remove(this.OWNED_MOSAICS_KEY),
        ]);
    };
}

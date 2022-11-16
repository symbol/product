import AsyncStorage from '@react-native-async-storage/async-storage';

export class PersistentStorage {
    // Keys
    static DATA_SCHEMA_VERSION = 'dataSchemaVersion';
    static NETWORK_CONFIG_KEY = 'networkConfig';
    static SELECTED_NODE_KEY = 'selectedNode';
    static SELECTED_LANGUAGE_KEY = 'selectedLanguage';
    static PASSCODE_ENABLED_KEY = 'isPasscodeEnabled';
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

    // Netwok Config
    static getNetworkConfig = async () => {
        const networkConfig = await this.get(this.NETWORK_CONFIG_KEY);

        try {
            return JSON.parse(networkConfig);
        }
        catch {
            return null;
        }
    };

    static setNetworkConfig = payload => {
        return this.set(this.NETWORK_CONFIG_KEY, JSON.stringify(payload));
    };

    // Selected Node
    static getSelectedNode = () => {
        return this.get(this.SELECTED_NODE_KEY);
    };

    static setSelectedNode = payload => {
        return this.set(this.SELECTED_NODE_KEY, payload.toString());
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
            this.remove(this.NETWORK_CONFIG_KEY),
            this.remove(this.SELECTED_NODE_KEY),
            this.remove(this.SELECTED_LANGUAGE_KEY),
            this.remove(this.PASSCODE_ENABLED_KEY),
        ]);
    };
}

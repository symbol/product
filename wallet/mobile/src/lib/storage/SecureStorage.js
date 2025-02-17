import EncryptedStorage from 'react-native-encrypted-storage';

export class SecureStorage {
    // Keys
    static MNEMONIC_KEY = 'MNEMONIC';
    static ACCOUNTS_KEY = 'ACCOUNTS';

    // Mnemonic
    static getMnemonic() {
        return this.get(this.MNEMONIC_KEY);
    }

    static setMnemonic(payload) {
        return this.set(this.MNEMONIC_KEY, payload);
    }

    // Accounts
    static async isAccountsValueSet() {
        const accounts = await SecureStorage.getAccounts();

        return accounts.mainnet.length > 0 || accounts.testnet.length > 0;
    }

    static async getAccounts() {
        const defaultAccounts = {
            mainnet: [],
            testnet: [],
        };
        const accounts = await this.get(this.ACCOUNTS_KEY);

        try {
            return JSON.parse(accounts) || defaultAccounts;
        } catch {
            return defaultAccounts;
        }
    }

    static async setAccounts(payload) {
        return this.set(this.ACCOUNTS_KEY, JSON.stringify(payload));
    }

    // API
    static get(key) {
        try {
            return EncryptedStorage.getItem(key);
        } catch {
            return null;
        }
    }

    static set = (key, value) => {
        return EncryptedStorage.setItem(key, value);
    };

    static removeAll = async () => {
        await EncryptedStorage.removeItem(this.MNEMONIC_KEY);
        await EncryptedStorage.removeItem(this.ACCOUNTS_KEY);
    };
}

import { createOptInPrivateKeyFromMnemonic, createPrivateKeysFromMnemonic, createWalletAccount } from 'src/utils';
import { PersistentStorage } from './PersistentStorage';
import { SecureStorage } from './SecureStorage';
import { AddressBook } from 'symbol-address-book';

export const CURRENT_DATA_SCHEMA_VERSION = 3;

export class StorageMigration {
    static async migrate() {
        // Get schema version from the storage
        const version = await PersistentStorage.getDataSchemaVersion();

        // Format and re-save data depending on old versions
        switch (version) {
            case 0:
                await this.migrate0();
                break;
            case 2:
                await this.migrate2();
                break;
        }

        // Save current schema version
        return PersistentStorage.setDataSchemaVersion(CURRENT_DATA_SCHEMA_VERSION);
    }

    static async migrate0() {
        // Load data from storage
        const mnemonic = await SecureStorage.get('mnemonics');

        // Escape if mnemonic does not exist in the storage
        if (!mnemonic?.length) {
            SecureStorage.removeAll();
            PersistentStorage.removeAll();
            return;
        }

        // Format mnemonic
        const optInPrivateKey = createOptInPrivateKeyFromMnemonic(mnemonic);
        const mainnetPrivateKey = createPrivateKeysFromMnemonic(mnemonic, [0], 'mainnet')[0];
        const testnetPrivateKey = createPrivateKeysFromMnemonic(mnemonic, [0], 'testnet')[0];
        const networkAccounts = {
            mainnet: [
                createWalletAccount(mainnetPrivateKey, 'mainnet', 'My Account', 'seed', 0),
                createWalletAccount(optInPrivateKey, 'mainnet', 'My Account', 'external', null),
            ],
            testnet: [
                createWalletAccount(testnetPrivateKey, 'testnet', 'My Account', 'seed', 0)
            ]
        };

        // Clear the old data and set the formatted one
        SecureStorage.removeAll();
        PersistentStorage.removeAll();
        await SecureStorage.setMnemonic(mnemonic);
        await SecureStorage.setAccounts(networkAccounts);
    }

    static async migrate2() {
        // Load data from storage
        const mnemonicModel = await SecureStorage.get('MNEMONIC_MODEL');
        const accountsModel = await SecureStorage.get('ACCOUNTS');
        const addressBookModel = await SecureStorage.get('CONTACTS');

        // Format mnemonic
        let mnemonic;
        try {
            mnemonic = JSON.parse(mnemonicModel).mnemonic;
        }
        catch {}

        // Escape if mnemonic does not exist in the storage
        if (!mnemonic?.length) {
            SecureStorage.removeAll();
            PersistentStorage.removeAll();
            return;
        }

        // Format accounts
        let accounts = [];
        try {
            accounts = JSON.parse(accountsModel) || [];
        } catch {}
        const networkAccounts = {
            mainnet: [],
            testnet: []
        };
        accounts.forEach(account => {
            // Format seed accounts
            if (account.type === 'hd' && account.path) {
                // Get seed index from path
                const startPath = account.network === 'testnet' ? "m/44'/1'/" : "m/44'/4343'/";
                const endPath = "'/0'/0'"
                const index = parseInt(account.type.replace(startPath, '').replace(endPath, ''));
                const walletAccount = createWalletAccount(account.privateKey, account.network, account.name, 'seed', index);
                networkAccounts[account.network].push(walletAccount);
            }
            // Format privateKey and optIn accounts
            else if (account.type !== 'hd') {
                const walletAccount = createWalletAccount(account.privateKey, account.network, account.name, 'external', null);
                networkAccounts[account.network].push(walletAccount);
            }
        });

        //If no account exist for network, add default 0 seed account
        if (!networkAccounts.mainnet.length) {
            const privateKey = createPrivateKeysFromMnemonic(mnemonic, [0], 'mainnet')[0];
            const walletAccount = createWalletAccount(privateKey, 'mainnet', 'My Account', 'seed', 0);
            networkAccounts.mainnet.push(walletAccount);
        }
        if (!networkAccounts.testnet.length) {
            const privateKey = createPrivateKeysFromMnemonic(mnemonic, [0], 'testnet')[0];
            const walletAccount = createWalletAccount(privateKey, 'testnet', 'My Account', 'seed', 0);
            networkAccounts.testnet.push(walletAccount);
        }


        // Format address book
        let addressBook;
        try {
            addressBook = AddressBook.fromJSON(addressBookModel);
        } catch {
            addressBook = new AddressBook([]);
        }

        // Clear the old data and set the formatted one
        SecureStorage.removeAll();
        PersistentStorage.removeAll();
        await SecureStorage.setMnemonic(mnemonic);
        await SecureStorage.setAccounts(networkAccounts);
        await PersistentStorage.setAddressBook(addressBook);
    }
}

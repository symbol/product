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
        const mainnetPrivateKey = createPrivateKeysFromMnemonic(mnemonic, [0], 'mainnet')[0];
        const testnetPrivateKey = createPrivateKeysFromMnemonic(mnemonic, [0], 'testnet')[0];
        const networkAccounts = {
            mainnet: [
                createWalletAccount(mainnetPrivateKey, 'mainnet', 'My Account', 'seed', 0)
            ],
            testnet: [
                createWalletAccount(testnetPrivateKey, 'testnet', 'My Account', 'seed', 0)
            ]
        };
        let rawAccounts = [];
        try {
            rawAccounts = JSON.parse(accountsModel) || [];
        } catch {}
        const externalAccounts = rawAccounts.filter(account => account.type !== 'hd');
        networkAccounts.mainnet.push(...externalAccounts
            .filter(account => account.network === 'mainnet')
            .map(account => createWalletAccount(account.privateKey, 'mainnet', account.name, 'external', null))
        );
        networkAccounts.testnet.push(...externalAccounts
            .filter(account => account.network === 'testnet')
            .map(account => createWalletAccount(account.privateKey, 'testnet', account.name, 'external', null))
        );

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

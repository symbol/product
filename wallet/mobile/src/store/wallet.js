import { FailedToSaveMnemonicError } from 'src/errors';
import { PersistentStorage, SecureStorage } from 'src/storage';
import { createWalletAccount } from 'src/utils/account';
import { createPrivateKeyFromMnemonic } from 'src/utils/wallet';

export default {
    namespace: 'wallet',
    state: {
        mnemonic: null,
        accounts: [],
        isPasscodeEnabled: true,
    },
    mutations: {
        setMnemonic(state, payload) {
            state.wallet.mnemonic = payload;
            return state;
        },
        setAccounts(state, payload) {
            state.wallet.accounts = payload;
            return state;
        },
        setIsPasscodeEnabled(state, payload) {
            state.wallet.isPasscodeEnabled = payload;
            return state;
        },
    },
    actions: {
        loadState: async ({ commit }) => {
            const mnemonic = await SecureStorage.getMnemonic();
            const accounts = await SecureStorage.getAccounts();
            const isPasscodeEnabled = await PersistentStorage.getIsPasscodeEnabled();

            commit({ type: 'wallet/setMnemonic', payload: mnemonic });
            commit({ type: 'wallet/setAccounts', payload: accounts });
            commit({ type: 'wallet/setIsPasscodeEnabled', payload: isPasscodeEnabled });
        },

        saveMnemonic: async ({}, mnemonic) => {
            let savedMnemonic;

            try {
                await SecureStorage.setMnemonic(mnemonic);
                savedMnemonic = await SecureStorage.getMnemonic();
            }
            catch(e) {
                throw FailedToSaveMnemonicError(e.message)
            }

            if (mnemonic !== savedMnemonic) {
                throw FailedToSaveMnemonicError('Mnemonic does not match');
            }
        },

        createSeedAccount: async ({ commit }, { index, name, networkIdentifier }) => {
            const accountType = 'seed';
            const mnemonic = await SecureStorage.getMnemonic();
            const privateKey = createPrivateKeyFromMnemonic(index, mnemonic, networkIdentifier);
            const walletAccount = createWalletAccount(privateKey, networkIdentifier, name, accountType, index);
            const accounts = [] //await SecureStorage.getAccounts() || [];
            accounts.push(walletAccount);
            await SecureStorage.setAccounts(accounts);

            commit({ type: 'wallet/setAccounts', payload: accounts });
        },

        removeAccount: async ({ commit }, privateKey) => {
            const accounts = await SecureStorage.getAccounts();
            const updatedAccounts = accounts.filter(account => account.privateKey !== privateKey);
            await SecureStorage.setAccounts(updatedAccounts);

            commit({ type: 'wallet/setAccounts', payload: updatedAccounts });
        },
    },
};

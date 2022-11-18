import { hasUserSetPinCode } from '@haskkor/react-native-pincode';
import { FailedToSaveMnemonicError } from 'src/errors';
import { PersistentStorage, SecureStorage } from 'src/storage';
import { addressFromPrivateKey, createPrivateKeyFromMnemonic, createWalletAccount } from 'src/utils';

const MAX_SEED_ACCOUNTS = 15;

export default {
    namespace: 'wallet',
    state: {
        mnemonic: null,
        accounts: {
            mainnet: [],
            testnet: []
        },
        seedAddresses: {
            mainnet: [],
            testnet: []
        },
        selectedAccountId: null,
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
        setSeedAddresses(state, payload) {
            state.wallet.seedAddresses = payload;
            return state;
        },
        setSelectedAccountId(state, payload) {
            state.wallet.selectedAccountId = payload;
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
            const seedAddresses = await PersistentStorage.getSeedAddresses();
            const selectedAccountId = await SecureStorage.getSelectedAccountId();
            const isPasscodeEnabled = await hasUserSetPinCode();

            commit({ type: 'wallet/setMnemonic', payload: mnemonic });
            commit({ type: 'wallet/setAccounts', payload: accounts });
            commit({ type: 'wallet/setSeedAddresses', payload: seedAddresses });
            commit({ type: 'wallet/setSelectedAccountId', payload: selectedAccountId || 0});
            commit({ type: 'wallet/setIsPasscodeEnabled', payload: isPasscodeEnabled || false});
        },

        saveMnemonic: async ({ commit }, mnemonic) => {
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

            commit({ type: 'wallet/setMnemonic', payload: mnemonic });
        },

        loadSeedAddresses: async ({ state, commit }) => {
            const { networkIdentifier } = state.network;
            const { seedAddresses } = state.wallet;
            const mnemonic = await SecureStorage.getMnemonic();

            const addresses = [];
            
            for (index = 0; index < MAX_SEED_ACCOUNTS; ++i) {
                const privateKey = createPrivateKeyFromMnemonic(index, mnemonic, networkIdentifier);
                const address = addressFromPrivateKey(privateKey);
                const balance = 0;
                addresses[index] = ({ address, balance });
            }

            const updatedSeedAddresses = {
                ...seedAddresses,
                [networkIdentifier]: addresses
            };

            commit({ type: 'wallet/setSeedAddresses', payload: updatedSeedAddresses });
            await PersistentStorage.setSeedAddresses(updatedSeedAddresses);
        },

        selectAccount: async ({ commit }, privateKey) => {
            await SecureStorage.setSelectedAccountId(privateKey);
            commit({ type: 'wallet/setSelectedAccountId', payload: privateKey });
        },

        addSeedAccount: async ({ commit, dispatchAction, state }, { index, name }) => {
            const { networkIdentifier } = state.network;
            const { mnemonic } = state.wallet;
            const accountType = 'seed';
            const privateKey = createPrivateKeyFromMnemonic(index, mnemonic, networkIdentifier);
            const walletAccount = createWalletAccount(privateKey, networkIdentifier, name, accountType, index);
            const accounts = await SecureStorage.getAccounts();
            const networkAccounts = accounts[networkIdentifier];
            const isAccountAlreadyExists = networkAccounts.find(account => account.index === index);
            
            if (isAccountAlreadyExists) {
                throw Error('failed_add_account_already_exists');
            }
            
            networkAccounts.push(walletAccount);
            
            await SecureStorage.setAccounts(accounts);
            commit({ type: 'wallet/setAccounts', payload: accounts });
            
            await dispatchAction({ type: 'wallet/selectAccount', payload: privateKey });
        },

        removeAccount: async ({ commit }, privateKey) => {
            const accounts = await SecureStorage.getAccounts();
            const updatedAccounts = accounts.filter(account => account.privateKey !== privateKey);
            await SecureStorage.setAccounts(updatedAccounts);

            commit({ type: 'wallet/setAccounts', payload: updatedAccounts });
        },
    },
};

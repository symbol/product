import { hasUserSetPinCode } from '@haskkor/react-native-pincode';
import { FailedToSaveMnemonicError } from 'src/errors';
import { AccountService } from 'src/services';
import { PersistentStorage, SecureStorage } from 'src/storage';
import { addressFromPrivateKey, createPrivateKeysFromMnemonic, createWalletAccount, getMosaicRelativeAmount, getNativeMosaicAmount } from 'src/utils';
import { config } from 'src/config';

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
        balances: {},
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
        setBalances(state, payload) {
            state.wallet.balances = payload;
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
        loadAll: async ({ dispatchAction }) => {
            await dispatchAction({type: 'wallet/loadState' });
            await dispatchAction({type: 'network/loadState' });
            await dispatchAction({type: 'account/loadState' });
        },
        loadState: async ({ commit }) => {
            const mnemonic = await SecureStorage.getMnemonic();
            const accounts = await SecureStorage.getAccounts();
            const seedAddresses = await PersistentStorage.getSeedAddresses();
            const balances = await PersistentStorage.getBalances();
            const selectedAccountId = await SecureStorage.getSelectedAccountId();
            const isPasscodeEnabled = await hasUserSetPinCode();

            commit({ type: 'wallet/setMnemonic', payload: mnemonic });
            commit({ type: 'wallet/setAccounts', payload: accounts });
            commit({ type: 'wallet/setSeedAddresses', payload: seedAddresses });
            commit({ type: 'wallet/setBalances', payload: balances });
            commit({ type: 'wallet/setSelectedAccountId', payload: selectedAccountId || 0});
            commit({ type: 'wallet/setIsPasscodeEnabled', payload: isPasscodeEnabled || false});
        },

        saveMnemonic: async ({ commit, dispatchAction }, { mnemonic, name }) => {
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
            await dispatchAction({ type: 'wallet/addSeedAccount', payload: { name, index: 0, networkIdentifier: 'testnet' } });
            await dispatchAction({ type: 'wallet/addSeedAccount', payload: { name, index: 0, networkIdentifier: 'mainnet' } });
        },

        generateSeedAddresses: async ({ state, commit }) => {
            const { networkIdentifier } = state.network;
            const { seedAddresses, mnemonic } = state.wallet;
            const indexes = [...Array(config.maxSeedAccounts).keys()];
            const privateKeys = createPrivateKeysFromMnemonic(mnemonic, indexes, networkIdentifier);
            const updatedSeedAddresses = {...seedAddresses};

            updatedSeedAddresses[networkIdentifier] = privateKeys.map(privateKey => addressFromPrivateKey(privateKey, networkIdentifier));

            commit({ type: 'wallet/setSeedAddresses', payload: updatedSeedAddresses });
            await PersistentStorage.setSeedAddresses(updatedSeedAddresses);
        },

        selectAccount: async ({ commit }, privateKey) => {
            await SecureStorage.setSelectedAccountId(privateKey);
            commit({ type: 'wallet/setSelectedAccountId', payload: privateKey });
        },

        addSeedAccount: async ({ commit, dispatchAction, state }, { index, name, networkIdentifier }) => {
            const { mnemonic } = state.wallet;
            const accountType = 'seed';
            const privateKeys = createPrivateKeysFromMnemonic(mnemonic, [index], networkIdentifier);
            const privateKey = privateKeys[0];
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

        saveAccounts: async ({ commit, state }, {accounts, networkIdentifier}) => {
            const updatedAccounts = await SecureStorage.getAccounts();
            updatedAccounts[networkIdentifier] = [...accounts];
            if (!(updatedAccounts && updatedAccounts.testnet && updatedAccounts.mainnet)) {
                // noerror
                throw Error('failed_save_accounts_incomplete')
            }

            await SecureStorage.setAccounts(updatedAccounts);
            commit({type: 'wallet/setAccounts', payload: updatedAccounts});
        },

        fetchBalance: async ({ commit, state }, address) => {
            const { networkProperties } = state.network;
            const balances = await PersistentStorage.getBalances();
            let balance;
            try {
                const accountInfo = await AccountService.fetchAccountInfo(networkProperties, address);
                const accountMosaics = accountInfo.mosaics;
                absoluteAmount = getNativeMosaicAmount(accountMosaics, networkProperties.networkCurrency.mosaicId);
                balance = getMosaicRelativeAmount(absoluteAmount, networkProperties.networkCurrency.divisibility);
            }
            catch(error) {
                // noerror
                if (error.message === 'error_fetch_not_found') {
                    balance = 0;
                }
                else {
                    throw Error('error_fetch_balance');
                }
            }
            const addressBalance = {
                [address]: balance
            };
            const updatedBalances = {...balances, ...addressBalance}
            await PersistentStorage.setBalances(updatedBalances);

            commit({ type: 'wallet/setBalances', payload: updatedBalances });
        },
    },
};

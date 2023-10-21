import { hasUserSetPinCode } from '@haskkor/react-native-pincode';
import { AccountService, MosaicService } from 'src/services';
import { PersistentStorage, SecureStorage } from 'src/storage';
import {
    addressFromPrivateKey,
    createPrivateKeysFromMnemonic,
    createWalletAccount,
    getMosaicRelativeAmount,
    getNativeMosaicAmount,
} from 'src/utils';
import { config } from 'src/config';

export default {
    namespace: 'wallet',
    state: {
        isReady: false, // wether the wallet is ready to fetch any data (network props and cache is loaded)
        mnemonic: null, // current wallet mnemonic backup phrase
        accounts: {
            // all accounts added to the wallet
            mainnet: [],
            testnet: [],
        },
        seedAddresses: {
            // all (count specified in config) wallet seed addresses
            mainnet: [],
            testnet: [],
        },
        balances: {}, // account balances by address
        mosaicInfos: {
            // mosaic infos (name, divisibility, etc.)
            mainnet: {},
            testnet: {},
        },
        selectedAccountId: null, // selected wallet account by user
        isPasscodeEnabled: true, // wether the user enabled the PIN-code security
    },
    mutations: {
        setReady(state, payload) {
            state.wallet.isReady = payload;
            return state;
        },
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
        setMosaicInfos(state, payload) {
            state.wallet.mosaicInfos = payload;
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
        // Load data from cache in all modules
        loadAll: async ({ dispatchAction }) => {
            await dispatchAction({ type: 'wallet/loadState' });
            await dispatchAction({ type: 'network/loadState' });
            await dispatchAction({ type: 'account/loadState' });
            await dispatchAction({ type: 'addressBook/loadState' });
            await dispatchAction({ type: 'transaction/loadState' });
            await dispatchAction({ type: 'market/loadState' });
        },
        // Fetch latest data from API in all modules
        fetchAll: async ({ dispatchAction }) => {
            await dispatchAction({ type: 'network/fetchData' });
            await dispatchAction({ type: 'account/fetchData' });
            await dispatchAction({ type: 'transaction/fetchData', payload: {} });
            await dispatchAction({ type: 'market/fetchData' });
        },
        // Load data from cache or set an empty values
        loadState: async ({ commit }) => {
            const mnemonic = await SecureStorage.getMnemonic();
            const accounts = await SecureStorage.getAccounts();
            const seedAddresses = await PersistentStorage.getSeedAddresses();
            const balances = await PersistentStorage.getBalances();
            const mosaicInfos = await PersistentStorage.getMosaicInfos();
            const selectedAccountId = await SecureStorage.getSelectedAccountId();
            const isPasscodeEnabled = await hasUserSetPinCode();

            commit({ type: 'wallet/setMnemonic', payload: mnemonic });
            commit({ type: 'wallet/setAccounts', payload: accounts });
            commit({ type: 'wallet/setSeedAddresses', payload: seedAddresses });
            commit({ type: 'wallet/setBalances', payload: balances });
            commit({ type: 'wallet/setMosaicInfos', payload: mosaicInfos });
            commit({ type: 'wallet/setSelectedAccountId', payload: selectedAccountId || 0 });
            commit({ type: 'wallet/setIsPasscodeEnabled', payload: isPasscodeEnabled || false });
        },
        // Save mnemonic to wallet. Generate root accounts for all networks
        saveMnemonic: async ({ commit, dispatchAction }, { mnemonic, name, optInPrivateKey }) => {
            let savedMnemonic;

            await SecureStorage.setMnemonic(mnemonic);
            savedMnemonic = await SecureStorage.getMnemonic();

            if (mnemonic !== savedMnemonic) {
                throw Error('error_mnemonic_does_not_match');
            }

            commit({ type: 'wallet/setMnemonic', payload: mnemonic });
            await dispatchAction({ type: 'wallet/addSeedAccount', payload: { name, index: 0, networkIdentifier: 'testnet' } });
            await dispatchAction({ type: 'wallet/addSeedAccount', payload: { name, index: 0, networkIdentifier: 'mainnet' } });
            if (optInPrivateKey) {
                await dispatchAction({
                    type: 'wallet/addExternalAccount',
                    payload: {
                        name: 'Opt-In',
                        privateKey: optInPrivateKey,
                        networkIdentifier: 'mainnet',
                    },
                });
            }
            await dispatchAction({ type: 'wallet/loadAll' });
        },
        // Generate all (count specified in config) seed addresses
        generateSeedAddresses: async ({ state, commit }) => {
            const { networkIdentifier } = state.network;
            const { seedAddresses, mnemonic } = state.wallet;
            const indexes = [...Array(config.maxSeedAccounts).keys()];
            const privateKeys = createPrivateKeysFromMnemonic(mnemonic, indexes, networkIdentifier);
            const updatedSeedAddresses = { ...seedAddresses };

            updatedSeedAddresses[networkIdentifier] = privateKeys.map((privateKey) => addressFromPrivateKey(privateKey, networkIdentifier));

            commit({ type: 'wallet/setSeedAddresses', payload: updatedSeedAddresses });
            await PersistentStorage.setSeedAddresses(updatedSeedAddresses);
        },
        // Set selected account private key
        selectAccount: async ({ commit }, privateKey) => {
            await SecureStorage.setSelectedAccountId(privateKey);
            commit({ type: 'wallet/setSelectedAccountId', payload: privateKey });
        },
        // Add seed account to wallet
        addSeedAccount: async ({ commit, dispatchAction, state }, { index, name, networkIdentifier }) => {
            const { mnemonic } = state.wallet;
            const accountType = 'seed';
            const privateKeys = createPrivateKeysFromMnemonic(mnemonic, [index], networkIdentifier);
            const privateKey = privateKeys[0];
            const walletAccount = createWalletAccount(privateKey, networkIdentifier, name, accountType, index);
            const accounts = await SecureStorage.getAccounts();
            const networkAccounts = accounts[networkIdentifier];
            const isAccountAlreadyExists = networkAccounts.find((account) => account.index === index);

            if (isAccountAlreadyExists) {
                throw Error('error_failed_add_account_already_exists');
            }

            networkAccounts.push(walletAccount);

            await SecureStorage.setAccounts(accounts);
            commit({ type: 'wallet/setAccounts', payload: accounts });

            await dispatchAction({ type: 'wallet/selectAccount', payload: privateKey });
        },
        // Add external (private key) account to wallet
        addExternalAccount: async ({ commit, dispatchAction }, { privateKey, name, networkIdentifier }) => {
            const accountType = 'external';
            const walletAccount = createWalletAccount(privateKey, networkIdentifier, name, accountType, null);
            const accounts = await SecureStorage.getAccounts();
            const networkAccounts = accounts[networkIdentifier];
            const isAccountAlreadyExists = networkAccounts.find((account) => account.privateKey === privateKey);

            if (isAccountAlreadyExists) {
                throw Error('error_failed_add_account_already_exists');
            }

            networkAccounts.push(walletAccount);

            await SecureStorage.setAccounts(accounts);
            commit({ type: 'wallet/setAccounts', payload: accounts });

            await dispatchAction({ type: 'wallet/selectAccount', payload: privateKey });
        },
        // Remove account to wallet
        removeAccount: async ({ commit }, { privateKey, networkIdentifier }) => {
            const accounts = await SecureStorage.getAccounts();
            accounts[networkIdentifier] = accounts[networkIdentifier].filter((account) => account.privateKey !== privateKey);

            await SecureStorage.setAccounts(accounts);
            commit({ type: 'wallet/setAccounts', payload: accounts });
        },
        // Rename wallet account
        renameAccount: async ({ commit }, { privateKey, networkIdentifier, name }) => {
            const accounts = await SecureStorage.getAccounts();
            const account = accounts[networkIdentifier].find((account) => account.privateKey == privateKey);
            account.name = name;

            await SecureStorage.setAccounts(accounts);
            commit({ type: 'wallet/setAccounts', payload: accounts });
        },
        // Save account list (replace current list with the new one)
        saveAccounts: async ({ commit }, { accounts, networkIdentifier }) => {
            const updatedAccounts = await SecureStorage.getAccounts();
            updatedAccounts[networkIdentifier] = [...accounts];
            if (!(updatedAccounts && updatedAccounts.testnet && updatedAccounts.mainnet)) {
                throw Error('error_failed_save_accounts_incomplete');
            }

            await SecureStorage.setAccounts(updatedAccounts);
            commit({ type: 'wallet/setAccounts', payload: updatedAccounts });
        },
        // Fetch and cache account balance by address
        fetchBalance: async ({ commit, state }, address) => {
            const { networkProperties } = state.network;
            const balances = await PersistentStorage.getBalances();
            let balance;
            try {
                const accountInfo = await AccountService.fetchAccountInfo(networkProperties, address);
                const accountMosaics = accountInfo.mosaics;
                absoluteAmount = getNativeMosaicAmount(accountMosaics, networkProperties.networkCurrency.mosaicId);
                balance = getMosaicRelativeAmount(absoluteAmount, networkProperties.networkCurrency.divisibility);
            } catch (error) {
                if (error.message === 'error_fetch_not_found') {
                    balance = 0;
                } else {
                    throw Error('error_fetch_balance');
                }
            }
            const addressBalance = {
                [address]: balance,
            };
            const updatedBalances = { ...balances, ...addressBalance };
            await PersistentStorage.setBalances(updatedBalances);

            commit({ type: 'wallet/setBalances', payload: updatedBalances });
        },
        // Fetch and cache mosaic infos
        fetchMosaicInfos: async ({ commit, state }, mosaicIds) => {
            const { networkProperties, networkIdentifier } = state.network;
            const mosaicInfos = await PersistentStorage.getMosaicInfos();

            try {
                const fetchedMosaicInfos = await MosaicService.fetchMosaicInfos(networkProperties, mosaicIds);
                mosaicInfos[networkIdentifier] = {
                    ...mosaicInfos[networkIdentifier],
                    ...fetchedMosaicInfos,
                };
            } catch (error) {
                throw Error('error_fetch_mosaic_infos');
            }

            await PersistentStorage.setMosaicInfos(mosaicInfos);
            commit({ type: 'wallet/setMosaicInfos', payload: mosaicInfos });
        },
    },
};

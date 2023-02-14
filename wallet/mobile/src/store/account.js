import { AccountService, MosaicService, NamespaceService } from 'src/services';
import { PersistentStorage } from 'src/storage';
import { getMosaicsWithRelativeAmounts } from 'src/utils';

export default {
    namespace: 'account',
    state: {
        current: null, // current account info (address, private key, name, etc.)
        isReady: false, // wether account data is loaded
        isMultisig: false, // wether account data is multisig
        cosignatories: [], // if an account is multisig, contains the list of its cosigners
        mosaics: [], // account owned mosaics
        namespaces: [], // account owned namespaces
    },
    mutations: {
        setCurrent(state, payload) {
            state.account.current = payload;
            return state;
        },
        setIsReady(state, payload) {
            state.account.isReady = payload;
            return state;
        },
        setIsMultisig(state, payload) {
            state.account.isMultisig = payload;
            return state;
        },
        setCosignatories(state, payload) {
            state.account.cosignatories = payload;
            return state;
        },
        setMosaics(state, payload) {
            state.account.mosaics = payload;
            return state;
        },
        setNamespaces(state, payload) {
            state.account.namespaces = payload;
            return state;
        },
    },
    actions: {
        // Load data from cache or set an empty values
        loadState: async ({ commit, state }) => {
            const { networkIdentifier } = state.network;
            const { selectedAccountId, accounts } = state.wallet;
            const networkAccounts = accounts[networkIdentifier];
            const currentAccount = networkAccounts.find((account) => account.privateKey === selectedAccountId) || networkAccounts[0];
            const accountInfos = await PersistentStorage.getAccountInfos();
            const accountInfo = accountInfos[currentAccount?.address];

            if (accountInfo) {
                commit({ type: 'account/setIsMultisig', payload: accountInfo.isMultisig });
                commit({ type: 'account/setCosignatories', payload: accountInfo.cosignatories });
                commit({ type: 'account/setMosaics', payload: accountInfo.mosaics });
                commit({ type: 'account/setNamespaces', payload: accountInfo.namespaces });
            } else {
                commit({ type: 'account/setIsMultisig', payload: false });
                commit({ type: 'account/setCosignatories', payload: [] });
                commit({ type: 'account/setMosaics', payload: [] });
                commit({ type: 'account/setNamespaces', payload: [] });
            }

            commit({ type: 'account/setCurrent', payload: currentAccount });
            commit({ type: 'account/setIsReady', payload: false });
        },
        // Fetch latest data from API
        fetchData: async ({ dispatchAction, state }) => {
            const { address } = state.account.current;

            await dispatchAction({ type: 'wallet/fetchBalance', payload: address });
            await dispatchAction({ type: 'account/fetchInfo' });
        },
        // Fetch account and multisig info, owned mosaics and namespaces. Store to cache
        fetchInfo: async ({ commit, state }) => {
            const { address } = state.account.current;
            const { networkProperties } = state.network;

            let mosaics = [];
            try {
                const accountInfo = await AccountService.fetchAccountInfo(networkProperties, address);
                mosaics = accountInfo.mosaics;
            } catch (error) {
                if (error.message !== 'error_fetch_not_found') {
                    throw Error('error_fetch_account_info');
                }
            }

            let isMultisig;
            let cosignatories = [];
            try {
                const multisigInfo = await AccountService.fetchMultisigInfo(networkProperties, address);
                cosignatories = multisigInfo.cosignatories;
                isMultisig = cosignatories.length > 0;
            } catch {
                isMultisig = false;
            }

            const mosaicIds = mosaics.map((mosaic) => mosaic.id);
            const mosaicInfos = await MosaicService.fetchMosaicInfos(networkProperties, mosaicIds);
            const formattedMosaics = getMosaicsWithRelativeAmounts(mosaics, mosaicInfos);

            const namespaces = await NamespaceService.fetchAccountNamespaces(address, networkProperties);

            commit({ type: 'account/setIsMultisig', payload: isMultisig });
            commit({ type: 'account/setCosignatories', payload: cosignatories });
            commit({ type: 'account/setMosaics', payload: formattedMosaics });
            commit({ type: 'account/setNamespaces', payload: namespaces });
            commit({ type: 'account/setIsReady', payload: true });

            const accountInfo = {
                mosaics: formattedMosaics,
                namespaces,
                isMultisig,
                cosignatories,
            };
            const accountInfos = await PersistentStorage.getAccountInfos();
            accountInfos[address] = accountInfo;
            PersistentStorage.setAccountInfos(accountInfos);
        },
    },
};

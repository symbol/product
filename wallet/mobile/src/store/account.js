import { AccountService, MosaicService, NamespaceService } from "src/services";
import { getMosaicsWithRelativeAmounts } from "src/utils";

export default {
    namespace: 'account',
    state: {
        current: null,
        isReady: false,
        isMultisig: false,
        cosignatories: [],
        mosaics: [],
        namespaces: [],
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
        loadState: async ({ commit, state }) => {
            const { networkIdentifier } = state.network;
            const { selectedAccountId, accounts } = state.wallet;
            const networkAccounts = accounts[networkIdentifier];
            console.log('Load accounts', {networkIdentifier, accounts})
            const currentAccount = networkAccounts.find(account => account.privateKey === selectedAccountId) || networkAccounts[0];

            commit({type: 'account/setCurrent', payload: currentAccount});
            commit({type: 'account/setIsReady', payload: false});
            commit({type: 'account/setIsMultisig', payload: false});
            commit({type: 'account/setCosignatories', payload: []});
            commit({type: 'account/setMosaics', payload: []});
            commit({type: 'account/setNamespaces', payload: []});
        },
        fetchData: async ({ dispatchAction, state }) => {
            const { address } = state.account.current;
           
            await dispatchAction({type: 'wallet/fetchBalance', payload: address});
            await dispatchAction({type: 'account/fetchInfo'});
        },
        fetchInfo: async ({ commit, state }) => {
            const { address } = state.account.current;
            const { networkProperties } = state.network;

            let mosaics = [];
            try {
                const accountInfo = await AccountService.fetchAccountInfo(networkProperties, address);
                mosaics = accountInfo.mosaics;
            }
            catch(error) {
                if (error.message === 'error_fetch_not_found') {
                    balance = 0;
                }
                else {
                    throw Error('error_fetch_account_info');
                }
            }

            let isMultisig;
            let cosignatories = [];
            try {
                const multisigInfo = await AccountService.fetchMultisigInfo(networkProperties, address);
                cosignatories = multisigInfo.cosignatories;
                isMultisig = cosignatories.length > 0;
            }
            catch {
                isMultisig = false;
            }

            const mosaicIds = mosaics.map(mosaic => mosaic.id);
            const mosaicInfos = await MosaicService.fetchMosaicInfos(networkProperties, mosaicIds);
            const formattedMosaics = getMosaicsWithRelativeAmounts(mosaics, mosaicInfos);

            const namespaces = await NamespaceService.fetchAccountNamespaces(address, networkProperties);
            
            commit({type: 'account/setIsMultisig', payload: isMultisig});
            commit({type: 'account/setCosignatories', payload: cosignatories});
            commit({type: 'account/setMosaics', payload: formattedMosaics});
            commit({type: 'account/setNamespaces', payload: namespaces});
            commit({type: 'account/setIsReady', payload: true});
        },
    },
};

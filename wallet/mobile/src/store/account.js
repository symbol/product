import { AccountService, MosaicService } from "src/services";
import { getMosaicsWithRelativeAmounts } from "src/utils";

export default {
    namespace: 'account',
    state: {
        current: null,
        mosaics: []
    },
    mutations: {
        setCurrent(state, payload) {
            state.account.current = payload;
            return state;
        },
        setMosaics(state, payload) {
            state.account.mosaics = payload;
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
        },
        fetchData: async ({ dispatchAction, state }) => {
            const { address } = state.account.current;
           
            await dispatchAction({type: 'wallet/fetchBalance', payload: address});
            await dispatchAction({type: 'account/fetchInfo'});
        },
        fetchInfo: async ({ commit, dispatchAction, state }) => {
            const { address } = state.account.current;
            const { networkProperties } = state.network;

            let mosaics = [];
            try {
                const accountInfo = await AccountService.fetchAccountInfo(networkProperties, address);
                mosaics = accountInfo.mosaics;
            }
            catch(error) {
                // noerror
                if (error.message === 'error_fetch_not_found') {
                    balance = 0;
                }
                else {
                    throw Error('error_fetch_account_info');
                }
            }

            const mosaicIds = mosaics.map(mosaic => mosaic.id);
            const mosaicInfos = await MosaicService.fetchMosaicInfos(networkProperties, mosaicIds);
            const formattedMosaics = getMosaicsWithRelativeAmounts(mosaics, mosaicInfos);
            
            commit({type: 'account/setMosaics', payload: formattedMosaics});
        },
    },
};

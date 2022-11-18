// import { TransactionService } from 'src/services';

export default {
    namespace: 'transaction',
    state: {
        partial: [],
        unconfirmed: [],
        confirmed: [],
    },
    mutations: {
        setPartial(state, payload) {
            state.account.partial = payload;
            return state;
        },
        setUnconfirmed(state, payload) {
            state.account.unconfirmed = payload;
            return state;
        },
        setConfirmed(state, payload) {
            state.account.confirmed = payload;
            return state;
        },
    },
    actions: {
        loadState: async ({ commit, state }) => {
            
            

            commit({ type: 'account/setCurrent', payload: currentAccount });
        },
        fetchPartial: async ({ commit, state }) => {
            const { networkIdentifier, networkProperties } = state.network;
            const { current } = state.account;

            const options = {
                group: 'partial',
            };
            // const transactions = await TransactionService.fetchAccountTransactions(current, networkProperties, [], options);

            // commit({ type: 'transaction/partial', payload: transactions });
        },
        clearCache: async () => {

        }
    },
};

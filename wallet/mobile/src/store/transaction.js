import { TransactionService } from 'src/services';
import { PersistentStorage } from 'src/storage';

export default {
    namespace: 'transaction',
    state: {
        partial: [],
        unconfirmed: [],
        confirmed: [],
    },
    mutations: {
        setPartial(state, payload) {
            state.transaction.partial = payload;
            return state;
        },
        setUnconfirmed(state, payload) {
            state.transaction.unconfirmed = payload;
            return state;
        },
        setConfirmed(state, payload) {
            state.transaction.confirmed = payload;
            return state;
        },
    },
    actions: {
        loadState: async ({ commit, state }) => {
            const { current } = state.account;
            const latestTransactions = await PersistentStorage.getLatestTransactions();
            const accountTransactions = latestTransactions[current?.address] || [];
            
            commit({type: 'transaction/setConfirmed', payload: accountTransactions});
        },
        fetchData: async ({ commit, state }) => {
            const { networkProperties } = state.network;
            const { current } = state.account;

            const [partial, unconfirmed, confirmed] = await Promise.all([
                TransactionService.fetchAccountTransactions(current, networkProperties, {group: 'partial'}),
                TransactionService.fetchAccountTransactions(current, networkProperties, {group: 'unconfirmed'}),
                TransactionService.fetchAccountTransactions(current, networkProperties, {group: 'confirmed'}),
            ]);

            commit({type: 'transaction/setPartial', payload: partial});
            commit({type: 'transaction/setUnconfirmed', payload: unconfirmed});
            commit({type: 'transaction/setConfirmed', payload: confirmed});

            const latestTransactions = await PersistentStorage.getLatestTransactions();
            latestTransactions[current.address] = confirmed;
            await PersistentStorage.setLatestTransactions(latestTransactions);
        },
    },
};

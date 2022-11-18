import { PersistentStorage } from 'src/storage';

export default {
    namespace: 'network',
    state: {
        networkIdentifier: 'mainnet',
        selectedNodeUrl: null,
        networkProperties: {
            nodeUrl: ''
        }
    },
    mutations: {
        setNetworkIdentifier(state, payload) {
            state.networkIdentifier = payload;
            return state;
        },
    },
    actions: {
        loadState: async ({ commit }) => {
            const networkIdentifier = await PersistentStorage.getNetworkIdentifier();

            commit({ type: 'network/setNetworkIdentifier', payload: networkIdentifier });
        },
    },
};

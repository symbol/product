import { PersistentStorage } from 'src/storage';

export default {
    namespace: 'network',
    state: {
        networkIdentifier: 'mainnet',
        ticker: 'XYM',
        selectedNodeUrl: null,
        nodeUrls: {
            mainnet: [
                
            ],
            testnet: [
                
            ]
        },
        networkProperties: {
            nodeUrl: ''
        }
    },
    mutations: {
        setNetworkIdentifier(state, payload) {
            state.network.networkIdentifier = payload;
            return state;
        },
        setSelectedNodeUrl(state, payload) {
            state.network.selectedNodeUrl = payload;
            return state;
        },
    },
    actions: {
        loadState: async ({ commit }) => {
            const networkIdentifier = await PersistentStorage.getNetworkIdentifier();
            const selectedNodeUrl = await PersistentStorage.getSelectedNode();

            commit({ type: 'network/setNetworkIdentifier', payload: networkIdentifier });
            commit({ type: 'network/setSelectedNodeUrl', payload: selectedNodeUrl });
        },
        changeNetwork: async ({ commit }, {networkIdentifier, nodeUrl}) => {
            await PersistentStorage.setNetworkIdentifier(networkIdentifier);
            await PersistentStorage.setSelectedNode(nodeUrl);

            commit({ type: 'network/setNetworkIdentifier', payload: networkIdentifier });
            commit({ type: 'network/setSelectedNodeUrl', payload: nodeUrl });
        },
    },
};

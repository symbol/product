import { NetworkService } from 'src/services';
import { PersistentStorage } from 'src/storage';

export default {
    namespace: 'network',
    state: {
        networkIdentifier: 'mainnet',
        ticker: 'XYM',
        selectedNodeUrl: null,
        nodeUrls: {
            mainnet: [],
            testnet: []
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
        setNodeUrls(state, payload) {
            state.network.nodeUrls = payload;
            return state;
        },
        setNetworkProperties(state, payload) {
            state.network.networkProperties = payload;
            return state;
        },
    },
    actions: {
        loadState: async ({ commit }) => {
            const networkIdentifier = await PersistentStorage.getNetworkIdentifier();
            const selectedNodeUrl = await PersistentStorage.getSelectedNode();

            commit({type: 'network/setNetworkIdentifier', payload: networkIdentifier});
            commit({type: 'network/setSelectedNodeUrl', payload: selectedNodeUrl});
        },
        fetchData: async ({ state, commit }) => {
            const { networkIdentifier, nodeUrls, selectedNodeUrl } = state.network;
            const updatedNodeUrls = {...nodeUrls};
            let updatedNetworkProperties = {};

            updatedNodeUrls[networkIdentifier] = await NetworkService.fetchNodeList(networkIdentifier);
            if (selectedNodeUrl) {
                updatedNetworkProperties = await NetworkService.fetchNetworkProperties(selectedNodeUrl);
            }
            else {
                for (const nodeUrl of updatedNodeUrls[networkIdentifier]) {
                    try {
                        updatedNetworkProperties = await NetworkService.fetchNetworkProperties(nodeUrl);
                        break;
                    }
                    catch {}
                }
            }

            commit({type: 'network/setNodeUrls', payload: updatedNodeUrls});
            commit({type: 'network/setNetworkProperties', payload: updatedNetworkProperties});
        },
        changeNetwork: async ({ commit }, {networkIdentifier, nodeUrl}) => {
            await PersistentStorage.setNetworkIdentifier(networkIdentifier);
            await PersistentStorage.setSelectedNode(nodeUrl);

            commit({type: 'network/setNetworkIdentifier', payload: networkIdentifier});
            commit({type: 'network/setSelectedNodeUrl', payload: nodeUrl});
        },
    },
};

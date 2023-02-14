import { config } from 'src/config';
import { NetworkService } from 'src/services';
import { PersistentStorage } from 'src/storage';

const defaultNetworkProperties = {
    nodeUrl: null,
    networkIdentifier: null,
    generationHash: null,
    epochAdjustment: null,
    transactionFees: {
        minFeeMultiplier: null,
        averageFeeMultiplier: null,
    },
    networkCurrency: {
        mosaicId: null,
        divisibility: null,
    },
};

export default {
    namespace: 'network',
    state: {
        connectionTimer: null, // timer id
        status: 'initial', // 'offline' 'failed-auto' 'failed-custom' 'connected'
        networkIdentifier: 'mainnet', // network identifier selected by the user
        selectedNodeUrl: null, // node url selected by the user
        ticker: 'XYM', // network currency ticker
        nodeUrls: { // node urls available for each network
            mainnet: [],
            testnet: []
        },
        networkProperties: defaultNetworkProperties, // node and network info
        chainHeight: null // just a chain height
    },
    mutations: {
        setConnectionTimer(state, payload) {
            state.network.connectionTimer = payload;
            return state;
        },
        setStatus(state, payload) {
            state.network.status = payload;
            return state;
        },
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
        setChainHeight(state, payload) {
            state.network.chainHeight = payload;
            return state;
        },
    },
    actions: {
        // Load data from cache
        loadState: async ({ commit }) => {
            const networkIdentifier = await PersistentStorage.getNetworkIdentifier();
            const selectedNodeUrl = await PersistentStorage.getSelectedNode();

            commit({type: 'network/setNetworkIdentifier', payload: networkIdentifier});
            commit({type: 'network/setSelectedNodeUrl', payload: selectedNodeUrl});
        },
        // Fetch latest data from API
        fetchData: async ({ dispatchAction }) => {
            await dispatchAction({type: 'network/fetchNodeList'});
        },
        // Fetch node list from statistics service
        fetchNodeList: async ({ state, commit }) => {
            const { networkIdentifier, nodeUrls } = state.network;
            const updatedNodeUrls = {...nodeUrls};
            updatedNodeUrls[networkIdentifier] = await NetworkService.fetchNodeList(networkIdentifier);

            commit({type: 'network/setNodeUrls', payload: updatedNodeUrls});
        },
        // Fetch properties from node
        fetchNetworkProperties: async ({ commit }, nodeUrl) => {
            const networkProperties = await NetworkService.fetchNetworkProperties(nodeUrl);

            commit({type: 'network/setNetworkProperties', payload: networkProperties});
            commit({type: 'network/setChainHeight', payload: networkProperties.chainHeight});
            commit({type: 'wallet/setReady', payload: true});
        },
        // Connect to node
        connect: async ({ dispatchAction }) => {
            try {
                await dispatchAction({type: 'network/fetchNodeList'});
            }
            finally {
                await dispatchAction({type: 'network/runConnectionJob'});
            }
        },
        // Try the connection each N times. Ping the node. Check if the node is down or the internet connection issue
        runConnectionJob: async ({ state, commit, dispatchAction }) => {
            const { connectionTimer, selectedNodeUrl, nodeUrls, networkIdentifier, networkProperties, status } = state.network;
            let { chainHeight } = state.network;
            const runAgain = () => {
                const newConnectionTimer = setTimeout(() => dispatchAction({type: 'network/runConnectionJob'}), config.connectionInterval);
                commit({type: 'network/setConnectionTimer', payload: newConnectionTimer});
            };

            clearTimeout(connectionTimer);

            // Try to connect to current node
            try {
                const nodeUrl = selectedNodeUrl || networkProperties.nodeUrl;
                chainHeight = await NetworkService.ping(nodeUrl);
                if (!networkProperties.nodeUrl) {
                    await dispatchAction({type: 'network/fetchNetworkProperties', payload: nodeUrl});
                }
                // Node is good.
                const newStatus = 'connected'; 
                if (newStatus !== status) {
                    commit({type: 'network/setStatus', payload: newStatus});
                }
                if (state.network.chainHeight !== chainHeight) {
                    commit({type: 'network/setChainHeight', payload: chainHeight});
                }
                dispatchAction({type: 'listener/connect'});
                runAgain();
                return;
            }
            catch {}

            // Try to fetch the node list to verify if it is not the internet connection issue
            try {
                await dispatchAction({type: 'network/fetchNodeList'});
                if (selectedNodeUrl) {
                    // Seems like there is an issue with the custom selected node.
                    const newStatus = 'failed-custom';
                    commit({type: 'network/setStatus', payload: newStatus});
                    runAgain();
                    return;
                }
            }
            catch {
                // Failed to fetch list. Seems like there is an internet connection issue.
                const newStatus = 'offline'; 
                commit({type: 'network/setStatus', payload: newStatus});
                runAgain();
                return;
            }

            // Auto select the node. Try to connect to the node one by one from the list 
            for (const nodeUrl of nodeUrls[networkIdentifier]) {
                try {
                    chainHeight = await NetworkService.ping(nodeUrl);
                    await dispatchAction({type: 'network/fetchNetworkProperties', payload: nodeUrl});
                    dispatchAction({type: 'listener/connect'});
                    const newStatus = 'connected'; 
                    commit({type: 'network/setStatus', payload: newStatus});
                    if (state.network.chainHeight !== chainHeight) {
                        commit({type: 'network/setChainHeight', payload: chainHeight});
                    }
                    runAgain();
                    return;
                }
                catch {}
            }

            const newStatus = 'failed-auto'; 
            commit({type: 'network/setStatus', payload: newStatus});
            runAgain();
            return;
        },
        // Cache new network identifier and node url. Reset store. Reconnect
        changeNetwork: async ({ commit, dispatchAction }, {networkIdentifier, nodeUrl}) => {
            await PersistentStorage.setNetworkIdentifier(networkIdentifier);
            await PersistentStorage.setSelectedNode(nodeUrl);

            commit({type: 'network/setStatus', payload: 'initial'});
            commit({type: 'network/setNetworkProperties', payload: defaultNetworkProperties});
            commit({type: 'network/setNetworkIdentifier', payload: networkIdentifier});
            commit({type: 'network/setSelectedNodeUrl', payload: nodeUrl});

            await dispatchAction({type: 'network/connect'});
        },
    },
};

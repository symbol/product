import { NetworkService } from 'src/services';
import { PersistentStorage } from 'src/storage';

export default {
    namespace: 'network',
    state: {
        connectionTimer: null,
        status: 'initial', // 'offline' 'failed-auto' 'failed-custom' 'connecting' 're-connecting' 'connected'
        networkIdentifier: 'mainnet',
        ticker: 'XYM',
        selectedNodeUrl: null,
        nodeUrls: {
            mainnet: [],
            testnet: []
        },
        networkProperties: {
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
        },
        chainHeight: null
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
        loadState: async ({ commit }) => {
            const networkIdentifier = await PersistentStorage.getNetworkIdentifier();
            const selectedNodeUrl = await PersistentStorage.getSelectedNode();

            commit({type: 'network/setNetworkIdentifier', payload: networkIdentifier});
            commit({type: 'network/setSelectedNodeUrl', payload: selectedNodeUrl});
        },
        fetchData: async ({ dispatchAction }) => {
            await dispatchAction({type: 'network/fetchNodeList'});
        },
        fetchNodeList: async ({ state, commit }) => {
            const { networkIdentifier, nodeUrls } = state.network;
            const updatedNodeUrls = {...nodeUrls};
            updatedNodeUrls[networkIdentifier] = await NetworkService.fetchNodeList(networkIdentifier);

            commit({type: 'network/setNodeUrls', payload: updatedNodeUrls});
        },
        fetchNetworkProperties: async ({ commit }, nodeUrl) => {
            const networkProperties = await NetworkService.fetchNetworkProperties(nodeUrl);

            commit({type: 'network/setNetworkProperties', payload: networkProperties});
            commit({type: 'network/setChainHeight', payload: networkProperties.chainHeight});
            commit({type: 'wallet/setReady', payload: true});
        },
        connect: async ({ dispatchAction }) => {
            try {
                await dispatchAction({type: 'network/fetchNodeList'});
            }
            finally {
                await dispatchAction({type: 'network/runConnectionJob'});
            }
        },
        runConnectionJob: async ({ state, commit, dispatchAction }) => {
            const { connectionTimer, selectedNodeUrl, nodeUrls, networkIdentifier, networkProperties, status } = state.network;
            let { chainHeight } = state.network;
            const runAgain = () => {
                const newConnectionTimer = setTimeout(() => dispatchAction({type: 'network/runConnectionJob'}), 15000);
                commit({type: 'network/setConnectionTimer', payload: newConnectionTimer});
            };

            clearTimeout(connectionTimer);

            console.log('Try to connect to current node')
            // Try to connect to current node
            try {
                const nodeUrl = selectedNodeUrl || networkProperties.nodeUrl;
                chainHeight = await NetworkService.ping(nodeUrl);
                if (!networkProperties.nodeUrl) {
                    await dispatchAction({type: 'network/fetchNetworkProperties', payload: nodeUrl});
                }
                // Node is good.
                console.log('connected')
                const newStatus = 'connected'; 
                if (newStatus !== status) {
                    commit({type: 'network/setStatus', payload: newStatus});
                    dispatchAction({type: 'listener/connect'});
                }
                if (state.network.chainHeight !== chainHeight) {
                    commit({type: 'network/setChainHeight', payload: chainHeight});
                }
                runAgain();
                return;
            }
            catch {}

            console.log('Try to fetch node list to verify it is not the internet connection issue')
            // Try to fetch node list to verify it is not the internet connection issue
            try {
                await dispatchAction({type: 'network/fetchNodeList'});
                if (selectedNodeUrl) {
                    console.log('failed-custom')
                    // Seems like there is an issue with the custom selected node.
                    const newStatus = 'failed-custom';
                    commit({type: 'network/setStatus', payload: newStatus});
                    runAgain();
                    return;
                }
            }
            catch {
                console.log('offline')
                // Seems like there is an internet connection issue.
                const newStatus = 'offline'; 
                commit({type: 'network/setStatus', payload: newStatus});
                runAgain();
                return;
            }

            console.log('Try auto')
            for (const nodeUrl of nodeUrls[networkIdentifier]) {
                try {
                    console.log('nodeUrl', nodeUrl)
                    chainHeight = await NetworkService.ping(nodeUrl);
                    await dispatchAction({type: 'network/fetchNetworkProperties', payload: nodeUrl});
                    dispatchAction({type: 'listener/connect'});
                    console.log('connected')
                    const newStatus = 'connected'; 
                    commit({type: 'network/setStatus', payload: newStatus});
                    runAgain();
                    return;
                }
                catch {}
            }

            if (state.network.chainHeight !== chainHeight) {
                commit({type: 'network/setChainHeight', payload: chainHeight});
            }

            console.log('failed-auto')
            const newStatus = 'failed-auto'; 
            commit({type: 'network/setStatus', payload: newStatus});
            runAgain();
            return;
        },
        changeNetwork: async ({ commit, dispatchAction }, {networkIdentifier, nodeUrl}) => {
            await PersistentStorage.setNetworkIdentifier(networkIdentifier);
            await PersistentStorage.setSelectedNode(nodeUrl);

            await dispatchAction ({type: 'network/fetchNetworkProperties', payload: nodeUrl})
            commit({type: 'network/setNetworkIdentifier', payload: networkIdentifier});
            commit({type: 'network/setSelectedNodeUrl', payload: nodeUrl});
        },
    },
};

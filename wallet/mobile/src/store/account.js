export default {
    namespace: 'account',
    state: {
        current: null,
    },
    mutations: {
        setCurrent(state, payload) {
            state.account.current = payload;
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

            commit({ type: 'account/setCurrent', payload: currentAccount });
        },
    },
};

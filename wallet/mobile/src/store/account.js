export default {
    namespace: 'account',
    state: {
        current: {},
    },
    mutations: {
        setCurrent(state, payload) {
            state.account.current = payload;
            return state;
        },
    },
    actions: {
        loadState: async ({ commit, state }) => {
            const { accounts } = state.wallet;
            const current = accounts[0];

            commit({ type: 'account/setCurrent', payload: current });
        },
    },
};

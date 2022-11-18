import { createPrivateKeyFromMnemonic, createWalletAccount, isPublicOrPrivateKey } from "src/utils";

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
            const { networkIdentifier } = state.network;
            const { selectedAccountId, accounts } = state.wallet;
            const networkAccounts = accounts[networkIdentifier];
            const currentAccount = networkAccounts.find(account => account.privateKey === selectedAccountId);

            commit({ type: 'account/setCurrent', payload: currentAccount });
        },
    },
};

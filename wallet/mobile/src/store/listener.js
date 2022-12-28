import { showMessage } from 'react-native-flash-message';
import { ListenerService } from 'src/services';
import { handleError } from 'src/utils';

export default {
    namespace: 'listener',
    state: {
        listener: null
    },
    mutations: {
        setListener(state, payload) {
            state.listener.listener = payload;
            return state;
        },
    },
    actions: {
        connect: async ({ state, commit, dispatchAction }) => {
            console.log('[Listener] connecting...')
            const { listener } = state.listener;
            const { networkProperties } = state.network;
            const { current } = state.account;

            if (listener) {
                listener.close();
            }

            try {
                const newListener = await ListenerService.listen(
                    networkProperties, 
                    current.address,
                    {
                        onConfirmedAdd: () => {
                            dispatchAction({type: 'account/fetchData'});
                            dispatchAction({type: 'transaction/fetchData', payload: true});
                            showMessage({message: 'Transaction Confirmed', type: 'success'})
                        },
                        onUnconfirmedAdd: () => {
                            dispatchAction({type: 'transaction/fetchData', payload: true});
                        },
                        onUnconfirmedRemove: () => {
                            dispatchAction({type: 'transaction/fetchData', payload: true});
                        },
                        onAggregateBondedAdd: () => {
                            dispatchAction({type: 'transaction/fetchData', payload: true});
                            showMessage({message: 'Aggregate Bonded Transaction', type: 'warning'})
                        },
                        onAggregateBondedRemove: () => {
                            dispatchAction({type: 'transaction/fetchData', payload: true});
                        },
                        onTransactionError: (e) => handleError(Error(e.code))
                    }
                );
                commit({type: 'listener/setListener', payload: newListener});
            }
            finally {
                setTimeout(() => dispatchAction({type: 'listener/connect'}), 15000);
            }
        },
    }
};

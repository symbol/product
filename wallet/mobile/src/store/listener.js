import { showMessage } from 'react-native-flash-message';
import { $t } from 'src/localization';
import { ListenerService } from 'src/services';
import { handleError } from 'src/utils';

export default {
    namespace: 'listener',
    state: {
        listener: null,
    },
    mutations: {
        setListener(state, payload) {
            state.listener.listener = payload;
            return state;
        },
    },
    actions: {
        connect: async ({ state, commit, dispatchAction }) => {
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
                            showMessage({message: $t('message_transactionConfirmed'), type: 'success'})
                        },
                        onUnconfirmedAdd: () => {
                            dispatchAction({type: 'transaction/fetchData', payload: true});
                        },
                        onUnconfirmedRemove: () => {
                            dispatchAction({type: 'transaction/fetchData', payload: true});
                        },
                        onAggregateBondedAdd: () => {
                            dispatchAction({type: 'transaction/fetchData', payload: true});
                            showMessage({message: $t('message_newAggregateBondedTransaction'), type: 'warning'})
                        },
                        onAggregateBondedRemove: () => {
                            dispatchAction({type: 'transaction/fetchData', payload: true});
                        },
                        onTransactionError: (e) => handleError(Error(`error_${e.code}`))
                    }
                );
                commit({type: 'listener/setListener', payload: newListener});
            }
            catch {}
        },
    }
};

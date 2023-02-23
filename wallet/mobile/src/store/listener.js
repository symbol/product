import { DeviceEventEmitter } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import { Constants } from 'src/config';
import { $t } from 'src/localization';
import { ListenerService } from 'src/services';
import { handleError } from 'src/utils';

export default {
    namespace: 'listener',
    state: {
        listener: null, // listener object
    },
    mutations: {
        setListener(state, payload) {
            state.listener.listener = payload;
            return state;
        },
    },
    actions: {
        // subscribe to all
        connect: async ({ state, commit, dispatchAction }) => {
            const { listener } = state.listener;
            const { networkProperties } = state.network;
            const { current } = state.account;

            if (listener) {
                listener.close();
            }

            try {
                const newListener = await ListenerService.listen(networkProperties, current.address, {
                    // handle confirmed transactions
                    onConfirmedAdd: () => {
                        dispatchAction({ type: 'account/fetchData' });
                        dispatchAction({ type: 'transaction/fetchData', payload: true });
                        DeviceEventEmitter.emit(Constants.Events.CONFIRMED_TRANSACTION);
                        showMessage({ message: $t('message_transactionConfirmed'), type: 'success' });
                    },
                    // handle unconfirmed transactions
                    onUnconfirmedAdd: () => {
                        dispatchAction({ type: 'transaction/fetchData', payload: true });
                    },
                    // handle unconfirmed transactions
                    onUnconfirmedRemove: () => {
                        dispatchAction({ type: 'transaction/fetchData', payload: true });
                    },
                    // handle aggregate bonded transactions
                    onAggregateBondedAdd: () => {
                        dispatchAction({ type: 'transaction/fetchData', payload: true });
                        showMessage({ message: $t('message_newAggregateBondedTransaction'), type: 'warning' });
                    },
                    // handle aggregate bonded transactions
                    onAggregateBondedRemove: () => {
                        dispatchAction({ type: 'transaction/fetchData', payload: true });
                    },
                    // handle transaction error
                    onTransactionError: (e) => handleError(Error(`error_${e.code}`)),
                });
                commit({ type: 'listener/setListener', payload: newListener });
            } catch {}
        },
    },
};

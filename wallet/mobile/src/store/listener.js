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
                        dispatchAction({ type: 'transaction/fetchData', payload: { keepPages: true } });
                        DeviceEventEmitter.emit(Constants.Events.CONFIRMED_TRANSACTION);
                        showMessage({ message: $t('message_transactionConfirmed'), type: 'info' });
                    },
                    // handle unconfirmed transactions
                    onUnconfirmedAdd: () => {
                        dispatchAction({ type: 'transaction/fetchData', payload: { keepPages: true } });
                    },
                    // handle unconfirmed transactions
                    onUnconfirmedRemove: () => {
                        dispatchAction({ type: 'transaction/fetchData', payload: { keepPages: true } });
                    },
                    // handle aggregate bonded transactions
                    onAggregateBondedAdd: () => {
                        dispatchAction({ type: 'transaction/fetchData', payload: { keepPages: true } });
                        showMessage({ message: $t('message_newAggregateBondedTransaction'), type: 'info' });
                    },
                    // handle aggregate bonded transactions
                    onAggregateBondedRemove: () => {
                        dispatchAction({ type: 'transaction/fetchData', payload: { keepPages: true } });
                    },
                    // handle transaction error
                    onTransactionError: (e) => handleError(Error(`error_${e.code}`)),
                });
                commit({ type: 'listener/setListener', payload: newListener });
            } catch {}
        },
    },
};

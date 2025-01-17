import { DeviceEventEmitter } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import { ControllerEventName } from 'src/constants';
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
                const newListener = new ListenerService(networkProperties, current);
                await newListener.open();
                newListener.listenTransactions('confirmed', () => {
                    dispatchAction({ type: 'account/fetchData' });
                    dispatchAction({ type: 'transaction/fetchData', payload: { keepPages: true } });
                    DeviceEventEmitter.emit(ControllerEventName.CONFIRMED_TRANSACTION);
                    showMessage({ message: $t('message_transactionConfirmed'), type: 'info' });
                })
                newListener.listenTransactions('unconfirmed', () => {
                    DeviceEventEmitter.emit(ControllerEventName.TRANSACTION_UNCONFIRMED);
                    dispatchAction({ type: 'transaction/fetchData', payload: { keepPages: true } });
                },)
                newListener.listenTransactions('partial', () => {
                    DeviceEventEmitter.emit(ControllerEventName.PARTIAL_TRANSACTION);
                    dispatchAction({ type: 'transaction/fetchData', payload: { keepPages: true } });
                    showMessage({ message: $t('message_newAggregateBondedTransaction'), type: 'info' });
                },)
                newListener.listenTransactionError((error) => {
                    handleError(new Error(`error_${error.code}`))
                });
                commit({ type: 'listener/setListener', payload: newListener });
            } catch { }
        },
    },
};

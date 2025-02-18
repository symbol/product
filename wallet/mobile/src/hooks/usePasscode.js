import { DeviceEventEmitter } from 'react-native';
import { Router } from '@/app/Router';

export const usePasscode = (type, onSuccess, onCancel) => {
    const successState = '.s';
    const cancelState = '.c';

    return () => {
        const uniqueNumber = Math.floor(Date.now() / 1000);
        const eventId = `event.passcode.${uniqueNumber}`;
        if (onSuccess) {
            DeviceEventEmitter.addListener(eventId + successState, onSuccess);
        }
        if (onCancel) {
            DeviceEventEmitter.addListener(eventId + cancelState, onCancel);
        }

        Router.goToPasscode({
            type,
            successEvent: eventId + successState,
            cancelEvent: eventId + cancelState,
        });
    };
};

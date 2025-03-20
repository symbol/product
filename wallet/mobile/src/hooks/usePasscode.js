import { DeviceEventEmitter } from 'react-native';
import { Router } from '@/app/Router';

/**
 * A custom hook that returns a function to trigger the passcode screen.
 * It sets up event listeners for success and cancel events and navigates to the passcode screen.
 *
 * @param {"choose" | "enter"} type - The type of passcode action (e.g., "choose" or "enter").
 * @param {() => void} [onSuccess] - Optional callback triggered when the passcode action succeeds.
 * @param {() => void} [onCancel] - Optional callback triggered when the passcode action is canceled.
 * @returns {() => void} - A function that, when called, navigates to the passcode screen and sets up event listeners.
 */
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

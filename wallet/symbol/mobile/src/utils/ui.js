import { getErrorMessageLocaleKey } from './localization';
import { PlatformUtils } from '@/app/lib/platform/PlatformUtils';
import { $t } from '@/app/localization';
import { showMessage as rnFlashMessage } from 'react-native-flash-message';

const SAFETY_DELAY_ANDROID = 50;
const SAFETY_DELAY_IOS = 500;

/**
 * Shows a flash message.
 * @param {object} options - The message options.
 * @param {string} options.message - The message.
 * @param {string} options.type - The message type.
 * @returns {void}
 */
export const showMessage = ({ message, type }) => rnFlashMessage({ message, type });

/**
 * Shows an error as a flash message, resolving its code through the error message map.
 * @param {Error} error - The error to show.
 * @returns {void}
 */
export const showError = error => {
	const code = error.code || error.message;
	showMessage({ message: $t(getErrorMessageLocaleKey(code)), type: 'danger' });

	if (__DEV__) {
		// eslint-disable-next-line no-console
		console.error(error);
	}
};

/**
 * Creates a safe interaction callback that defers execution until the JS thread is idle.
 * On Android, it adds a small delay to ensure smooth UI transitions.
 * @param {function(): void} callback - The callback function to execute.
 * @returns {function(): void} A function that, when called, will execute the callback safely.
 */
export const createSafeInteraction = callback => () => {
	if (PlatformUtils.getOS() === 'android') {
		requestIdleCallback(() => {
			setTimeout(callback, SAFETY_DELAY_ANDROID);
		});
	} else {
		setTimeout(callback, SAFETY_DELAY_IOS);
	}
};

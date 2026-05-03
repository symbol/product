import { PlatformUtils } from '@/app/lib/platform/PlatformUtils';
import { $t } from '@/app/localization';
import { InteractionManager } from 'react-native';
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

export const showError = error => {
	const translationKey = error.code || error.message;
	const message = $t(translationKey, { defaultValue: translationKey });
	showMessage({ message, type: 'danger' });

	if (__DEV__) {
		// eslint-disable-next-line no-console
		console.error(error);
	}
};

/**
 * Creates a safe interaction callback that defers execution until after interactions are complete.
 * On Android, it adds a small delay to ensure smooth UI transitions.
 * @param {function(): void} callback - The callback function to execute.
 * @returns {function(): void} A function that, when called, will execute the callback safely.
 */
export const createSafeInteraction = callback => () => {
	if (PlatformUtils.getOS() === 'android') {
		InteractionManager.runAfterInteractions(() => {
			setTimeout(callback, SAFETY_DELAY_ANDROID);
		});
	} else {
		setTimeout(callback, SAFETY_DELAY_IOS);
	}
};

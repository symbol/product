import { $t } from '@/app/localization';
import { showMessage as rnFlashMessage } from 'react-native-flash-message';

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

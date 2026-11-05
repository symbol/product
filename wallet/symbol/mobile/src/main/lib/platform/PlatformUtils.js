// import Clipboard from '@react-native-community/clipboard';
// Remove after fix https://github.com/react-native-clipboard/clipboard/issues/71
import { Clipboard, Keyboard, Linking, Platform, Vibration } from 'react-native';
export class PlatformUtils {
	/**
	 * Copies the given string to the clipboard.
	 * @param {string} str - The string to be copied to the clipboard.
	 */
	static copyToClipboard(str) {
		Clipboard.setString(str);
	}

	/**
	 * Retrieves the operating system of the platform.
	 * @returns {'android' | 'ios'} The operating system id.
	 */
	static getOS() {
		return Platform.OS;
	}

	/**
	 * Triggers a vibration on the device.
	 * Only works on Android.
	 */
	static vibrate() {
		if (PlatformUtils.getOS() === 'android') 
			Vibration.vibrate(2);
	}

	/**
	 * Dismisses the on-screen software keyboard and blurs the focused input.
	 */
	static dismissKeyboard() {
		Keyboard.dismiss();
	}

	/**
	 * Opens the given URL in the device's web browser.
	 * @param {string} url - The URL to be opened.
	 * @returns {Promise<void>} A promise that resolves when the URL has been opened.
	 */
	static async openLink(url) {
		return Linking.openURL(url);
	}
}

/** @typedef {import('@/app/types/Wallet').MainWalletController} MainWalletController */
/** @typedef {import('wallet-common-core').Contact} Contact */

/**
 * Props passed to the AddressBookWidget component.
 * @typedef {object} AddressBookWidgetProps
 * @property {Contact[]} contacts - List of whitelisted contacts.
 */

/**
 * Return type of the useAddressBookWidget hook.
 * @typedef {object} UseAddressBookWidgetReturnType
 * @property {boolean} isVisible - Whether the widget should be shown (true when contacts exist).
 * @property {AddressBookWidgetProps} props - Props to pass to the AddressBookWidget component.
 */

/**
 * React hook for managing the address book widget state and data for the home screen.
 * Provides visibility control and widget props derived from the wallet controller.
 * @param {MainWalletController} walletController - The wallet controller instance.
 * @returns {UseAddressBookWidgetReturnType}
 */
export const useAddressBookWidget = walletController => {
	const { addressBook } = walletController.modules;
	const contacts = addressBook.whiteList;

	return {
		isVisible: true,
		props: {
			contacts
		}
	};
};

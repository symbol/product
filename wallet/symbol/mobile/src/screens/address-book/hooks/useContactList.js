import { ContactListType } from '@/app/screens/address-book/types/AddressBook';
import { useState } from 'react';

/** @typedef {import('wallet-common-core').AddressBookModule} AddressBookModule */
/** @typedef {import('wallet-common-core').Contact} Contact */

/**
 * Return type for useContactList hook.
 * @typedef {Object} UseContactListReturnType
 * @property {Contact[]} contacts - The list of contacts based on selected list type.
 * @property {string} listType - The current list type (whitelist or blacklist).
 * @property {(type: string) => void} changeListType - Changes the current list type.
 */

/**
 * React hook for managing contact list state and filtering.
 * Provides filtered contacts based on selected list type (whitelist or blacklist).
 *
 * @param {AddressBookModule} addressBook - The address book module instance.
 * @param {string} [defaultListType] - The initial list type to display.
 * @returns {UseContactListReturnType}
 */
export const useContactList = (addressBook, defaultListType = ContactListType.WHITELIST) => {
	const [listType, setListType] = useState(defaultListType);

	const contacts = listType === ContactListType.WHITELIST
		? addressBook.whiteList
		: addressBook.blackList;

	return {
		contacts,
		listType,
		changeListType: setListType
	};
};

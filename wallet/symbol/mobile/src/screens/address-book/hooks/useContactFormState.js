import { ContactListType } from '@/app/screens/address-book/types/AddressBook';
import { useCallback, useState } from 'react';

/** @typedef {import('wallet-common-core').Contact} Contact */

/**
 * Return type for useContactFormState hook.
 * @typedef {object} UseContactFormStateReturnType
 * @property {string} name - The contact name.
 * @property {string} address - The contact address.
 * @property {string} notes - The contact notes.
 * @property {string} listType - The list type (whitelist or blacklist).
 * @property {(value: string) => void} changeName - Updates the name value.
 * @property {(value: string) => void} changeAddress - Updates the address value.
 * @property {(value: string) => void} changeNotes - Updates the notes value.
 * @property {(value: string) => void} changeListType - Updates the list type.
 * @property {() => Contact} getContact - Returns the contact object from current state.
 * @property {() => void} reset - Resets all state to initial values.
 */

/**
 * React hook for managing contact form state.
 * Handles name, address, notes fields and list type selection.
 * @param {object} [initialValues] - Initial form values.
 * @param {string} [initialValues.name] - Initial name value.
 * @param {string} [initialValues.address] - Initial address value.
 * @param {string} [initialValues.notes] - Initial notes value.
 * @param {string} [initialValues.listType] - Initial list type (whitelist or blacklist).
 * @returns {UseContactFormStateReturnType}
 */
export const useContactFormState = initialValues => {
	const defaultName = initialValues?.name ?? '';
	const defaultAddress = initialValues?.address ?? '';
	const defaultNotes = initialValues?.notes ?? '';
	const defaultListType = initialValues?.listType ?? ContactListType.WHITELIST;

	const [name, setName] = useState(defaultName);
	const [address, setAddress] = useState(defaultAddress);
	const [notes, setNotes] = useState(defaultNotes);
	const [listType, setListType] = useState(defaultListType);

	const getContact = useCallback(() => ({
		address: address.trim(),
		name: name.trim(),
		notes,
		isBlackListed: listType === ContactListType.BLACKLIST
	}), [address, name, notes, listType]);

	const reset = useCallback(() => {
		setName(defaultName);
		setAddress(defaultAddress);
		setNotes(defaultNotes);
		setListType(defaultListType);
	}, [defaultName, defaultAddress, defaultNotes, defaultListType]);

	return {
		name,
		address,
		notes,
		listType,
		changeName: setName,
		changeAddress: setAddress,
		changeNotes: setNotes,
		changeListType: setListType,
		getContact,
		reset
	};
};

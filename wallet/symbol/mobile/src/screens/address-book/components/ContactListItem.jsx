import { AccountListItem } from '@/app/components';
import { useAccountDisplayData } from '@/app/hooks';
import React from 'react';

/** @typedef {import('wallet-common-core').Contact} Contact */

/**
 * ContactListItem component. Displays a contact card with avatar,
 * name, and address information.
 * @param {object} props - Component props.
 * @param {Contact} props.contact - The contact object.
 * @param {() => void} [props.onPress] - Callback when the item is pressed.
 * @returns {React.ReactNode} ContactListItem component.
 */
export const ContactListItem = ({ contact, onPress }) => {
	const contactDisplayData = useAccountDisplayData(contact.address);

	return (
		<AccountListItem
			address={contact.address}
			name={contact.name}
			imageId={contactDisplayData.imageId}
			onPress={onPress}
		/>
	);
};

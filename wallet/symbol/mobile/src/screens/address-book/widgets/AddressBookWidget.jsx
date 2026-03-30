import { Spacer, Stack, WidgetContainer } from '@/app/components';
import { $t } from '@/app/localization';
import { Router } from '@/app/router/Router';
import { ContactCompactItem } from '@/app/screens/address-book/components';
import React from 'react';
import { ScrollView } from 'react-native';

const ICON_ADD_CONTACT = 'account-add';

/** @typedef {import('wallet-common-core').Contact} Contact */

/**
 * AddressBookWidget component. A card widget displaying a scrollable list of whitelisted contacts
 * with navigation to the full contact list or individual contact details.
 *
 * @param {Object} props - Component props.
 * @param {Contact[]} props.contacts - List of whitelisted contacts to display.
 * @returns {React.ReactNode} AddressBookWidget component
 */
export const AddressBookWidget = ({ contacts }) => {
	const handleHeaderPress = () => Router.goToContactList();
	const handleItemPress = contact => Router.goToContactDetails({
		params: {
			contactId: contact.id
		}
	});
	const handleAddContactPress = () => Router.goToCreateContact();

	return (
		<WidgetContainer title={$t('s_addressBook_widget_name')} onHeaderPress={handleHeaderPress}>
			<ScrollView horizontal showsHorizontalScrollIndicator={false}>
				<Spacer>
					<Stack gap="s" direction="row">
						<ContactCompactItem
							icon={ICON_ADD_CONTACT}
							caption={$t('button_addContact')}
							onPress={handleAddContactPress}
						/>
						{contacts.map(contact => (
							<ContactCompactItem
								key={contact.id}
								address={contact.address}
								caption={contact.name}
								onPress={() => handleItemPress(contact)}
							/>
						))}
					</Stack>
				</Spacer>
			</ScrollView>
		</WidgetContainer>
	);
};

import { ContactListItem } from './components';
import { useContactList } from './hooks';
import { ButtonCircle, EmptyListMessage, Screen, Spacer, Stack, StyledText, TabSelector } from '@/app/components';
import { useWalletController } from '@/app/hooks';
import { $t } from '@/app/localization';
import { Router } from '@/app/router/Router';
import { createContactListTypeTabs } from '@/app/screens/address-book/utils';
import React from 'react';

/**
 * ContactList screen component. Displays a list of contacts from the address book
 * with tabs to switch between whitelist and blacklist views.
 *
 * @returns {React.ReactNode} ContactList component
 */
export const ContactList = () => {
	const walletController = useWalletController();
	const { addressBook } = walletController.modules;
	
	// Contact list state
	const listTypeTabs = createContactListTypeTabs();
	const { contacts, listType, changeListType } = useContactList(addressBook);

	// Navigation handlers
	const openCreateContact = () => {
		Router.goToCreateContact({
			params: {
				listType
			}
		});
	};
	const openContactDetails = contact => {
		Router.goToContactDetails({
			params: {
				contactId: contact.id
			}
		});
	};

	return (
		<Screen>
			<Screen.Upper>
				<Spacer>
					<Stack gap="l">
						<Stack gap="none">
							<StyledText type="title">
								{$t('s_addressBook_title')}
							</StyledText>
							<StyledText type="body">
								{$t('s_addressBook_description')}
							</StyledText>
						</Stack>
						<TabSelector
							list={listTypeTabs}
							value={listType}
							onChange={changeListType}
						/>
						<Stack gap="s">
							{contacts.map(contact => (
								<ContactListItem
									key={contact.id}
									contact={contact}
									onPress={() => openContactDetails(contact)}
								/>
							))}
							{contacts.length === 0 && (
								<EmptyListMessage />
							)}
						</Stack>
					</Stack>
				</Spacer>
			</Screen.Upper>
			<Screen.Bottom>
				<ButtonCircle
					icon="plus"
					isFloating
					onPress={openCreateContact}
				/>
			</Screen.Bottom>
		</Screen>
	);
};

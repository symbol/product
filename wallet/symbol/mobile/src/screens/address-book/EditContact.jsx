import { useContactFormState } from './hooks';
import { ContactListType } from './types/AddressBook';
import { createContactListTypeAlertData, createContactListTypeTabs, validateUniqueContactName } from './utils';
import { Alert, Button, Screen, Spacer, StableHeightContainer, Stack, StyledText, TabSelector, TextBox } from '@/app/components';
import { useAsyncManager, useValidation, useWalletController } from '@/app/hooks';
import { $t } from '@/app/localization';
import { Router } from '@/app/router/Router';
import { validateAccountName, validateRequired } from '@/app/utils';
import React, { useMemo } from 'react';


/**
 * EditContact screen component. Provides the interface for editing an existing contact
 * with name, notes, and list type (whitelist or blacklist) selection.
 * Address field is read-only as it serves as the contact identifier.
 *
 * @param {Object} props - Component props.
 * @param {Object} props.route - React Navigation route object.
 * @param {Object} props.route.params - Route parameters.
 * @param {string} props.route.params.contactId - The contact ID to edit.
 * @returns {React.ReactNode} EditContact component
 */
export const EditContact = ({ route }) => {
	const defaultBlacklistContactName = $t('s_addressBook_account_blacklist_defaultName');

	const { contactId } = route.params;
	const walletController = useWalletController();
	const { accounts, networkIdentifier } = walletController;
	const networkAccounts = accounts[networkIdentifier];
	const { addressBook } = walletController.modules;
	const existingContact = addressBook.getContactById(contactId);

	// List type tabs
	const listTypeTabs = createContactListTypeTabs();

	// Form state
	const initialValues = useMemo(() => {
		return {
			name: existingContact.name,
			address: existingContact.address,
			notes: existingContact.notes,
			listType: existingContact.isBlackListed ? ContactListType.BLACKLIST : ContactListType.WHITELIST
		};
	}, [existingContact]);
	const {
		name,
		address,
		notes,
		listType,
		changeName,
		changeNotes,
		changeListType,
		getContact
	} = useContactFormState(initialValues);

	// Validation
	const isNameRequired = listType === ContactListType.WHITELIST;
	const nameErrorMessage = useValidation(name, [
		validateRequired(isNameRequired),
		validateUniqueContactName(networkAccounts, addressBook),
		validateAccountName()
	], $t);

	// Alert
	const listTypeAlert = createContactListTypeAlertData(listType);

	// Save contact
	const saveManager = useAsyncManager({
		callback: async () => {
			const contact = getContact();

			if (contact.isBlackListed && !contact.name)
				contact.name = defaultBlacklistContactName;

			return addressBook.updateContact({ ...contact, id: contactId });
		},
		onSuccess: () => Router.goBack()
	});

	const isFormValid = !nameErrorMessage;
	const isButtonDisabled = !isFormValid || saveManager.isLoading;

	return (
		<Screen>
			<Screen.Upper>
				<Spacer>
					<Stack gap="l">
						<Stack gap="none">
							<StyledText type="title">
								{$t('s_addressBook_edit_title')}
							</StyledText>
							<StyledText type="body">
								{$t('s_addressBook_edit_description')}
							</StyledText>
						</Stack>
						<TabSelector
							list={listTypeTabs}
							value={listType}
							onChange={changeListType}
						/>
						<StableHeightContainer>
							{listTypeAlert.isVisible && (
								<Alert
									variant={listTypeAlert.variant}
									body={listTypeAlert.text}
								/>
							)}
						</StableHeightContainer>
						<Stack gap="m">
							<TextBox
								label={$t('input_name')}
								value={name}
								errorMessage={nameErrorMessage}
								onChange={changeName}
							/>
							<TextBox
								label={$t('input_address')}
								value={address}
								isDisabled
							/>
							<TextBox
								label={$t('input_notes')}
								value={notes}
								multiline
								onChange={changeNotes}
							/>
						</Stack>
					</Stack>
				</Spacer>
			</Screen.Upper>
			<Screen.Bottom>
				<Spacer>
					<Button
						text={$t('button_save')}
						isDisabled={isButtonDisabled}
						onPress={saveManager.call}
					/>
				</Spacer>
			</Screen.Bottom>
		</Screen>
	);
};

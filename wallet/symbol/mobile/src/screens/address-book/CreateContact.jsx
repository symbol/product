import { useContactFormState } from './hooks';
import { ContactListType } from './types/AddressBook';
import { 
	createContactListTypeAlertData, 
	createContactListTypeTabs, 
	validateUniqueContactAddress, 
	validateUniqueContactName 
} from './utils';
import { Alert, Button, Screen, Spacer, StableHeightContainer, Stack, StyledText, TabSelector, TextBox } from '@/app/components';
import { useAsyncManager, useValidation, useWalletController } from '@/app/hooks';
import { $t } from '@/app/localization';
import { Router } from '@/app/router/Router';
import { validateAccountName, validateAddress, validateRequired } from '@/app/utils';
import React from 'react';


/**
 * CreateContact screen component. Provides the interface for creating a new contact
 * with name, address, notes, and list type (whitelist or blacklist) selection.
 *
 * @param {Object} props - Component props.
 * @param {Object} props.route - React Navigation route object.
 * @param {Object} props.route.params - Route parameters.
 * @param {string} [props.route.params.listType] - Initial list type (whitelist or blacklist).
 * @returns {React.ReactNode} CreateContact component
 */
export const CreateContact = ({ route }) => {
	const defaultBlacklistContactName = $t('s_addressBook_account_blacklist_defaultName');

	const { 
		listType: initialListType, 
		name: initialName,
		address: initialAddress 
	} = route.params || {};
	const walletController = useWalletController();
	const { chainName, accounts, networkIdentifier } = walletController;
	const networkAccounts = accounts[networkIdentifier];
	const { addressBook } = walletController.modules;
	
	// List type tabs
	const listTypeTabs = createContactListTypeTabs();

	// Form state
	const {
		name,
		address,
		notes,
		listType,
		changeName,
		changeAddress,
		changeNotes,
		changeListType,
		getContact
	} = useContactFormState({ listType: initialListType, address: initialAddress, name: initialName });

	// Validation
	const isNameRequired = listType === ContactListType.WHITELIST;
	const nameErrorMessage = useValidation(name, [
		validateRequired(isNameRequired), 
		validateUniqueContactName(networkAccounts, addressBook), 
		validateAccountName()
	], $t);
	const addressErrorMessage = useValidation(address, [
		validateRequired(),
		validateUniqueContactAddress(networkAccounts, addressBook),
		validateAddress(chainName)
	], $t);

	// Alert
	const listTypeAlert = createContactListTypeAlertData(listType);

	// Save contact
	const saveManager = useAsyncManager({
		callback: async () => {
			const contact = getContact();

			if (contact.isBlackListed && !contact.name)
				contact.name = defaultBlacklistContactName;
            
			return addressBook.addContact(contact);
		},
		onSuccess: () => Router.goBack()
	});

	const isFormValid = !nameErrorMessage && !addressErrorMessage;
	const isButtonDisabled = !isFormValid || saveManager.isLoading;

	return (
		<Screen>
			<Screen.Upper>
				<Spacer>
					<Stack gap="l">
						<Stack gap="none">
							<StyledText type="title">
								{$t('s_addressBook_create_title')}
							</StyledText>
							<StyledText type="body">
								{$t('s_addressBook_create_description')}
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
								errorMessage={addressErrorMessage}
								onChange={changeAddress}
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

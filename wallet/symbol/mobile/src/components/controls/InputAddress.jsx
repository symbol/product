import { AccountRow, DropdownModal, Icon, TextBox } from '@/app/components';
import { useAccountDisplayData, useToggle, useValidation, useWalletController } from '@/app/hooks';
import { $t } from '@/app/localization';
import { validateRequired } from '@/app/utils';
import React, { useEffect, useMemo } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

/** @typedef {import('@/app/types/Network').ChainName} ChainName */

/**
 * InputAddressDropdown component. A dropdown modal component that displays a list of contacts and
 * wallet accounts for address selection, with account information resolution.
 * @param {object} props - Component props.
 * @param {string} props.title - Dropdown modal title.
 * @param {string} props.value - Currently selected address value.
 * @param {boolean} props.isOpen - Whether the dropdown modal is visible.
 * @param {ChainName} [props.chainName] - The chain the accounts belong to. Defaults to the main chain.
 * @param {function(string): void} props.onChange - Callback when an address is selected.
 * @param {function(): void} props.onClose - Callback when the dropdown is closed.
 * @returns {React.ReactNode} InputAddressDropdown component.
 */
export const InputAddressDropdown = props => {
	const { title, value, isOpen, chainName, onChange, onClose } = props;
	const walletController = useWalletController(chainName);
	const { networkIdentifier, accounts } = walletController;
	const { addressBook } = walletController.modules;
	const walletAccounts = accounts[networkIdentifier];
	// The address book is absent on some chains; its contacts array is what changes on edits
	const contacts = addressBook?.contacts;

	const contactList = useMemo(() => {
		const selectableContacts = [];

		if (walletAccounts?.length)
			selectableContacts.push(...walletAccounts);
		if (addressBook?.whiteList?.length)
			selectableContacts.push(...addressBook.whiteList);

		return selectableContacts.map(contact => ({
			...contact,
			value: contact.address
		}));
	}, [walletAccounts, contacts]);

	const contactsDisplayData = useAccountDisplayData(contactList.map(contact => contact.address), chainName);
	const accountsDisplayMap = new Map(contactsDisplayData.map(accountDisplayData => [accountDisplayData.address, accountDisplayData]));

	const renderItem = ({ item }) => {
		const accountDisplayData = accountsDisplayMap.get(item.address);

		return (
			<AccountRow
				address={item.address}
				name={accountDisplayData.name}
				imageId={accountDisplayData.imageId}
			/>
		);
	};

	return (
		<DropdownModal
			title={title}
			value={value}
			list={contactList}
			isOpen={isOpen}
			onChange={onChange}
			onClose={onClose}
			renderItem={renderItem}
		/>
	);
};

/**
 * InputAddress component. An input field for entering blockchain addresses, featuring validation
 * and an optional dropdown for selecting from saved contacts and wallet accounts.
 * @param {object} props - Component props.
 * @param {string} props.label - Label for the input field.
 * @param {string} props.value - Current address input value.
 * @param {ChainName} [props.chainName] - The chain the accounts belong to. Defaults to the main chain.
 * @param {function(string): void} props.onChange - Callback when input value changes.
 * @param {function(boolean): void} props.onValidityChange - Callback when validity state changes.
 * @param {Array} [props.extraValidators=[]] - Additional validators to apply.
 * @returns {React.ReactNode} InputAddress component.
 */
export const InputAddress = props => {
	const { label, value, chainName, onChange, onValidityChange, extraValidators = [] } = props;
	const walletController = useWalletController(chainName);
	const { networkIdentifier, accounts } = walletController;
	const { addressBook } = walletController.modules;
	const walletAccounts = accounts[networkIdentifier];
	const [isDropdownOpen, toggleDropdown] = useToggle(false);

	// Validation
	const errorMessage = useValidation(value, [validateRequired(), ...extraValidators], $t);

	useEffect(() => {
		onValidityChange?.(!errorMessage);
	}, [value, errorMessage]);

	// Contacts
	const hasContacts = (addressBook?.whiteList?.length || 0) + (walletAccounts?.length || 0) > 0;

	return (
		<View style={styles.root}>
			<TextBox
				label={label}
				errorMessage={errorMessage}
				value={value}
				onChange={onChange}
				contentRight={
					hasContacts && (
						<TouchableOpacity onPress={toggleDropdown} accessibilityLabel="address-book">
							<Icon name="address-book" size="m" />
						</TouchableOpacity>
					)
				}
			/>
			<InputAddressDropdown
				title={label}
				value={value}
				isOpen={isDropdownOpen}
				chainName={chainName}
				onChange={onChange}
				onClose={toggleDropdown}
			/>
		</View>
	);
};

const styles = StyleSheet.create({
	root: {
		position: 'relative'
	}
});

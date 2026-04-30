import { AccountView, DropdownModal, Icon, TextBox } from '@/app/components';
import { useToggle, useValidation } from '@/app/hooks';
import { $t } from '@/app/localization';
import { getAccountKnownInfo, validateRequired } from '@/app/utils';
import React, { useEffect, useMemo } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

/** @typedef {import('@/app/types/Network').NetworkIdentifier} NetworkIdentifier */
/** @typedef {import('@/app/types/Network').ChainName} ChainName */

/**
 * InputAddressDropdown component. A dropdown modal component that displays a list of contacts and wallet accounts for address
 * selection, with account information resolution.
 * @param {object} props - Component props.
 * @param {string} props.title - Dropdown modal title.
 * @param {string} props.value - Currently selected address value.
 * @param {boolean} props.isOpen - Whether the dropdown modal is visible.
 * @param {object} [props.addressBook] - Address book instance.
 * @param {Array} [props.accounts] - List of wallet accounts.
 * @param {ChainName} [props.chainName] - Blockchain name for account resolution.
 * @param {NetworkIdentifier} [props.networkIdentifier] - Network identifier for account resolution.
 * @param {function(string): void} props.onChange - Callback when an address is selected.
 * @param {function(): void} props.onClose - Callback when the dropdown is closed.
 * @returns {React.ReactNode} InputAddressDropdown component.
 */
export const InputAddressDropdown = props => {
	const { title, value, isOpen, addressBook, accounts, chainName, networkIdentifier, onChange, onClose } = props;

	const contactList = useMemo(() => {
		const contacts = [];

		if (accounts?.length)
			contacts.push(...accounts);
		if (addressBook?.whiteList?.length)
			contacts.push(...addressBook.whiteList);

		return contacts.map(contact => ({
			...contact,
			value: contact.address
		}));
	}, [addressBook, accounts]);

	const renderItem = ({ item }) => {
		const resolvedInfo = getAccountKnownInfo(item.address, {
			walletAccounts: accounts,
			addressBook,
			chainName,
			networkIdentifier
		});

		return (
			<AccountView
				address={item.address}
				name={resolvedInfo.name}
				imageId={resolvedInfo.imageId}
				isCopyButtonVisible={false}
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
 * @param {object} [props.addressBook] - Address book instance.
 * @param {Array} [props.accounts] - List of wallet accounts.
 * @param {ChainName} [props.chainName] - Blockchain name for account resolution.
 * @param {NetworkIdentifier} [props.networkIdentifier] - Network identifier for account resolution.
 * @param {function(string): void} props.onChange - Callback when input value changes.
 * @param {function(boolean): void} props.onValidityChange - Callback when validity state changes.
 * @param {Array} [props.extraValidators=[]] - Additional validators to apply.
 * @returns {React.ReactNode} InputAddress component.
 */
export const InputAddress = props => {
	const { label, value, addressBook, accounts, chainName, networkIdentifier, onChange, onValidityChange, extraValidators = [] } = props;
	const [isDropdownOpen, toggleDropdown] = useToggle(false);

	// Validation
	const errorMessage = useValidation(value, [validateRequired(), ...extraValidators], $t);

	useEffect(() => {
		onValidityChange?.(!errorMessage);
	}, [value, errorMessage]);

	// Contacts
	const hasContacts = (addressBook?.whiteList?.length || 0) + (accounts?.length || 0) > 0;

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
				addressBook={addressBook}
				accounts={accounts}
				chainName={chainName}
				networkIdentifier={networkIdentifier}
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

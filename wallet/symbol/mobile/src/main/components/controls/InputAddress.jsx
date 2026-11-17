import { AccountRow, DropdownModal, Icon, TextBox } from '@/app/components';
import { useAccountDisplayData, useToggle, useValidation, useWalletController } from '@/app/hooks';
import { $t } from '@/app/localization';
import { validateRequired } from '@/app/utils';
import React, { useEffect, useMemo } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

/** @typedef {import('@/app/types/Account').AccountDisplayData} AccountDisplayData */
/** @typedef {import('@/app/types/Network').ChainName} ChainName */

/**
 * An account offered in an account picker. Extra fields are passed through to the picker row renderer.
 * @typedef {object} AccountOption
 * @property {string} address - The account address.
 */

/**
 * Arguments of the custom picker row renderer.
 * @typedef {object} InputAddressRenderItemArguments
 * @property {AccountOption} item - The rendered option.
 * @property {number} index - The option index.
 * @property {AccountDisplayData} accountDisplayData - The resolved display data of the option account.
 */

const PickerIcon = {
	CONTACTS: 'address-book',
	OPTIONS: 'chevron-down'
};

/**
 * InputAddressDropdown component. A dropdown modal listing the accounts an address can be picked from:
 * the given options, or, when no options are given, the wallet accounts and address book contacts.
 * Account names and images are resolved from the wallet state.
 * @param {object} props - Component props.
 * @param {string} props.title - Dropdown modal title.
 * @param {string} props.value - Currently selected address value.
 * @param {boolean} props.isOpen - Whether the dropdown modal is visible.
 * @param {AccountOption[]} [props.options] - Accounts to list instead of the contacts.
 * @param {ChainName} [props.chainName] - The chain the accounts belong to. Defaults to the main chain.
 * @param {function(InputAddressRenderItemArguments): React.ReactNode} [props.renderItem] - Custom row renderer.
 * @param {function(string): void} props.onChange - Callback when an address is selected.
 * @param {function(): void} props.onClose - Callback when the dropdown is closed.
 * @returns {React.ReactNode} InputAddressDropdown component.
 */
export const InputAddressDropdown = props => {
	const { title, value, isOpen, options, chainName, renderItem: renderCustomItem, onChange, onClose } = props;
	const walletController = useWalletController(chainName);
	const { networkIdentifier, accounts } = walletController;
	const { addressBook } = walletController.modules;
	const walletAccounts = accounts[networkIdentifier];
	// The address book is absent on some chains; its contacts array is what changes on edits
	const contacts = addressBook?.contacts;

	// Contacts, listed when no options are given
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

	// List items and their display data
	const optionList = useMemo(
		() => options?.map(option => ({ ...option, value: option.address })),
		[options]
	);
	const list = optionList ?? contactList;
	const accountsDisplayData = useAccountDisplayData(list.map(item => item.address), chainName);

	const renderItem = ({ item, index }) => {
		const accountDisplayData = accountsDisplayData[index];

		if (renderCustomItem)
			return renderCustomItem({ item, index, accountDisplayData });

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
			list={list}
			isOpen={isOpen}
			onChange={onChange}
			onClose={onClose}
			renderItem={renderItem}
		/>
	);
};

/**
 * InputAddress component. An input field for entering blockchain addresses, featuring validation
 * and a picker. Without options, the picker offers the saved contacts and wallet accounts behind an
 * address book icon; with options, it offers the given accounts behind a chevron.
 * @param {object} props - Component props.
 * @param {string} props.label - Label for the input field.
 * @param {string} props.value - Current address input value.
 * @param {AccountOption[]} [props.options] - Accounts to offer in the picker instead of the contacts.
 * @param {ChainName} [props.chainName] - The chain the accounts belong to. Defaults to the main chain.
 * @param {boolean} [props.isDisabled=false] - Whether the input is disabled. While disabled, typing and the
 *		picker are unavailable, no validation error is shown, and the validity callback reports false.
 * @param {function(InputAddressRenderItemArguments): React.ReactNode} [props.renderItem] - Custom picker row renderer.
 * @param {function(string): void} props.onChange - Callback when input value changes.
 * @param {function(boolean): void} props.onValidityChange - Callback when validity state changes.
 * @param {Array} [props.extraValidators=[]] - Additional validators to apply.
 * @returns {React.ReactNode} InputAddress component.
 */
export const InputAddress = props => {
	const { label, value, options, chainName, isDisabled = false, renderItem, onChange, onValidityChange, extraValidators = [] } = props;
	const walletController = useWalletController(chainName);
	const { networkIdentifier, accounts } = walletController;
	const { addressBook } = walletController.modules;
	const walletAccounts = accounts[networkIdentifier];
	const [isDropdownOpen, toggleDropdown] = useToggle(false);

	// Validation, skipped while disabled so no error is shown
	const errorMessage = useValidation(value, isDisabled ? [] : [validateRequired(), ...extraValidators], $t);

	useEffect(() => {
		onValidityChange?.(isDisabled ? false : !errorMessage);
	}, [value, errorMessage, isDisabled]);

	// Picker: the given options behind a chevron, or the contacts behind the address book icon
	const isOptionsMode = options !== undefined;
	const hasContacts = (addressBook?.whiteList?.length || 0) + (walletAccounts?.length || 0) > 0;
	const isPickerAvailable = !isDisabled && (isOptionsMode ? options.length > 0 : hasContacts);
	const pickerIcon = isOptionsMode ? PickerIcon.OPTIONS : PickerIcon.CONTACTS;

	return (
		<View style={styles.root}>
			<TextBox
				label={label}
				errorMessage={errorMessage}
				isDisabled={isDisabled}
				value={value}
				onChange={onChange}
				contentRight={
					isPickerAvailable && (
						<TouchableOpacity onPress={toggleDropdown} accessibilityLabel={pickerIcon}>
							<Icon name={pickerIcon} size="m" />
						</TouchableOpacity>
					)
				}
			/>
			<InputAddressDropdown
				title={label}
				value={value}
				isOpen={isDropdownOpen}
				options={options}
				chainName={chainName}
				renderItem={renderItem}
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

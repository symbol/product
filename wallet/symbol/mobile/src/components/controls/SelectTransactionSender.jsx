import { AccountItem, AccountListItem, DropdownModal, Icon, StyledText, TabSelector } from '@/app/components';
import { $t } from '@/app/localization';
import { Sizes } from '@/app/styles';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

/** @typedef {import('@/app/types/Account').WalletAccount} WalletAccount */
/** @typedef {import('@/app/types/Account').SymbolAccountInfo} SymbolAccountInfo */
/** @typedef {import('@/app/types/Network').NetworkIdentifier} NetworkIdentifier */
/** @typedef {import('@/app/types/Network').ChainName} ChainName */

/**
 * The sender account being selected.
 * @typedef {object} SenderAccount
 * @property {string} address - The account address.
 * @property {string} balance - The account balance.
 */

/**
 * The accounts a transaction can be sent from.
 * @typedef {object} SenderOptions
 * @property {SenderAccount} current - The current account (address and balance).
 * @property {SymbolAccountInfo[]} multisigAccounts - The multisig accounts the current account can send from.
 */

const SenderTab = {
	CURRENT: 'current',
	MULTISIG: 'multisig'
};

/**
 * SelectTransactionSender component. A control for choosing the account a transaction is sent from.
 * When the current account is a cosignatory of multisig accounts, it shows a tab selector to switch
 * between the current account and a multisig account, with a dropdown to pick the multisig account.
 * When there are no multisig accounts, or when multisig is disabled, it simply renders the current account.
 * @param {object} props - Component props.
 * @param {string} [props.label] - Label displayed above the selector.
 * @param {string} props.value - The currently selected sender address.
 * @param {SenderOptions} props.options - The selectable sender accounts (current and multisig).
 * @param {string} props.ticker - The native currency ticker symbol.
 * @param {ChainName} props.chainName - The blockchain name.
 * @param {NetworkIdentifier} props.networkIdentifier - The network identifier.
 * @param {WalletAccount[]} [props.walletAccounts] - Wallet accounts for resolving account names.
 * @param {object} [props.addressBook] - Address book for resolving account names.
 * @param {boolean} [props.isMultisigDisabled] - Whether to hide the multisig accounts, rendering only the current account.
 * @param {(address: string) => void} props.onChange - Callback when the selected sender changes.
 * @returns {React.ReactNode} SelectTransactionSender component.
 */
export const SelectTransactionSender = props => {
	const {
		label,
		value,
		options,
		ticker,
		chainName,
		networkIdentifier,
		walletAccounts,
		addressBook,
		isMultisigDisabled,
		onChange
	} = props;
	const { current } = options;

	const [isDropdownOpen, setIsDropdownOpen] = useState(false);

	// Derived state
	const multisigAccounts = isMultisigDisabled ? [] : options.multisigAccounts;
	const hasMultisigAccounts = multisigAccounts.length > 0;
	const isMultisigSelected = hasMultisigAccounts && value !== current.address;
	const activeTab = isMultisigSelected ? SenderTab.MULTISIG : SenderTab.CURRENT;
	const multisigDefaultName = $t('s_multisig_defaultAccountName');
	const selectedAccount = isMultisigSelected
		? multisigAccounts.find(account => account.address === value) || current
		: current;

	// Shared display props for account items
	const accountDisplayProps = {
		ticker,
		walletAccounts,
		addressBook,
		chainName,
		networkIdentifier
	};

	// Handlers
	const openDropdown = () => setIsDropdownOpen(true);
	const closeDropdown = () => setIsDropdownOpen(false);

	const handleTabChange = tab => {
		if (tab === SenderTab.CURRENT) {
			closeDropdown();
			onChange(current.address);

			return;
		}

		openDropdown();
	};

	const handleItemPress = isMultisigSelected ? openDropdown : undefined;

	// Tab options
	const tabList = [
		{ value: SenderTab.CURRENT, label: $t('c_selectTransactionSender_currentAccount') },
		{ value: SenderTab.MULTISIG, label: $t('c_selectTransactionSender_multisigAccount') }
	];

	// Dropdown options and renderer
	const dropdownList = multisigAccounts.map(account => ({ ...account, value: account.address }));
	const renderDropdownItem = ({ item }) => (
		<AccountItem
			{...accountDisplayProps}
			address={item.address}
			balance={item.balance}
			defaultName={multisigDefaultName}
		/>
	);

	// Animated chevron shown when a multisig account is selected, hinting the item is pressable
	const itemAccessory = isMultisigSelected
		? (
			<Animated.View entering={FadeIn}>
				<Icon name="chevron-down" size="m" />
			</Animated.View>
		)
		: undefined;

	return (
		<View style={styles.root}>
			{!!label && (
				<StyledText type="label">{label}</StyledText>
			)}
			{hasMultisigAccounts && (
				<TabSelector
					list={tabList}
					value={activeTab}
					onChange={handleTabChange}
				/>
			)}
			<AccountListItem
				{...accountDisplayProps}
				address={selectedAccount.address}
				balance={selectedAccount.balance}
				defaultName={isMultisigSelected ? multisigDefaultName : undefined}
				accessory={itemAccessory}
				accessibilityLabel={label}
				onPress={handleItemPress}
			/>
			<DropdownModal
				title={$t('c_selectTransactionSender_selectTitle')}
				value={value}
				list={dropdownList}
				isOpen={isDropdownOpen}
				renderItem={renderDropdownItem}
				onChange={onChange}
				onClose={closeDropdown}
			/>
		</View>
	);
};

const styles = StyleSheet.create({
	root: {
		width: '100%',
		gap: Sizes.Semantic.spacing.s
	}
});

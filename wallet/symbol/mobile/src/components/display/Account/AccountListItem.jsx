import { AccountItem, ListItemContainer } from '@/app/components';
import { Sizes } from '@/app/styles';
import { createAccountDisplayData } from '@/app/utils';
import React from 'react';
import { StyleSheet, View } from 'react-native';

/** @typedef {import('@/app/types/Account').WalletAccount} WalletAccount */
/** @typedef {import('@/app/types/Network').NetworkIdentifier} NetworkIdentifier */
/** @typedef {import('@/app/types/Network').ChainName} ChainName */

/**
 * AccountListItem component. A pressable account card ready to render in a list. Wraps AccountItem
 * with a list item container and a tinted background derived from the account. The name can be
 * provided explicitly or resolved from wallet accounts and the address book, falling back to the
 * provided default name or the address. The balance row is omitted when no balance is provided.
 * @param {object} props - Component props.
 * @param {string} props.address - The account address.
 * @param {string} [props.name] - Explicit display name. When omitted, the name is resolved from the display context.
 * @param {string} [props.balance] - The account balance. When omitted, the balance row is not rendered.
 * @param {string} [props.ticker] - The currency ticker symbol.
 * @param {WalletAccount[]} [props.walletAccounts] - The wallet accounts for display names.
 * @param {object} [props.addressBook] - The address book for display names.
 * @param {ChainName} [props.chainName] - The blockchain name.
 * @param {NetworkIdentifier} [props.networkIdentifier] - The network identifier.
 * @param {string} [props.defaultName] - Fallback name shown when the account name cannot be resolved.
 * @param {React.ReactNode} [props.accessory] - Optional element rendered on the right side of the item.
 * @param {string} [props.accessibilityLabel] - Accessibility label for the pressable item.
 * @param {() => void} [props.onPress] - Callback when the item is pressed.
 * @returns {React.ReactNode} AccountListItem component.
 */
export const AccountListItem = ({
	address,
	name,
	balance,
	ticker,
	walletAccounts,
	addressBook,
	chainName,
	networkIdentifier,
	defaultName,
	accessory,
	accessibilityLabel,
	onPress
}) => {
	const accountDisplay = createAccountDisplayData(address, {
		walletAccounts,
		addressBook,
		chainName,
		networkIdentifier
	});
	const accountNameText = name ?? accountDisplay.name ?? defaultName ?? address;

	return (
		<ListItemContainer
			contentContainerStyle={styles.root}
			accessibilityLabel={accessibilityLabel}
			onPress={onPress}
		>
			<View style={[styles.background, { backgroundColor: accountDisplay.color }]} />
			<AccountItem
				address={address}
				name={accountNameText}
				balance={balance}
				ticker={ticker}
				accessory={accessory}
			/>
		</ListItemContainer>
	);
};

const styles = StyleSheet.create({
	root: {
		flexDirection: 'row',
		width: '100%'
	},
	background: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		opacity: 0.1,
		borderRadius: Sizes.Semantic.borderRadius.m
	}
});

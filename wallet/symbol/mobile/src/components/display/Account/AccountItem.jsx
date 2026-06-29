import { AccountAvatar, Amount, StyledText } from '@/app/components';
import { Sizes } from '@/app/styles';
import { createAccountDisplayData } from '@/app/utils';
import React from 'react';
import { StyleSheet, View } from 'react-native';

/** @typedef {import('@/app/types/Account').WalletAccount} WalletAccount */
/** @typedef {import('@/app/types/Network').NetworkIdentifier} NetworkIdentifier */
/** @typedef {import('@/app/types/Network').ChainName} ChainName */

/**
 * AccountItem component. Bare account row content (avatar, name, optional balance, address).
 * The name can be provided explicitly or resolved from wallet accounts and the address book,
 * falling back to the provided default name or the address. The balance row is omitted when
 * no balance is provided.
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
 * @param {React.ReactNode} [props.accessory] - Optional element rendered on the right side of the row.
 * @returns {React.ReactNode} AccountItem component.
 */
export const AccountItem = ({
	address,
	name,
	balance,
	ticker,
	walletAccounts,
	addressBook,
	chainName,
	networkIdentifier,
	defaultName,
	accessory
}) => {
	const accountNameText = name
		?? createAccountDisplayData(address, { walletAccounts, addressBook, chainName, networkIdentifier }).name
		?? defaultName
		?? address;
	const hasBalance = balance !== undefined && balance !== null;

	return (
		<View style={styles.root}>
			<View style={styles.iconSection}>
				<AccountAvatar address={address} size="l" />
			</View>
			<View style={styles.contentSection}>
				<StyledText type="title" size="s">
					{accountNameText}
				</StyledText>

				{hasBalance && (
					<Amount
						value={balance}
						ticker={ticker}
						size="l"
					/>
				)}

				<StyledText type="label" size="s">
					{address}
				</StyledText>
			</View>
			{!!accessory && (
				<View style={styles.accessorySection}>
					{accessory}
				</View>
			)}
		</View>
	);
};

const styles = StyleSheet.create({
	root: {
		flex: 1,
		flexDirection: 'row'
	},
	iconSection: {
		flexDirection: 'column',
		justifyContent: 'center',
		paddingRight: Sizes.Semantic.spacing.m
	},
	contentSection: {
		flex: 1,
		flexDirection: 'column',
		justifyContent: 'center'
	},
	accessorySection: {
		justifyContent: 'center',
		paddingLeft: Sizes.Semantic.spacing.m
	}
});

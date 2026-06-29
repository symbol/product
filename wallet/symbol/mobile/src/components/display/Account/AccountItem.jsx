import { AccountAvatar, Amount, StyledText } from '@/app/components';
import { Sizes } from '@/app/styles';
import { createAccountDisplayData } from '@/app/utils';
import React from 'react';
import { StyleSheet, View } from 'react-native';

/** @typedef {import('@/app/types/Account').WalletAccount} WalletAccount */
/** @typedef {import('@/app/types/Network').NetworkIdentifier} NetworkIdentifier */
/** @typedef {import('@/app/types/Network').ChainName} ChainName */

/**
 * AccountItem component. Bare account row content.
 * @param {object} props - Component props.
 * @param {string} props.address - The account address.
 * @param {string} props.balance - The account balance.
 * @param {string} props.ticker - The currency ticker symbol.
 * @param {WalletAccount[]} [props.walletAccounts] - The wallet accounts for display names.
 * @param {object} [props.addressBook] - The address book for display names.
 * @param {ChainName} props.chainName - The blockchain name.
 * @param {NetworkIdentifier} props.networkIdentifier - The network identifier.
 * @param {string} [props.defaultName] - Fallback name shown when the account name cannot be resolved.
 * @param {React.ReactNode} [props.accessory] - Optional element rendered on the right side of the row.
 * @returns {React.ReactNode} AccountItem component.
 */
export const AccountItem = ({
	address,
	balance,
	ticker,
	walletAccounts,
	addressBook,
	chainName,
	networkIdentifier,
	defaultName,
	accessory
}) => {
	const accountDisplay = createAccountDisplayData(address, {
		walletAccounts,
		addressBook,
		chainName,
		networkIdentifier
	});
	const accountNameText = accountDisplay.name ?? defaultName ?? address;

	return (
		<View style={styles.root}>
			<View style={styles.iconSection}>
				<AccountAvatar address={address} size="l" />
			</View>
			<View style={styles.contentSection}>
				<StyledText type="title" size="s">
					{accountNameText}
				</StyledText>

				<Amount
					value={balance}
					ticker={ticker}
					size="l"
				/>

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

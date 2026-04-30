import { AccountAvatar, Amount, ListItemContainer, StyledText } from '@/app/components';
import { $t } from '@/app/localization';
import { Sizes } from '@/app/styles';
import { createAccountDisplayData } from '@/app/utils';
import React from 'react';
import { StyleSheet, View } from 'react-native';

/** @typedef {import('@/app/types/Account').WalletAccount} WalletAccount */
/** @typedef {import('@/app/types/Network').NetworkIdentifier} NetworkIdentifier */
/** @typedef {import('@/app/types/Network').ChainName} ChainName */

/**
 * Returns the display name for a multisig account.
 * @param {string|null} name - The account name from address book or wallet.
 * @returns {string} The display name.
 */
const getAccountNameText = name => {
	return name ?? $t('s_multisig_defaultAccountName');
};

/**
 * MultisigAccountListItem component. Displays a multisig account card with avatar,
 * name, balance, and address information.
 * @param {object} props - Component props.
 * @param {string} props.address - The account address.
 * @param {string} props.balance - The account balance.
 * @param {string} props.ticker - The currency ticker symbol.
 * @param {WalletAccount[]} [props.walletAccounts] - The wallet accounts for display names.
 * @param {object} [props.addressBook] - The address book for display names.
 * @param {ChainName} props.chainName - The blockchain name.
 * @param {NetworkIdentifier} props.networkIdentifier - The network identifier.
 * @param {() => void} [props.onPress] - Callback when the item is pressed.
 * @returns {React.ReactNode} MultisigAccountListItem component.
 */
export const MultisigAccountListItem = ({
	address,
	balance,
	ticker,
	walletAccounts,
	addressBook,
	chainName,
	networkIdentifier,
	onPress
}) => {
	const accountDisplay = createAccountDisplayData(address, {
		walletAccounts,
		addressBook,
		chainName,
		networkIdentifier
	});
	const accountNameText = getAccountNameText(accountDisplay.name);

	return (
		<ListItemContainer
			contentContainerStyle={styles.root}
			onPress={onPress}
		>
			<View style={[styles.background, { backgroundColor: accountDisplay.color }]} />
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
	}
});

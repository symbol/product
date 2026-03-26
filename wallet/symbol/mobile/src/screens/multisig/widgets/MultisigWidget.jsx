import { Card, Spacer, Stack, StyledText, TouchableNative } from '@/app/components';
import { $t } from '@/app/localization';
import { Router } from '@/app/router/Router';
import { MultisigAccountListItem } from '@/app/screens/multisig/components';
import { Sizes } from '@/app/styles';
import React from 'react';
import { StyleSheet } from 'react-native';

/** @typedef {import('@/app/types/Account').WalletAccount} WalletAccount */
/** @typedef {import('@/app/types/Account').SymbolAccountInfo} SymbolAccountInfo */
/** @typedef {import('@/app/types/Network').NetworkIdentifier} NetworkIdentifier */

/**
 * MultisigWidget component. A card widget displaying a scrollable list of multisig accounts
 * with navigation to the full list or individual account details.
 *
 * @param {object} props - Component props.
 * @param {SymbolAccountInfo[]} props.multisigAccountList - List of multisig accounts to display.
 * @param {string} props.chainName - The blockchain name.
 * @param {NetworkIdentifier} props.networkIdentifier - The network identifier.
 * @param {string} props.ticker - The native currency ticker symbol.
 * @param {WalletAccount[]} [props.walletAccounts] - Wallet accounts for resolving account names.
 * @param {object} [props.addressBook] - Address book for resolving account names.
 *
 * @returns {React.ReactNode} MultisigWidget component
 */
export const MultisigWidget = ({
	multisigAccountList,
	chainName,
	networkIdentifier,
	ticker,
	walletAccounts,
	addressBook
}) => {
	// Handlers
	const handleHeaderPress = () => Router.goToMultisigAccountList();
	const handleItemPress = item => Router.goToMultisigAccountDetails({
		params: {
			chainName,
			accountAddress: item.address,
			preloadedData: item
		}
	});

	return (
		<Card>
			<TouchableNative style={styles.header} onPress={handleHeaderPress}>
				<StyledText type="title" size="s">
					{$t('s_multisig_widget_name')}
				</StyledText>
			</TouchableNative>
			<Spacer>
				<Stack gap="s">
					{multisigAccountList.map(item => (
						<MultisigAccountListItem
							key={item.address}
							address={item.address}
							balance={item.balance}
							ticker={ticker}
							walletAccounts={walletAccounts}
							addressBook={addressBook}
							chainName={chainName}
							networkIdentifier={networkIdentifier}
							onPress={() => handleItemPress(item)}
						/>
					))}
				</Stack>
			</Spacer>
		</Card>
	);
};

const styles = StyleSheet.create({
	header: {
		paddingHorizontal: Sizes.Semantic.layoutSpacing.m,
		paddingTop: Sizes.Semantic.layoutSpacing.m
	}
});

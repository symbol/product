import { TransactionListItem } from '../components/TransactionListItem';
import { Card, Spacer, Stack, StyledText, TouchableNative } from '@/app/components';
import { TransactionGroup } from '@/app/constants';
import { $t } from '@/app/localization';
import { Router } from '@/app/router/Router';
import { Sizes } from '@/app/styles';
import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';

/**
 * HistoryWidget widget component. Displays pending transactions.
 *
 * @param {object} props - Component props
 * @param {Array} props.partial - Array of partial (pending multisig) transactions.
 * @param {Array} props.unconfirmed - Array of unconfirmed transactions.
 * @param {object} props.currentAccount - Current user account.
 * @param {object} props.walletAccounts - Wallet accounts by network.
 * @param {object} props.addressBook - Address book instance.
 * @param {string} props.networkIdentifier - Network identifier (e.g., 'mainnet').
 * @param {string} props.chainName - Chain name (e.g., 'symbol').
 * @param {string} props.ticker - The ticker symbol for the network currency.
 *
 * @returns {React.ReactNode} HistoryWidget component
 */
export const HistoryWidget = ({
	partial,
	unconfirmed,
	currentAccount,
	walletAccounts,
	addressBook,
	networkIdentifier,
	chainName,
	ticker
}) => {
	// Combine and tag transactions with their group
	const transactions = useMemo(() => [
		...partial.map(tx => ({ ...tx, group: TransactionGroup.PARTIAL })),
		...unconfirmed.map(tx => ({ ...tx, group: TransactionGroup.UNCONFIRMED }))
	], [partial, unconfirmed]);

	// Handlers
	const handleHeaderPress = () => Router.goToHistory();
	const handleTransactionPress = transaction => Router.goToTransactionDetails({ transaction });

	return (
		<Card>
			<TouchableNative style={styles.header} onPress={handleHeaderPress}>
				<StyledText type="title" size="s">
					{$t('s_history_widget_name')}
				</StyledText>
			</TouchableNative>
			<Spacer>
				<Stack>
					{transactions.map(item => (
						<TransactionListItem
							key={`tx-${item.hash || item.id}`}
							group={item.group}
							transaction={item}
							currentAccount={currentAccount}
							walletAccounts={walletAccounts}
							addressBook={addressBook}
							networkIdentifier={networkIdentifier}
							chainName={chainName}
							ticker={ticker}
							onPress={() => handleTransactionPress(item)}
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

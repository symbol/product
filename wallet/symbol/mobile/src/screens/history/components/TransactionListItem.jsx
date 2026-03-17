import { useTransactionItemData } from '../hooks';
import { Amount, ListItemContainer, StyledText, TransactionAvatar } from '@/app/components';
import { $t } from '@/app/localization';
import { Colors, Sizes } from '@/app/styles';
import React from 'react';
import { StyleSheet, View } from 'react-native';

/** @typedef {import('@/app/types/Transaction').Transaction} Transaction */
/** @typedef {import('@/app/types/Account').WalletAccount} WalletAccount */
/** @typedef {import('@/app/types/Network').NetworkIdentifier} NetworkIdentifier */

const AWAITING_SIGNATURE_COLOR = Colors.Semantic.role.info.default;

/**
 * TransactionListItem component. Displays transaction information in a compact
 * list item format with icon, action, description, date/status, and amount.
 *
 * @param {Object} props - Component props.
 * @param {string} props.group - Transaction group (confirmed, unconfirmed, partial).
 * @param {Transaction} props.transaction - Transaction data to display.
 * @param {WalletAccount} props.currentAccount - Current user account.
 * @param {WalletAccount[]} props.walletAccounts - Wallet accounts for the network.
 * @param {Object} props.addressBook - Address book instance.
 * @param {NetworkIdentifier} props.networkIdentifier - Network identifier (e.g., 'mainnet').
 * @param {string} props.chainName - Chain name (e.g., 'symbol').
 * @param {string} props.ticker - Ticker symbol for the network currency.
 * @param {boolean} [props.isDateHidden=false] - Whether to hide the date display.
 * @param {function(): void} [props.onPress] - Callback when item is pressed.
 * @returns {React.ReactNode} TransactionListItem component.
 */
export const TransactionListItem = ({
	group,
	transaction,
	currentAccount,
	walletAccounts,
	addressBook,
	networkIdentifier,
	chainName,
	ticker,
	isDateHidden = false,
	onPress
}) => {
	const { amount } = transaction;
	const isZeroAmount = !amount || amount === '0';

	const transactionData = useTransactionItemData({
		transaction,
		group,
		currentAccount,
		walletAccounts,
		addressBook,
		chainName,
		networkIdentifier,
		isDateHidden
	});

	const borderColor = transactionData.isAwaitingAccountSignature
		? AWAITING_SIGNATURE_COLOR
		: null;

	return (
		<ListItemContainer
			contentContainerStyle={styles.root}
			borderColor={borderColor}
			onPress={onPress}
		>
			<View style={styles.iconSection}>
				<TransactionAvatar iconName={transactionData.iconName} size="s" />
			</View>
			<View style={styles.contentSection}>
				<StyledText type="title" size="s">
					{transactionData.action}
				</StyledText>
				{transactionData.isAwaitingAccountSignature && (
					<StyledText type="label" size="m" style={styles.awaitingSignatureStatusText}>
						{$t('transactionDescriptionShort_awaitingAccountSignature')}
					</StyledText>
				)}
				{!transactionData.isAwaitingAccountSignature && (
					<StyledText type="body" size="m">
						{transactionData.description}
					</StyledText>
				)}
				<View style={styles.bottomRow}>
					<StyledText type="body" size="s" style={styles.dateText}>
						{transactionData.dateText}
					</StyledText>
					{!isZeroAmount && (
						<Amount
							value={amount}
							ticker={ticker}
							isColored
							size="m"
						/>
					)}
				</View>
			</View>
		</ListItemContainer>
	);
};

const styles = StyleSheet.create({
	root: {
		flexDirection: 'row',
		width: '100%'
	},
	iconSection: {
		flexDirection: 'column',
		justifyContent: 'center',
		paddingRight: Sizes.Semantic.spacing.m
	},
	contentSection: {
		flex: 1,
		flexDirection: 'column',
		justifyContent: 'space-between'
	},
	bottomRow: {
		alignSelf: 'stretch',
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginTop: Sizes.Semantic.spacing.xs
	},
	dateText: {
		opacity: 0.7
	},
	awaitingSignatureStatusText: {
		color: AWAITING_SIGNATURE_COLOR
	}
});

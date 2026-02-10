import { useTransactionItemData } from '../hooks';
import { Amount, ListItemContainer, StyledText, TransactionAvatar } from '@/app/components';
import { $t } from '@/app/localization';
import { Colors, Sizes } from '@/app/styles';
import React from 'react';
import { StyleSheet, View } from 'react-native';

const AWAITING_SIGNATURE_COLOR = Colors.Semantic.role.info.default;

/**
 * TransactionListItem component. A list item for displaying transaction information in a
 * compact format with an icon, action, description, date/status, and amount.
 *
 * @param {object} props - Component props
 * @param {string} props.group - The transaction group (confirmed, unconfirmed, partial)
 * @param {object} props.transaction - The transaction object
 * @param {object} props.currentAccount - Current user account
 * @param {object} props.walletAccounts - Wallet accounts by network
 * @param {object} props.addressBook - Address book instance
 * @param {string} props.networkIdentifier - Network identifier (e.g., 'mainnet')
 * @param {string} props.chainName - Chain name (e.g., 'symbol')
 * @param {string} props.ticker - The ticker symbol for the network currency
 * @param {boolean} [props.isDateHidden=false] - Whether to hide the date display
 * @param {function} [props.onPress] - Function to call when the item is pressed
 *
 * @returns {React.ReactNode} Transaction list item component
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

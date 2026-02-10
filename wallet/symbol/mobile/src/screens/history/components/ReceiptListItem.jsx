import { useReceiptItemData } from '../hooks';
import { Amount, ListItemContainer, StyledText, TransactionAvatar } from '@/app/components';
import { Sizes } from '@/app/styles';
import React from 'react';
import { StyleSheet, View } from 'react-native';

/**
 * ReceiptListItem component. A list item for displaying receipt information in a
 * compact format with an icon, action, description, date, and amount.
 *
 * @param {object} props - Component props
 * @param {object} props.receipt - The receipt object
 * @param {string} props.ticker - The ticker symbol for the network currency (e.g., 'XYM')
 * @param {boolean} [props.isDateHidden=false] - Whether to hide the date display
 * @param {function} [props.onPress] - Function to call when the item is pressed
 *
 * @returns {React.ReactNode} Receipt list item component
 */
export const ReceiptListItem = ({
	receipt,
	ticker,
	isDateHidden = false,
	onPress
}) => {
	// Data
	const { amount } = receipt;
	const {
		iconName,
		action,
		description,
		dateText
	} = useReceiptItemData({ receipt, isDateHidden });

	return (
		<ListItemContainer
			contentContainerStyle={styles.root}
			onPress={onPress}
		>
			<View style={styles.iconSection}>
				<TransactionAvatar iconName={iconName} size="s" />
			</View>
			<View style={styles.contentSection}>
				<StyledText type="title" size="s">
					{action}
				</StyledText>
				<StyledText type="body" size="m">
					{description}
				</StyledText>
				<View style={styles.bottomRow}>
					<StyledText type="body" size="s" style={styles.dateText}>
						{dateText}
					</StyledText>
					{amount && (
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

// Styles
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
	}
});

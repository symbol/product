import { IdentityRow } from '../IdentityRow';
import { Amount, StyledText, TokenAvatar } from '@/app/components';
import { Sizes } from '@/app/styles';
import { formatTokenNameText } from '@/app/utils';
import React from 'react';
import { StyleSheet, View } from 'react-native';

const DEFAULT_SIZE = 'm';

/**
 * TokenBalanceRow component. Token row with an amount: avatar next to the "name • ticker" label
 * and the amount below it.
 * @param {object} props - Component props.
 * @param {string} props.name - Resolved token name.
 * @param {string|null} [props.amount] - Token amount. Hidden when undefined or empty; null shows the placeholder.
 * @param {string} [props.ticker] - Token ticker symbol, appended to the name label.
 * @param {string} [props.imageId] - Known token image identifier.
 * @param {React.ReactNode} [props.accessory] - Optional element rendered on the right side of the row.
 * @param {React.ReactNode} [props.titleCaption] - Optional element rendered at the end of the name line.
 * @param {('m'|'l')} [props.size=DEFAULT_SIZE] - Size of the row avatar and amount.
 * @param {React.ReactNode} [props.children] - Optional extra content rendered below the amount.
 * @returns {React.ReactNode} TokenBalanceRow component.
 */
export const TokenBalanceRow = ({ name, amount, ticker, imageId, accessory, titleCaption, size = DEFAULT_SIZE, children }) => {
	const nameText = formatTokenNameText(name, ticker);
	const isAmountVisible = amount !== undefined && amount !== '';
	const amountSize = size === 'l' ? 'l' : 'm';
	const amountStyle = size === 'l' ? styles.amountLarge : null;

	return (
		<IdentityRow avatar={<TokenAvatar imageId={imageId} size={size} />} accessory={accessory}>
			{titleCaption ? (
				<View style={styles.titleRow}>
					<StyledText>
						{nameText}
					</StyledText>
					{titleCaption}
				</View>
			) : (
				<StyledText>
					{nameText}
				</StyledText>
			)}
			{isAmountVisible && (
				<Amount value={amount} size={amountSize} style={amountStyle} />
			)}
			{children}
		</IdentityRow>
	);
};

const styles = StyleSheet.create({
	titleRow: {
		flexDirection: 'row',
		justifyContent: 'space-between'
	},
	amountLarge: {
		marginTop: Sizes.Semantic.spacing.s
	}
});

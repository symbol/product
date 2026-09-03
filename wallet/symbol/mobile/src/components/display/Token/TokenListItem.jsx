import { ExpirationProgress, ListItemContainer, TokenBalanceRow } from '@/app/components';
import { Sizes } from '@/app/styles';
import React from 'react';
import { StyleSheet } from 'react-native';

const PROGRESS_WIDTH = Sizes.Semantic.spacing.m * 15;

/** @typedef {import('@/app/types/Token').TokenExpiration} TokenExpiration */

/**
 * TokenListItem component. A pressable list card for a token: avatar, name, amount, and an
 * optional expiration progress indicator.
 * @param {object} props - Component props.
 * @param {string} props.name - Resolved token name.
 * @param {string|null} [props.amount] - Token amount.
 * @param {string} [props.ticker] - Token ticker symbol, appended to the name label.
 * @param {string} [props.imageId] - Known token image identifier.
 * @param {TokenExpiration|null} [props.expiration] - Expiration data. The progress bar is hidden when not provided.
 * @param {string} [props.accessibilityLabel] - Accessibility label for the pressable card.
 * @param {function(): void} [props.onPress] - Optional press handler.
 * @returns {React.ReactNode} TokenListItem component.
 */
export const TokenListItem = ({ name, amount, ticker, imageId, expiration, accessibilityLabel, onPress }) => (
	<ListItemContainer accessibilityLabel={accessibilityLabel} onPress={onPress}>
		<TokenBalanceRow name={name} amount={amount} ticker={ticker} imageId={imageId} size="l">
			{!!expiration && (
				<ExpirationProgress
					startHeight={expiration.startHeight}
					endHeight={expiration.endHeight}
					chainHeight={expiration.chainHeight}
					blockGenerationTargetTime={expiration.blockGenerationTargetTime}
					style={styles.expirationProgress}
				/>
			)}
		</TokenBalanceRow>
	</ListItemContainer>
);

const styles = StyleSheet.create({
	expirationProgress: {
		width: PROGRESS_WIDTH
	}
});

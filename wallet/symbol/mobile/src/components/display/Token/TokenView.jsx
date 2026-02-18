import { StyledText, TokenAvatar } from '@/app/components';
import { Sizes } from '@/app/styles';
import React from 'react';
import { StyleSheet, View } from 'react-native';

const DEFAULT_SIZE = 'm';

/**
 * TokenView component. A display component showing a token's avatar alongside its name, ticker
 * symbol, and amount, with support for different sizes.
 * 
 * @param {object} props - Component props
 * @param {string} props.name - Token name
 * @param {string} props.amount - Token amount
 * @param {string} [props.ticker] - Token ticker symbol
 * @param {string} [props.imageId] - Known account image identifier
 * @param {string} [props.size=DEFAULT_SIZE] - Size of the avatar
 * 
 * @returns {React.ReactNode} Token view component
 */
export const TokenView = ({ name, amount, ticker, imageId, size = DEFAULT_SIZE }) => {
	// Root container
	const rootSizeStyleMap = {
		s: styles.root_small,
		m: styles.root_medium,
		l: styles.root_large
	};
	const rootSizeStyle = rootSizeStyleMap[size];

	// Text container
	const textContainerStyle = size === 's' 
		? styles.textContainer_small
		: null;

	// Amount
	const isAmountVisible = typeof amount === 'string' && amount !== '';
	const amountStyle = size === 'm' && styles.amount_medium;
	const amountTextSize = size === 'l' ? 'xl' : 'm';
	const isAmountTextBold = size === 's' ? true : false;

	// Name
	const nameText = !ticker 
		? name
		: size === 's'
			? ticker
			: `${name} • ${ticker}`;

	return (
		<View style={[styles.root, rootSizeStyle]}>
			<TokenAvatar 
				imageId={imageId}
				size={size}
			/>
			<View style={textContainerStyle}>
				<StyledText>
					{nameText}
				</StyledText>
				{isAmountVisible && (
					<StyledText style={amountStyle} size={amountTextSize} bold={isAmountTextBold}>
						{amount}
					</StyledText>
				)}
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	root: {
		flexDirection: 'row',
		alignItems: 'center'
	},
	root_small: {
		gap: Sizes.Semantic.spacing.s
	},
	root_medium: {
		gap: Sizes.Semantic.spacing.m
	},
	root_large: {
		gap: Sizes.Semantic.spacing.m
	},
	textContainer_small: {
		flexDirection: 'row-reverse',
		gap: Sizes.Semantic.spacing.s
	},
	amount_medium: {
		opacity: 0.7
	}
});

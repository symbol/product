import { Colors, Typography } from '@/app/styles';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

/**
 * Amount component for displaying values with optional coloring and sizing
 *
 * @param {object} props - Component props
 * @param {string} props.value - The numeric value to display
 * @param {string} props.ticker - The ticker symbol (e.g., currency code)
 * @param {boolean} [props.isColored=false] - Whether to apply color based on value sign
 * @param {string} [props.size='m'] - Size variant ('s', 'm', 'l')
 * 
 * @returns {React.ReactNode} Amount display component
 */
export const Amount = ({ value, ticker, isColored = false, size = 'm' }) => {
	// Size
	const amountTextStyleMap = {
		l: Typography.Semantic.body.xl,
		m: Typography.Semantic.body.m,
		s: Typography.Semantic.body.s
	};
	const tickerTextStyleMap = {
		l: Typography.Semantic.body.m,
		m: Typography.Semantic.body.m,
		s: Typography.Semantic.body.s
	};
	const amountTextStyle = amountTextStyleMap[size];
	const tickerTextStyle = tickerTextStyleMap[size];

	// Color
	const colorMap = {
		positive: Colors.Semantic.role.success.default,
		negative: Colors.Semantic.role.danger.default,
		neutral: Colors.Components.main.text
	};

	let textColor;
	if (
		isColored === false 
        || !value
        || typeof value !== 'string' 
        || value === '0'
	)
		textColor = colorMap.neutral;
	else if (value.startsWith('-'))
		textColor = colorMap.negative;
	else
		textColor = colorMap.positive;

	// Merge styles
	const amountStyle = {
		...amountTextStyle,
		color: textColor
	};
	const tickerStyle = {
		...tickerTextStyle,
		color: textColor
	};

	return (
		<View style={styles.root}>
			<Text style={amountStyle}>{value}</Text>
			<Text style={tickerStyle}>{` ${ticker}`}</Text>
		</View>
	);
};

const styles = StyleSheet.create({
	root: {
		flexDirection: 'row',
		alignItems: 'baseline'
	}
});

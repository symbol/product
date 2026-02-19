import { Colors, Typography } from '@/app/styles';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

/**
 * Amount component. A display component for showing numeric values with ticker symbols,
 * supporting conditional coloring based on positive/negative values and multiple size variants.
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
		m: Typography.Semantic.bodyBold.m,
		s: Typography.Semantic.body.s
	};
	const decimalTextStyleMap = {
		l: Typography.Semantic.body.l,
		m: Typography.Semantic.bodyBold.m,
		s: Typography.Semantic.body.s
	};
	const tickerTextStyleMap = {
		l: Typography.Semantic.body.l,
		m: Typography.Semantic.body.m,
		s: Typography.Semantic.body.s
	};
	const amountTextStyle = amountTextStyleMap[size];
	const decimalTextStyle = decimalTextStyleMap[size];
	const tickerTextStyle = tickerTextStyleMap[size];

	// Color
	const colorMap = {
		positive: Colors.Semantic.role.success.default,
		negative: Colors.Semantic.role.danger.default,
		neutral: Colors.Components.main.text
	};

	let textColor;
	const stringValue = String(value);
	const decimalSeparatorIndex = stringValue.indexOf('.');
	const integerPart = decimalSeparatorIndex === -1
		? stringValue
		: stringValue.slice(0, decimalSeparatorIndex);
	const decimalPart = decimalSeparatorIndex === -1
		? ''
		: stringValue.slice(decimalSeparatorIndex);

	if (
		isColored === false
		|| !stringValue
		|| typeof stringValue !== 'string'
		|| stringValue === '0'
	)
		textColor = colorMap.neutral;
	else if (stringValue.startsWith('-'))
		textColor = colorMap.negative;
	else
		textColor = colorMap.positive;

	// Merge styles
	const amountStyle = {
		...amountTextStyle,
		color: textColor
	};
	const decimalStyle = {
		...decimalTextStyle,
		color: textColor
	};
	const tickerStyle = {
		...tickerTextStyle,
		color: textColor
	};

	return (
		<View style={styles.root}>
			<Text style={amountStyle}>{integerPart}</Text>
			{Boolean(decimalPart) && (
				<Text style={decimalStyle}>{decimalPart}</Text>
			)}
			{Boolean(ticker) && (
				<Text style={tickerStyle}>{` ${ticker}`}</Text>
			)}
		</View>
	);
};

const styles = StyleSheet.create({
	root: {
		flexDirection: 'row',
		alignItems: 'baseline'
	}
});

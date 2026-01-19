import { Icon, StyledText } from '@/app/components';
import { Sizes } from '@/app/styles';
import React from 'react';
import { StyleSheet, View } from 'react-native';

const ICON_SIZE = 'm';

const iconMap = {
	true: 'check',
	false: 'cross'
};

/**
 * BooleanView component for displaying boolean values with visual indicators.
 *
 * Renders a checkmark icon for true values and a cross icon for false values,
 * optionally accompanied by descriptive text.
 *
 * @param {object} props - Component props
 * @param {boolean} props.value - The boolean value to display (true shows checkmark, false shows cross)
 * @param {string} [props.text] - Optional descriptive text to display alongside the icon
 *
 * @returns {React.ReactNode} Rendered BooleanView component
 */
export const BooleanView = ({ value, text }) => {
	const iconName = value ? iconMap.true : iconMap.false;
	const isTextVisible = Boolean(text);

	return (
		<View style={styles.root}>
			<Icon name={iconName} size={ICON_SIZE} />
			{isTextVisible && (
				<StyledText>{text}</StyledText>
			)}
		</View>
	);
};

const styles = StyleSheet.create({
	root: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: Sizes.Semantic.spacing.s
	}
});

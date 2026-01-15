import { Icon, StyledText } from '@/app/components';
import { Colors, Typography } from '@/app/styles';
import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';

/**
 * A close button component that displays an optional text label alongside a cross icon, used for dismissing modals or closing views.
 * 
 * @param {object} props - Component props
 * @param {string} [props.text] - Optional text to display next to the icon
 * @param {object} [props.style] - Additional styles for the button
 * @param {function} props.onPress - Press handler
 * 
 * @returns {React.ReactNode} Close button component
 */
export const ButtonClose = props => {
	const { text, style, onPress } = props;

	return (
		<TouchableOpacity
			style={[styles.root, style]}
			hitSlop={5}
			onPress={onPress}
		>
			{!!text && (
				<StyledText type="label" style={styles.text}>
					{text}
				</StyledText>
			)}
			<Icon name="cross" size="m" />
		</TouchableOpacity>
	);
};

const styles = StyleSheet.create({
	root: {
		flexDirection: 'row',
		alignItems: 'center',
		minHeight: Typography.Semantic.label.m.lineHeight
	},
	text: {
		color: Colors.Components.main.text
	}
});

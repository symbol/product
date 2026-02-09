import { Colors, Typography } from '@/app/styles';
import React from 'react';
import { StyleSheet, Text } from 'react-native';

const COLOR_DEFAULT = Colors.Components.main.text;
const COLOR_ERROR = Colors.Semantic.role.danger.default;

/**
 * StatusText component. Displays the passcode status message including errors and remaining attempts.
 *
 * @param {object} props - Component props.
 * @param {string} props.text - The status text to display.
 * @param {boolean} [props.isError=false] - Whether the text represents an error state.
 * 
 * @returns {React.ReactNode} The status text component.
 */
export const StatusText = ({ text, isError = false }) => {
	return (
		<Text style={[styles.text, isError && styles.textError]}>
			{text}
		</Text>
	);
};

const styles = StyleSheet.create({
	text: {
		...Typography.Semantic.body.m,
		color: COLOR_DEFAULT,
		textAlign: 'center',
		minHeight: Typography.Semantic.body.m.lineHeight
	},
	textError: {
		color: COLOR_ERROR
	}
});

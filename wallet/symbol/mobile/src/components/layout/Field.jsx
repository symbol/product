import { StyledText } from '@/app/components';
import { Sizes } from '@/app/styles';
import React from 'react';
import { StyleSheet, View } from 'react-native';

/**
 * Field component. A layout component grouping a title label with associated content, supporting inverse color scheme for titles.
 * @param {object} props - Component props.
 * @param {React.ReactNode} props.children - Content below the title.
 * @param {string} props.title - Title text displayed as a label above the content.
 * @param {object} [props.style] - Additional styles for the root element.
 * @param {boolean} [props.inverse=false] - Whether to use inverse color scheme for the title text.
 * @returns {React.ReactNode} Field component.
 */
export const Field = ({ children, title, style, inverse = false }) => {
	return (
		<View style={[styles.root, style]}>
			<StyledText type="label" style={styles.title} inverse={inverse}>{title}</StyledText>
			{children}
		</View>
	);
};

const styles = StyleSheet.create({
	root: {
		gap: Sizes.Semantic.spacing.none
	},
	title: {
		opacity: 0.7
	}
});

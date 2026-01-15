import { StyledText } from './StyledText';
import { Sizes } from '@/app/styles';
import React from 'react';
import { StyleSheet, View } from 'react-native';

/**
 * Field component that groups a title label with associated content, typically used for
 * form fields or data display sections.
 *
 * @param {object} props - Component props
 * @param {React.ReactNode} props.children - Content.
 * @param {string} props.title - Title text displayed as a label above the content.
 * @param {object} [props.style] - Additional styles for the root View element.
 * @param {boolean} [props.inverse=false] - Whether to use inverse color scheme for the title text.
 *
 * @returns {React.ReactNode} Rendered Field component
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

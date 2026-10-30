import { StyledText } from '@/app/components';
import { Sizes } from '@/app/styles';
import React from 'react';
import { StyleSheet, View } from 'react-native';

/** @typedef {import('@/app/components/typography/StyledText').TextSize} TextSize */

/**
 * Field component. A layout component grouping a title label with associated content, supporting inverse color scheme for titles.
 * @param {object} props - Component props.
 * @param {React.ReactNode} props.children - Content below the title.
 * @param {string} props.title - Title text displayed as a label above the content.
 * @param {object} [props.style] - Additional styles for the root element.
 * @param {boolean} [props.inverse=false] - Whether to use inverse color scheme for the title text.
 * @param {boolean} [props.alignRight=false] - Whether to align the title and the content to the right edge.
 * @param {TextSize} [props.size='m'] - Title text size.
 * @returns {React.ReactNode} Field component.
 */
export const Field = ({ children, title, style, inverse = false, alignRight = false, size = 'm' }) => {
	return (
		<View style={[styles.root, alignRight && styles.rootAlignRight, style]}>
			<StyledText type="label" size={size} style={[styles.title, alignRight && styles.titleAlignRight]} inverse={inverse}>
				{title}
			</StyledText>
			{children}
		</View>
	);
};

const styles = StyleSheet.create({
	root: {
		gap: Sizes.Semantic.spacing.none
	},
	rootAlignRight: {
		alignItems: 'flex-end'
	},
	title: {
		opacity: 0.7
	},
	titleAlignRight: {
		textAlign: 'right'
	}
});

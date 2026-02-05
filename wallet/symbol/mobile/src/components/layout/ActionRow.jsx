import { Sizes } from '@/app/styles';
import React from 'react';
import { StyleSheet, View } from 'react-native';

/**
 * ActionRow component. A layout component arranging child content and an optional button in a
 * horizontal row, supporting stretching to fill available width.
 *
 * @param {object} props - Component props
 * @param {React.ReactNode} props.children - Child components
 * @param {React.ReactNode} [props.button] - Optional button component to display
 * @param {object} [props.style] - Additional styles for the root View element
 * @param {boolean} [props.isStretched=false] - If true, the component will stretch to fill the available width
 *
 * @returns {React.ReactNode} ActionRow component
 */
export const ActionRow = ({ children, button, style, isStretched = false }) => {
	const stretchedStyle = isStretched ? styles.root_stretched : null;

	return (
		<View style={[styles.root, style, stretchedStyle]}>
			<View style={styles.content}>
				{children}
			</View>
			{button}
		</View>
	);
};

const styles = StyleSheet.create({
	root: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: Sizes.Semantic.spacing.s
	},
	root_stretched: {
		flexGrow: 1,
		justifyContent: 'space-between'
	},
	content: {
		flexShrink: 1
	}
});

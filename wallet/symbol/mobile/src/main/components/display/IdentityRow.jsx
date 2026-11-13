import { Sizes } from '@/app/styles';
import React from 'react';
import { StyleSheet, View } from 'react-native';

/**
 * IdentityRow component. Internal layout primitive shared by the account and token rows: a leading
 * avatar, a flexible text column, and an optional trailing accessory. Not exported from the
 * components barrel.
 * @param {object} props - Component props.
 * @param {React.ReactNode} props.avatar - Leading avatar element.
 * @param {React.ReactNode} [props.accessory] - Optional trailing element, vertically centered.
 * @param {object} [props.style] - Additional styles for the row container.
 * @param {React.ReactNode} props.children - Text column content.
 * @returns {React.ReactNode} IdentityRow component.
 */
export const IdentityRow = ({ avatar, accessory, style, children }) => (
	<View style={[styles.root, style]}>
		{avatar}
		<View style={styles.content}>
			{children}
		</View>
		{!!accessory && (
			<View style={styles.accessory}>
				{accessory}
			</View>
		)}
	</View>
);

const styles = StyleSheet.create({
	root: {
		flexDirection: 'row',
		alignItems: 'center',
		flexGrow: 1,
		flexShrink: 1,
		gap: Sizes.Semantic.spacing.m
	},
	content: {
		alignSelf: 'stretch',
		flexGrow: 1,
		flexShrink: 1,
		justifyContent: 'center'
	},
	accessory: {
		marginLeft: 'auto',
		justifyContent: 'center',
		paddingLeft: Sizes.Semantic.spacing.m
	}
});

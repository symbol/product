import { StyledText, TokenAvatar } from '@/app/components';
import { Sizes } from '@/app/styles';
import React from 'react';
import { StyleSheet, View } from 'react-native';

/** @typedef {import('@/app/types/Sizes').SizeVariant} SizeVariant */

const DEFAULT_SIZE = 'm';

/**
 * TokenInfoView component. A display component showing a token's avatar alongside its name and
 * identifier, with support for different sizes.
 * @param {object} props - Component props.
 * @param {string} props.id - Token identifier.
 * @param {string} [props.name] - Optional token name.
 * @param {string} [props.imageId] - Known token image identifier.
 * @param {SizeVariant} [props.size=DEFAULT_SIZE] - Size of the avatar.
 * @returns {React.ReactNode} Token info view component.
 */
export const TokenInfoView = ({ id, name, imageId, size = DEFAULT_SIZE }) => {
	// Root container
	const rootSizeStyleMap = {
		m: styles.root_medium
	};
	const rootSizeStyle = rootSizeStyleMap[size];

	// Id
	const isNameVisible = !!name;
	const idTextVariant = isNameVisible ? 'secondary' : 'primary';

	return (
		<View style={[styles.root, rootSizeStyle]}>
			<TokenAvatar
				imageId={imageId}
				size={size}
			/>
			<View style={styles.textContainer}>
				{isNameVisible && (
					<StyledText numberOfLines={1}>
						{name}
					</StyledText>
				)}
				<StyledText variant={idTextVariant}>
					{id}
				</StyledText>
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	root: {
		flexDirection: 'row',
		alignItems: 'center',
		flexShrink: 1
	},
	root_medium: {
		gap: Sizes.Semantic.spacing.m
	},
	textContainer: {
		flexShrink: 1
	}
});

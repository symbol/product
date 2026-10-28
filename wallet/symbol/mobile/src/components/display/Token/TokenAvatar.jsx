import { Sizes } from '@/app/styles';
import { tokenImageSourceMap } from '@/brand/assets/images/tokens/token-image-source-map';
import { tokenImageConfig } from '@/brand/config/token-image-config';
import React from 'react';
import { Image, StyleSheet } from 'react-native';

/** @typedef {import('@/app/types/Sizes').AvatarSize} AvatarSize */

const DEFAULT_SIZE = 'm';
const AVATAR_SIZE_S = Sizes.Semantic.avatarHeight.s;
const AVATAR_SIZE_M = Sizes.Semantic.avatarHeight.m;
const AVATAR_SIZE_L = Sizes.Semantic.avatarHeight.l;
const AVATAR_SIZE_XL = Sizes.Semantic.avatarHeight.xl;
const DEFAULT_TOKEN_ID = 'default';

const sizeMap = {
	s: 'small',
	m: 'medium',
	l: 'large',
	xl: 'large'
};

/**
 * TokenAvatar component. Displays an avatar for a given token.
 * If a known token image identifier is provided, it uses that image.
 * Otherwise, it falls back to a default token image.
 * @param {object} props - Component props.
 * @param {string} props.imageId - Known token image identifier.
 * @param {AvatarSize} [props.size=DEFAULT_SIZE] - Size of the avatar.
 * @param {object} [props.style] - Additional styles for the avatar.
 * @returns {React.ReactNode} Token avatar component.
 */
export const TokenAvatar = ({ imageId, size = DEFAULT_SIZE, style }) => {
	// Image
	const imageSize = sizeMap[size];
	const tokenImageNames = tokenImageConfig.images[imageId] ?? tokenImageConfig.images[DEFAULT_TOKEN_ID];
	const imageName = tokenImageNames[imageSize];
	const imageSrc = tokenImageSourceMap[imageName];

	if (!imageSrc && __DEV__)
		throw new Error(`TokenAvatar: Token image source not found for name "${imageName}".`);

	const fallbackImageSrc = tokenImageSourceMap[tokenImageConfig.images[DEFAULT_TOKEN_ID][imageSize]];

	// Size style
	const rootSizeStyleMap = {
		s: styles.root_small,
		m: styles.root_medium,
		l: styles.root_large,
		xl: styles.root_xlarge
	};
	const rootSizeStyle = rootSizeStyleMap[size];

	return (
		<Image source={imageSrc ?? fallbackImageSrc} style={[rootSizeStyle, style]} />
	);
};

const styles = StyleSheet.create({
	root_small: {
		width: AVATAR_SIZE_S,
		height: AVATAR_SIZE_S
	},
	root_medium: {
		width: AVATAR_SIZE_M,
		height: AVATAR_SIZE_M
	},
	root_large: {
		width: AVATAR_SIZE_L,
		height: AVATAR_SIZE_L
	},
	root_xlarge: {
		width: AVATAR_SIZE_XL,
		height: AVATAR_SIZE_XL
	}
});

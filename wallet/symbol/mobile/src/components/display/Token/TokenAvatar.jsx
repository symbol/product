import { tokenImages } from '@/app/config/known-token-images';
import { Sizes } from '@/app/styles';
import React from 'react';
import { Image, StyleSheet } from 'react-native';

const DEFAULT_SIZE = 'm';
const AVATAR_SIZE_S = Sizes.Semantic.avatarHeight.s;
const AVATAR_SIZE_M = Sizes.Semantic.avatarHeight.m;
const AVATAR_SIZE_L = Sizes.Semantic.avatarHeight.l;
const DEFAULT_TOKEN_ID = 'default';

const sizeMap = {
	s: 'small',
	m: 'medium',
	l: 'large'
};

/**
 * TokenAvatar component
 * 
 * Displays an avatar for a given token.
 * If a known token image identifier is provided, it uses that image.
 * Otherwise, it falls back to a default token image.
 * 
 * @param {object} props - Component props
 * @param {string} props.imageId - Known token image identifier
 * @param {string} [props.size=DEFAULT_SIZE] - Size of the avatar
 * 
 * @returns {React.ReactNode} Token avatar component
 */
export const TokenAvatar = ({ imageId, size = DEFAULT_SIZE }) => {
	// Image
	const tokenImagePack = tokenImages[imageId];
	const tokenImageSrcFromPack = tokenImagePack ? tokenImagePack[sizeMap[size]] : null;
	const imageSrc = tokenImageSrcFromPack ?? tokenImages[DEFAULT_TOKEN_ID][sizeMap[size]];

	// Size style
	const rootSizeStyleMap = {
		s: styles.root_small,
		m: styles.root_medium,
		l: styles.root_large
	};
	const rootSizeStyle = rootSizeStyleMap[size];

	return (
		<Image source={imageSrc} style={rootSizeStyle} />
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
	}
});

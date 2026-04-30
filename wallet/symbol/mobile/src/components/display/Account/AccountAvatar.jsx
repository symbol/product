import { Icon } from '@/app/components/visual';
import { accountImages } from '@/app/config/known-account-images';
import { generateBlockie } from '@/app/lib/blockie';
import { Sizes } from '@/app/styles';
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

/** @typedef {import('@/app/types/Sizes').AvatarSize} AvatarSize */

const DEFAULT_SIZE = 'm';
const AVATAR_SIZE_S = Sizes.Semantic.avatarHeight.s;
const AVATAR_SIZE_M = Sizes.Semantic.avatarHeight.m;
const AVATAR_SIZE_L = Sizes.Semantic.avatarHeight.l;
const AVATAR_SIZE_XL = Sizes.Semantic.avatarHeight.xl;

/**
 * AccountAvatar component. Displays an avatar for a given account address.
 * If a custom imageId is provided, it uses that image.
 * Otherwise, it generates a blockie image based on the address.
 * @param {object} props - Component props.
 * @param {string} props.address - Account address.
 * @param {string} [props.imageId] - Known account image identifier.
 * @param {AvatarSize} [props.size=DEFAULT_SIZE] - Size of the avatar.
 * @returns {React.ReactNode} Account avatar component.
 */
export const AccountAvatar = ({ address, imageId, size = DEFAULT_SIZE }) => {
	// Image 
	const customImageSrc = accountImages[imageId] || null;
	const [generatedImageSrc, setGeneratedImageSrc] = useState('');

	useEffect(() => {
		if (customImageSrc)
			return;

		const blockie = generateBlockie(address);
		setGeneratedImageSrc({ uri: blockie.image });
	}, [customImageSrc, address]);

	// Size style
	const rootSizeStyleMap = {
		s: styles.root_small,
		m: styles.root_medium,
		l: styles.root_large,
		xl: styles.root_xlarge
	};
	const rootSizeStyle = rootSizeStyleMap[size];

	// Account icon
	const iconSizeMap = {
		s: 'xs',
		m: 'xs',
		l: 'xs',
		xl: 's'
	};
	const iconSize = iconSizeMap[size];

	return (
		<View style={[styles.root, rootSizeStyle]}>
			<Image source={customImageSrc ?? generatedImageSrc} style={styles.image} />
			{!customImageSrc && <Icon name="account" size={iconSize} variant="inverse" />}
		</View>
	);
};

const styles = StyleSheet.create({
	root: {
		position: 'relative',
		overflow: 'hidden',
		justifyContent: 'center',
		alignItems: 'center'
	},
	root_small: {
		width: AVATAR_SIZE_S,
		height: AVATAR_SIZE_S,
		borderRadius: AVATAR_SIZE_S / 2
	},
	root_medium: {
		width: AVATAR_SIZE_M,
		height: AVATAR_SIZE_M,
		borderRadius: AVATAR_SIZE_M / 2
	},
	root_large: {
		width: AVATAR_SIZE_L,
		height: AVATAR_SIZE_L,
		borderRadius: AVATAR_SIZE_L / 2
	},
	root_xlarge: {
		width: AVATAR_SIZE_XL,
		height: AVATAR_SIZE_XL,
		borderRadius: AVATAR_SIZE_XL / 2
	},
	image: {
		position: 'absolute',
		width: '100%',
		height: '100%'
	}
});

import { AccountAvatar, Icon, StyledText } from '@/app/components';
import { Colors, Sizes } from '@/app/styles';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

const WIDTH = Sizes.Semantic.spacing.m * 12;
const AVATAR_SIZE = Sizes.Semantic.avatarHeight.xl;

/** @typedef {import('wallet-common-core').Contact} Contact */
/** @typedef {import('@/app/types/ColorVariants').IconColorVariants} IconColorVariants */

/**
 * ContactCompactItem component. Displays a compact contact with avatar and caption.
 * @param {object} props - Component props.
 * @param {string} [props.address] - The contact address.
 * @param {string} [props.icon] - Icon name if no address is provided.
 * @param {IconColorVariants} [props.iconVariant] - Icon variant of the custom icon.
 * @param {string} props.caption - The contact caption.
 * @param {() => void} [props.onPress] - Callback when the item is pressed.
 * @returns {React.ReactNode} ContactCompactItem component.
 */
export const ContactCompactItem = ({ address, icon, iconVariant, caption, onPress }) => {
	const isAccountAvatarVisible = Boolean(address);
	const isCustomIconVisible = Boolean(icon) && !isAccountAvatarVisible;

	return (
		<TouchableOpacity style={styles.root} onPress={onPress}>
			{isAccountAvatarVisible && (
				<AccountAvatar address={address} size="xl" />
			)}
			{isCustomIconVisible && (
				<View style={styles.customIconContainer}>
					<Icon name={icon} size="s" variant={iconVariant} />
				</View>
			)}
			<StyledText size="m">
				{caption}
			</StyledText>
		</TouchableOpacity>
	);
};

const styles = StyleSheet.create({
	root: {
		width: WIDTH,
		flexDirection: 'column',
		justifyContent: 'center',
		alignItems: 'center',
		gap: Sizes.Semantic.spacing.m
	},
	customIconContainer: {
		width: AVATAR_SIZE,
		height: AVATAR_SIZE,
		borderRadius: AVATAR_SIZE / 2,
		justifyContent: 'center',
		alignItems: 'center',
		backgroundColor: Colors.Semantic.background.tertiary.darker
	}
});

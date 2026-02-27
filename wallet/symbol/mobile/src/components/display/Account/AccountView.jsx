import { AccountAvatar, StyledText } from '@/app/components';
import { Sizes } from '@/app/styles';
import React from 'react';
import { StyleSheet, View } from 'react-native';

const DEFAULT_SIZE = 'm';

/**
 * AccountView component. A display component showing an account's avatar alongside its name or address, with support for different sizes.
 * 
 * @param {object} props - Component props
 * @param {string} props.address - Account address
 * @param {string} [props.name] - Optional account name
 * @param {string} [props.imageId] - Known account image identifier
 * @param {string} [props.size=DEFAULT_SIZE] - Size of the avatar
 * 
 * @returns {React.ReactNode} Account view component
 */
export const AccountView = ({ address, name, imageId, size = DEFAULT_SIZE }) => {
	const rootSizeStyleMap = {
		s: styles.root_small,
		m: styles.root_medium,
		l: styles.root_large
	};
	const rootSizeStyle = rootSizeStyleMap[size];
	const isNameVisible = !!name;
	const isAddressVisible = !isNameVisible || size !== 's';
	const addressTextSize = isNameVisible ? 's' : 'm';

	return (
		<View style={[styles.root, rootSizeStyle]}>
			<AccountAvatar
				address={address}
				imageId={imageId}
				size={size}
			/>
			<View style={styles.textContainer}>
				{isNameVisible && (
					<StyledText>
						{name}
					</StyledText>
				)}
				{isAddressVisible && (
					<StyledText size={addressTextSize}>
						{address}
					</StyledText>
				)}
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
	root_small: {
		gap: Sizes.Semantic.spacing.s
	},
	root_medium: {
		gap: Sizes.Semantic.spacing.m
	},
	root_large: {
		gap: Sizes.Semantic.spacing.m
	},
	textContainer: {
		flexShrink: 1
	}
});

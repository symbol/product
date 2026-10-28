import { Sizes } from '@/app/styles';
import { transactionIconSourceMap } from '@/brand/assets/images/transactions/transaction-icon-source-map';
import React from 'react';
import { Image, StyleSheet } from 'react-native';

/** @typedef {import('@/app/types/Sizes').AvatarSize} AvatarSize */

const DEFAULT_SIZE = 'm';
const AVATAR_SIZE_S = Sizes.Semantic.avatarHeight.s;
const AVATAR_SIZE_M = Sizes.Semantic.avatarHeight.m;
const AVATAR_SIZE_L = Sizes.Semantic.avatarHeight.l;
const AVATAR_SIZE_XL = Sizes.Semantic.avatarHeight.xl;
const DEFAULT_TRANSACTION_TYPE = 'default';

/**
 * Valid icon name for the TransactionAvatar, derived from the transaction icon source map keys.
 * @typedef {keyof typeof transactionIconSourceMap} TransactioniconName
 */

/**
 * TransactionAvatar component. Displays an icon representing a transaction type.
 * Supports multiple sizes while using a single source image that scales appropriately.
 * @param {object} props - Component props.
 * @param {TransactioniconName} props.iconName - The transaction icon type identifier.
 * @param {AvatarSize} [props.size=DEFAULT_SIZE] - Size of the avatar ('s', 'm', 'l').
 * @returns {React.ReactNode} Transaction avatar component.
 */
export const TransactionAvatar = ({ iconName, size = DEFAULT_SIZE }) => {
	// Image source
	const imageSrc = transactionIconSourceMap[iconName] ?? transactionIconSourceMap[DEFAULT_TRANSACTION_TYPE];

	// Size style
	const sizeStyleMap = {
		s: styles.avatar_small,
		m: styles.avatar_medium,
		l: styles.avatar_large,
		xl: styles.avatar_xlarge
	};
	const sizeStyle = sizeStyleMap[size] ?? styles.avatar_medium;

	return (
		<Image source={imageSrc} style={sizeStyle} />
	);
};

const styles = StyleSheet.create({
	avatar_small: {
		width: AVATAR_SIZE_S,
		height: AVATAR_SIZE_S
	},
	avatar_medium: {
		width: AVATAR_SIZE_M,
		height: AVATAR_SIZE_M
	},
	avatar_large: {
		width: AVATAR_SIZE_L,
		height: AVATAR_SIZE_L
	},
	avatar_xlarge: {
		width: AVATAR_SIZE_XL,
		height: AVATAR_SIZE_XL
	}
});

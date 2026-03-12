import { Sizes } from '@/app/styles';
import React from 'react';
import { Image, StyleSheet } from 'react-native';

const DEFAULT_SIZE = 'm';
const AVATAR_SIZE_S = Sizes.Semantic.avatarHeight.s;
const AVATAR_SIZE_M = Sizes.Semantic.avatarHeight.m;
const AVATAR_SIZE_L = Sizes.Semantic.avatarHeight.l;
const DEFAULT_TRANSACTION_TYPE = 'default';

const transactionIconSourceMap = {
	transfer: require('@/app/assets/images/transactions/transfer.png'),
	aggregate: require('@/app/assets/images/transactions/aggregate.png'),
	namespace: require('@/app/assets/images/transactions/namespace.png'),
	token: require('@/app/assets/images/transactions/token.png'),
	restriction: require('@/app/assets/images/transactions/restriction.png'),
	key: require('@/app/assets/images/transactions/key.png'),
	lock: require('@/app/assets/images/transactions/lock.png'),
	metadata: require('@/app/assets/images/transactions/metadata.png'),
	multisig: require('@/app/assets/images/transactions/multisig.png'),
	swap: require('@/app/assets/images/transactions/swap.png'),
	revert: require('@/app/assets/images/transactions/revert.png'),
	reward: require('@/app/assets/images/transactions/reward.png'),
	default: require('@/app/assets/images/transactions/transfer.png')
};

/**
 * @typedef {'s'|'m'|'l'} AvatarSize
 */

/**
 * @typedef {keyof typeof transactionIconSourceMap} TransactioniconName
 */

/**
 * TransactionAvatar component. Displays an icon representing a transaction type.
 * Supports multiple sizes while using a single source image that scales appropriately.
 *
 * @param {object} props - Component props
 * @param {TransactioniconName} props.iconName - The transaction icon type identifier
 * @param {AvatarSize} [props.size=DEFAULT_SIZE] - Size of the avatar ('s', 'm', 'l')
 *
 * @returns {React.ReactNode} Transaction avatar component
 */
export const TransactionAvatar = ({ iconName, size = DEFAULT_SIZE }) => {
	// Image source
	const imageSrc = transactionIconSourceMap[iconName] ?? transactionIconSourceMap[DEFAULT_TRANSACTION_TYPE];

	// Size style
	const sizeStyleMap = {
		s: styles.avatar_small,
		m: styles.avatar_medium,
		l: styles.avatar_large
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
	}
});

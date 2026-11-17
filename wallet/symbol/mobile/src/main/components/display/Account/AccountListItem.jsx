import { AccountBalanceRow } from './AccountBalanceRow';
import { ListItemContainer } from '@/app/components';
import { generateBlockie } from '@/app/lib/blockie';
import { Sizes } from '@/app/styles';
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

/**
 * AccountListItem component. A pressable account card for lists: the account balance row inside a
 * list item container, with a background tinted from the account avatar color.
 * @param {object} props - Component props.
 * @param {string} props.address - The account address.
 * @param {string} [props.name] - Resolved display name. Falls back to the address.
 * @param {string|null} [props.amount] - The account balance. When nullish, the balance row is not rendered.
 * @param {string} [props.ticker] - The currency ticker symbol.
 * @param {string} [props.imageId] - Known account image identifier.
 * @param {React.ReactNode} [props.accessory] - Optional element rendered on the right side of the item.
 * @param {string} [props.accessibilityLabel] - Accessibility label for the pressable item.
 * @param {() => void} [props.onPress] - Callback when the item is pressed.
 * @returns {React.ReactNode} AccountListItem component.
 */
export const AccountListItem = ({ address, name, amount, ticker, imageId, accessory, accessibilityLabel, onPress }) => {
	const tintColor = useMemo(() => generateBlockie(address).background, [address]);

	return (
		<ListItemContainer
			contentContainerStyle={styles.root}
			accessibilityLabel={accessibilityLabel}
			onPress={onPress}
		>
			<View style={[styles.background, { backgroundColor: tintColor }]} />
			<AccountBalanceRow
				address={address}
				name={name}
				amount={amount}
				ticker={ticker}
				imageId={imageId}
				accessory={accessory}
				size="l"
			/>
		</ListItemContainer>
	);
};

const styles = StyleSheet.create({
	root: {
		flexDirection: 'row',
		width: '100%'
	},
	background: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		opacity: 0.1,
		borderRadius: Sizes.Semantic.borderRadius.m
	}
});

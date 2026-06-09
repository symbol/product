import { AccountAvatar, ListItemContainer, StyledText } from '@/app/components';
import { generateBlockie } from '@/app/lib/blockie';
import { Sizes } from '@/app/styles';
import React from 'react';
import { StyleSheet, View } from 'react-native';

/** @typedef {import('wallet-common-core').Contact} Contact */

/**
 * ContactListItem component. Displays a contact card with avatar,
 * name, and address information.
 * @param {object} props - Component props.
 * @param {Contact} props.contact - The contact object.
 * @param {() => void} [props.onPress] - Callback when the item is pressed.
 * @returns {React.ReactNode} ContactListItem component.
 */
export const ContactListItem = ({ contact, onPress }) => {
	const { address, name } = contact;
	const blockie = generateBlockie(address);

	return (
		<ListItemContainer
			contentContainerStyle={styles.root}
			onPress={onPress}
		>
			<View style={[styles.background, { backgroundColor: blockie.background }]} />
			<View style={styles.iconSection}>
				<AccountAvatar address={address} size="l" />
			</View>
			<View style={styles.contentSection}>
				<StyledText type="title" size="s">
					{name}
				</StyledText>

				<StyledText type="label" size="s">
					{address}
				</StyledText>
			</View>
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
	},
	iconSection: {
		flexDirection: 'column',
		justifyContent: 'center',
		paddingRight: Sizes.Semantic.spacing.m
	},
	contentSection: {
		flex: 1,
		flexDirection: 'column',
		justifyContent: 'center'
	}
});

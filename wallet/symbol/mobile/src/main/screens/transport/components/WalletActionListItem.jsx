import { Icon, ListItemContainer, StyledText } from '@/app/components';
import { Colors, Sizes } from '@/app/styles';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';

/**
 * Wallet action list item component. Displays an icon, title, and description, and handles press events.
 * @param {object} props - Component props.
 * @param {string} props.title - Item title.
 * @param {string} props.description - Item description.
 * @param {string} props.icon - Item icon name.
 * @param {number} props.index - Item index for animation delay.
 * @param {function(): void} props.onPress - Function to call on item press.
 * @returns {React.ReactNode} Wallet action item component.
 */
export const WalletActionListItem = ({
	title,
	description,
	icon,
	index,
	onPress
}) => {
	const animationDelay = index * 50;

	return (
		<Animated.View entering={FadeInRight.delay(animationDelay)}>
			<ListItemContainer
				contentContainerStyle={styles.root}
				onPress={onPress}
			>
				<View style={styles.icon}>
					<Icon name={icon} size="s" />
				</View>
				<View style={styles.content}>
					<StyledText type="title" size="s">{title}</StyledText>
					<StyledText type="body">{description}</StyledText>
				</View>
			</ListItemContainer>
		</Animated.View>
	);
};

const styles = StyleSheet.create({
	root: {
		flexDirection: 'row',
		width: '100%',
		paddingVertical: Sizes.Semantic.layoutSpacing.m
	},
	icon: {
		borderRadius: Sizes.Semantic.borderRadius.round,
		backgroundColor: Colors.Semantic.role.primary.default,
		width: Sizes.Semantic.iconSize.l,
		height: Sizes.Semantic.iconSize.l,
		marginRight: Sizes.Semantic.spacing.l,
		alignItems: 'center',
		justifyContent: 'center'
	},
	content: {
		flex: 1
	}
});

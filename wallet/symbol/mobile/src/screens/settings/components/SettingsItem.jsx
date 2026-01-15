import { StyledText, TouchableNative } from '@/app/components';
import { Colors, Sizes } from '@/app/styles';
import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';

const iconSourceMap = {
	network: require('@/app/assets/images/settings/network.png'),
	language: require('@/app/assets/images/settings/language.png'),
	security: require('@/app/assets/images/settings/security.png'),
	currency: require('@/app/assets/images/settings/currency.png'),
	about: require('@/app/assets/images/settings/about.png'),
	logout: require('@/app/assets/images/settings/logout.png')
};

/**
 * Settings item component
 * 
 * @param {object} props - Component props
 * @param {string} props.title - Item title.
 * @param {string} props.description - Item description.
 * @param {any} props.icon - Item icon source.
 * @param {number} props.index - Item index for animation delay.
 * @param {function} props.onPress - Function to call on item press.
 * 
 * @returns {React.ReactNode} Settings item component
 */
export const SettingsItem = ({
	title,
	description,
	icon,
	index,
	onPress
}) => {
	const iconSrc = iconSourceMap[icon];
	const animationDelay = index * 50;

	return (
		<Animated.View entering={FadeInRight.delay(animationDelay)}>
			<TouchableNative style={styles.root} onPress={onPress}>
				<Image source={iconSrc} style={styles.icon} />
				<View style={styles.content}>
					<StyledText type="title" size="s">{title}</StyledText>
					<StyledText type="body">{description}</StyledText>
				</View>
			</TouchableNative>
		</Animated.View>
	);
};

const styles = StyleSheet.create({
	root: {
		flexDirection: 'row',
		minHeight: Sizes.Semantic.spacing.m * 10,
		borderRadius: Sizes.Semantic.borderRadius.s,
		backgroundColor: Colors.Components.card.background,
		padding: Sizes.Semantic.layoutSpacing.m,
		gap: Sizes.Semantic.layoutSpacing.m
	},
	content: {
		flex: 1
	},
	icon: {
		width: Sizes.Semantic.spacing.xxl,
		height: Sizes.Semantic.spacing.xxl
	}
});

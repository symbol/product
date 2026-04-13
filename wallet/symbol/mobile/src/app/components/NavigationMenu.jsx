import { StyledText, TouchableNative } from '@/app/components';
import { $t } from '@/app/localization';
import { Router } from '@/app/router/Router';
import { RouteName } from '@/app/router/config';
import { Colors, Sizes } from '@/app/styles';
import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

const ITEM_HEIGHT = Sizes.Semantic.navigationMenuHeight.m;
const ICON_SIZE = Sizes.Semantic.spacing.xl;

const ICON_SOURCE_MAP = {
	[RouteName.Home]: {
		default: require('@/app/assets/images/navigation/home_d.png'),
		active: require('@/app/assets/images/navigation/home_a.png')
	},
	[RouteName.History]: {
		default: require('@/app/assets/images/navigation/history_d.png'),
		active: require('@/app/assets/images/navigation/history_a.png')
	},
	[RouteName.Assets]: {
		default: require('@/app/assets/images/navigation/assets_d.png'),
		active: require('@/app/assets/images/navigation/assets_a.png')
	},
	[RouteName.Actions]: {
		default: require('@/app/assets/images/navigation/features_d.png'),
		active: require('@/app/assets/images/navigation/features_a.png')
	}
};

const TAB_CONFIG = [
	{
		titleKey: 'navigation_home',
		name: RouteName.Home,
		navigate: () => Router.goToHome()
	},
	{
		titleKey: 'navigation_history',
		name: RouteName.History,
		navigate: () => Router.goToHistory()
	},
	{
		titleKey: 'navigation_assets',
		name: RouteName.Assets,
		navigate: () => Router.goToAssets()
	},
	{
		titleKey: 'navigation_actions',
		name: RouteName.Actions,
		navigate: () => Router.goToActions()
	}
];

/**
 * Navigation menu item component. Displays a tab with an icon and title.
 *
 * @param {object} props - Component props
 * @param {string} props.title - Tab title text.
 * @param {boolean} props.isActive - Whether the tab is currently active.
 * @param {object} props.iconDefault - Default icon source.
 * @param {object} props.iconActive - Active icon source.
 * @param {function} props.onPress - Function to call on tab press.
 *
 * @returns {React.ReactNode} NavigationMenuItem component
 */
const NavigationMenuItem = ({ title, isActive, iconDefault, iconActive, onPress }) => {
	const itemStyle = isActive ? [styles.item, styles.itemActive] : styles.item;
	const titleStyle = isActive ? styles.titleActive : styles.title;
	const iconSource = isActive ? iconActive : iconDefault;
	const pressedColor = Colors.Components.navigationMenuItem.active.background;

	return (
		<View style={itemStyle}>
			<TouchableNative colorPressed={pressedColor} style={styles.touchable} onPress={onPress}>
				<Image source={iconSource} style={styles.icon} />
				<StyledText type="label" size="s" style={titleStyle}>
					{title}
				</StyledText>
			</TouchableNative>
		</View>
	);
};

/**
 * Navigation menu component. Displays a horizontal tab bar for main app navigation.
 * Handles navigation between screens.
 *
 * @returns {React.ReactNode} NavigationMenu component
 */
export const NavigationMenu = ({ currentRouteName }) => {
	const handleTabPress = tab => {
		if (tab.name !== currentRouteName)
			tab.navigate();
	};

	return (
		<Animated.View style={styles.root} entering={FadeInDown}>
			{TAB_CONFIG.map(tab => {
				const icons = ICON_SOURCE_MAP[tab.name];
				const isActive = tab.name === currentRouteName;

				return (
					<NavigationMenuItem
						key={tab.name}
						title={$t(tab.titleKey)}
						isActive={isActive}
						iconDefault={icons.default}
						iconActive={icons.active}
						onPress={() => handleTabPress(tab)}
					/>
				);
			})}
		</Animated.View>
	);
};

const styles = StyleSheet.create({
	root: {
		width: '100%',
		backgroundColor: Colors.Components.navigationMenu.background,
		flexDirection: 'row'
	},
	item: {
		flex: 1,
		height: ITEM_HEIGHT,
		borderRadius: Sizes.Semantic.borderRadius.s,
		backgroundColor: Colors.Components.navigationMenuItem.default.background
	},
	itemActive: {
		backgroundColor: Colors.Components.navigationMenuItem.active.background
	},
	touchable: {
		width: '100%',
		height: '100%',
		flexDirection: 'column',
		justifyContent: 'center',
		alignItems: 'center'
	},
	title: {
		color: Colors.Components.navigationMenuItem.default.text
	},
	titleActive: {
		color: Colors.Components.navigationMenuItem.active.text
	},
	icon: {
		width: ICON_SIZE,
		height: ICON_SIZE
	}
});

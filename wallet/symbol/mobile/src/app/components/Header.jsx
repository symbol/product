import { AccountAvatar, StyledText, TouchableNative } from '@/app/components';
import { Icon } from '@/app/components/visual';
import { Router } from '@/app/router/Router';
import { Colors, Sizes } from '@/app/styles';
import React from 'react';
import { StyleSheet, View } from 'react-native';

const HEADER_HEIGHT = Sizes.Semantic.headerHeight.m;
const ACCOUNT_SELECTOR_HEIGHT = Sizes.Semantic.selectHeight.m;
const ACCOUNT_SELECTOR_WIDTH_PERCENT = '60%';
const ADDRESS_TRUNCATE_START = 6;
const ADDRESS_TRUNCATE_END = 3;

/**
 * Truncates an address string for display.
 *
 * @param {string} address - The full address string.
 * @returns {string} The truncated address.
 */
const truncateAddress = address => {
	if (!address || address.length <= ADDRESS_TRUNCATE_START + ADDRESS_TRUNCATE_END)
		return address;

	const start = address.slice(0, ADDRESS_TRUNCATE_START);
	const end = address.slice(-ADDRESS_TRUNCATE_END);

	return `${start}...${end}`;
};

/**
 * Header component. Displays the app header with account selector and settings button.
 * Provides navigation to settings and account selection functionality.
 *
 * @param {object} props - Component props
 * @param {object} props.currentAccount - The currently selected account object.
 * @param {string} props.currentAccount.address - The account address.
 * @param {string} props.currentAccount.name - The account display name.
 *
 * @returns {React.ReactNode} Header component
 */
export const Header = ({ currentAccount }) => {
	// Derived values
	const truncatedAddress = currentAccount ? truncateAddress(currentAccount.address) : '';

	// Handlers
	const handleAccountPress = () => {
		Router.goToAccountList();
	};

	const handleSettingsPress = () => {
		Router.goToSettings();
	};

	// Render
	return (
		<View style={styles.root}>
			<TouchableNative
				style={styles.accountSelector}
				containerStyle={styles.accountSelectorContainer}
				onPress={handleAccountPress}
			>
				{!!currentAccount && (
					<View style={styles.accountInfo}>
						<AccountAvatar size="s" address={currentAccount.address} />
						<View style={styles.accountText}>
							<StyledText type="label" size="m" style={styles.nameText}>
								{currentAccount.name}
							</StyledText>
							<StyledText type="body" size="s">
								{truncatedAddress}
							</StyledText>
						</View>
					</View>
				)}
				<Icon name="chevron-down" size="m" />
			</TouchableNative>
			<TouchableNative containerStyle={styles.settingsButton} onPress={handleSettingsPress}>
				<Icon name="settings" size="m" />
			</TouchableNative>
		</View>
	);
};

// Styles
const styles = StyleSheet.create({
	root: {
		width: '100%',
		height: HEADER_HEIGHT,
		backgroundColor: Colors.Components.titlebar.background,
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		paddingHorizontal: Sizes.Semantic.layoutPadding.m
	},
	accountSelectorContainer: {
		width: ACCOUNT_SELECTOR_WIDTH_PERCENT,
		height: ACCOUNT_SELECTOR_HEIGHT,
		borderRadius: Sizes.Semantic.borderRadius.m,
		borderWidth: Sizes.Semantic.borderWidth.s,
		borderColor: Colors.Semantic.role.primary.default
	},
	accountSelector: {
		width: '100%',
		height: '100%',
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		paddingHorizontal: Sizes.Semantic.layoutPadding.s
	},
	accountInfo: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: Sizes.Semantic.spacing.m
	},
	accountText: {
		flexDirection: 'column'
	},
	nameText: {
		color: Colors.Semantic.role.primary.default
	},
	settingsButton: {
		width: ACCOUNT_SELECTOR_HEIGHT,
		height: ACCOUNT_SELECTOR_HEIGHT,
		justifyContent: 'center',
		alignItems: 'center',
		borderRadius: Sizes.Semantic.borderRadius.round
	}
});

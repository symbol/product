import { Colors, Typography } from '@/app/styles';

export const RouteName = {
	Welcome: 'Welcome',
	CreateWallet: 'CreateWallet',
	ImportWallet: 'ImportWallet',
	Home: 'Home',
	History: 'History',
	Assets: 'Assets',
	TokenDetails: 'TokenDetails',
	AccountDetails: 'AccountDetails',
	AccountList: 'AccountList',
	AddSeedAccount: 'AddSeedAccount',
	AddExternalAccount: 'AddExternalAccount',
	Send: 'Send',
	Settings: 'Settings',
	SettingsAbout: 'SettingsAbout',
	SettingsNetwork: 'SettingsNetwork',
	SettingsSecurity: 'SettingsSecurity',
	BridgeAccountList: 'BridgeAccountList',
	BridgeAccountDetails: 'BridgeAccountDetails',
	BridgeSwap: 'BridgeSwap',
	BridgeSwapDetails: 'BridgeSwapDetails'
};

export const RouterFlow = {
	ONBOARDING: 'onboarding',
	MAIN: 'main'
};

export const DEEP_LINKING_PREFIX = 'web+symbol://';

export const SCREEN_BACKGROUND_COLOR = 'transparent';
export const TRANSITION_ANIMATION = 'fade';
export const HEADER_BACKGROUND_COLOR = Colors.Components.titlebar.background;
export const HEADER_TINT_COLOR = Colors.Components.main.text;
export const HEADER_TITLE_TEXT = Typography.Semantic.title.m;

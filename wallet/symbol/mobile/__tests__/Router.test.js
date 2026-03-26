import { Router } from '@/app/router/Router';
import { RouterView } from '@/app/router/RouterView';
import { navigationRef } from '@/app/router/navigationRef';
import { render, waitFor } from '@testing-library/react-native';
import React from 'react';

jest.mock('@react-navigation/native', () => {
	const React = require('react');
	const { View } = require('react-native');

	return {
		...jest.requireActual('@react-navigation/native'),
		NavigationContainer: ({ children }) => <View>{children}</View>,
		createNavigationContainerRef: () => ({
			current: null,
			isReady: jest.fn().mockReturnValue(true),
			goBack: jest.fn(),
			navigate: jest.fn(),
			reset: jest.fn()
		})
	};
});

jest.mock('react-native-safe-area-context', () => {
	const { View } = require('react-native');
	return {
		SafeAreaProvider: ({ children }) => <View>{children}</View>,
		SafeAreaView: ({ children }) => <View>{children}</View>,
		useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
		useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
		SafeAreaInsetsContext: {
			Consumer: ({ children }) => children({ top: 0, bottom: 0, left: 0, right: 0 }),
			Provider: ({ children }) => <View>{children}</View>
		},
		SafeAreaFrameContext: {
			Consumer: ({ children }) => children({ x: 0, y: 0, width: 390, height: 844 }),
			Provider: ({ children }) => <View>{children}</View>
		}
	};
});

jest.mock('react-native-screens', () => ({
	enableScreens: jest.fn(),
	enableFreeze: jest.fn()
}));

jest.mock('@react-navigation/native-stack', () => {
	const React = require('react');
	const { View } = require('react-native');

	return {
		createNativeStackNavigator: () => ({
			Navigator: ({ children }) => <View>{children}</View>,
			Group: ({ children }) => <View>{children}</View>,
			Screen: ({ component: Component }) => <Component />
		})
	};
});

jest.mock('@/app/screens', () => {
	const { Text } = require('react-native');
	// eslint-disable-next-line react/display-name
	const createMockScreen = screenName => () => <Text>{`Screen:${screenName}`}</Text>;

	return {
		Welcome: createMockScreen('Welcome'),
		CreateWallet: createMockScreen('CreateWallet'),
		ImportWallet: createMockScreen('ImportWallet'),
		Home: createMockScreen('Home'),
		History: createMockScreen('History'),
		TransactionDetails: createMockScreen('TransactionDetails'),
		Assets: createMockScreen('Assets'),
		TokenDetails: createMockScreen('TokenDetails'),
		AccountDetails: createMockScreen('AccountDetails'),
		AccountList: createMockScreen('AccountList'),
		AddSeedAccount: createMockScreen('AddSeedAccount'),
		BridgeAccountList: createMockScreen('BridgeAccountList'),
		BridgeAccountDetails: createMockScreen('BridgeAccountDetails'),
		BridgeSwap: createMockScreen('BridgeSwap'),
		BridgeSwapDetails: createMockScreen('BridgeSwapDetails'),
		MultisigAccountList: createMockScreen('MultisigAccountList'),
		MultisigAccountDetails: createMockScreen('MultisigAccountDetails'),
		CreateMultisigAccount: createMockScreen('CreateMultisigAccount'),
		ModifyMultisigAccount: createMockScreen('ModifyMultisigAccount'),
		Send: createMockScreen('Send'),
		Settings: createMockScreen('Settings'),
		SettingsAbout: createMockScreen('SettingsAbout'),
		SettingsNetwork: createMockScreen('SettingsNetwork'),
		SettingsSecurity: createMockScreen('SettingsSecurity')
	};
});

const renderRouterView = props => render(<RouterView {...props} />);

const NAVIGATION_SCREENS_CONFIG = [
	{
		screenName: 'Welcome',
		shouldReset: true,
		hasParams: false
	},
	{
		screenName: 'CreateWallet',
		shouldReset: false,
		hasParams: false
	},
	{
		screenName: 'ImportWallet',
		shouldReset: false,
		hasParams: false
	},
	{
		screenName: 'Home',
		shouldReset: true,
		hasParams: false
	},
	{
		screenName: 'History',
		shouldReset: true,
		hasParams: false
	},
	{
		screenName: 'TransactionDetails',
		shouldReset: false,
		hasParams: true
	},
	{
		screenName: 'Assets',
		shouldReset: true,
		hasParams: false
	},
	{
		screenName: 'Send',
		shouldReset: false,
		hasParams: true
	},
	{
		screenName: 'AccountDetails',
		shouldReset: false,
		hasParams: true
	},
	{		screenName: 'AccountList',
		shouldReset: false,
		hasParams: true
	},
	{
		screenName: 'AddSeedAccount',
		shouldReset: false,
		hasParams: true
	},
	{		screenName: 'Settings',
		shouldReset: false,
		hasParams: true
	},
	{
		screenName: 'SettingsAbout',
		shouldReset: false,
		hasParams: true
	},
	{
		screenName: 'SettingsNetwork',
		shouldReset: false,
		hasParams: true
	},
	{
		screenName: 'SettingsSecurity',
		shouldReset: false,
		hasParams: true
	},
	{
		screenName: 'MultisigAccountList',
		shouldReset: false,
		hasParams: true
	},
	{
		screenName: 'MultisigAccountDetails',
		shouldReset: false,
		hasParams: true
	},
	{
		screenName: 'CreateMultisigAccount',
		shouldReset: false,
		hasParams: false
	},
	{
		screenName: 'ModifyMultisigAccount',
		shouldReset: false,
		hasParams: true
	}
];

const INITIAL_SCREENS_CONFIG = [
	{
		flow: 'onboarding',
		screenName: 'Welcome'
	},
	{
		flow: 'main',
		screenName: 'Home'
	}
];

describe('Router', () => {
	describe('goBack', () => {
		it('calls navigationRef.goBack', () => {
			// Act:
			Router.goBack();

			// Assert:
			expect(navigationRef.goBack).toHaveBeenCalled();
		});
	});

	describe('navigate methods', () => {
		const runNavigateMethodTest = config => {
			// Arrange:
			const { screenName, shouldReset, hasParams } = config;
			const methodName = `goTo${screenName}`;
			const description = `navigates to ${screenName} screen${shouldReset ? ' with reset' : ''}`;
			const params = hasParams 
				? { 
					params: { 
						testParam: 123 
					} 
				} 
				: undefined;

			it(description, () => {
				// Act:
				Router[methodName](params);

				// Assert:
				if (shouldReset) {
					expect(navigationRef.reset).toHaveBeenCalledWith({
						index: 0,
						routes: [{ name: screenName }]
					});
				} else if (hasParams) {
					expect(navigationRef.navigate).toHaveBeenCalledWith(screenName, params.params);
				} else {
					expect(navigationRef.navigate).toHaveBeenCalledWith(screenName);
				}
			});
		};

		NAVIGATION_SCREENS_CONFIG.forEach(runNavigateMethodTest);
	});

	describe('screen render', () => {
		it('does not render content when isActive is false', () => {
			// Act:
			const { queryByText } = renderRouterView({ isActive: false, flow: 'onboarding' });

			// Assert:
			expect(queryByText('Screen:Welcome')).toBeNull();
		});

		const runInitialScreenRenderTest = config => {
			const { flow, screenName } = config;
			const description = `renders ${screenName} as initial screen for ${flow} flow`;

			it(description, async () => {
				// Act:
				const { getByText } = renderRouterView({ isActive: true, flow });

				// Assert:
				await waitFor(() => {
					expect(getByText(`Screen:${screenName}`)).toBeTruthy();
				});
			});
		};

		INITIAL_SCREENS_CONFIG.forEach(runInitialScreenRenderTest);
	});
});

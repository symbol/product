import { $t } from './localization';
import { Colors, Typography } from './styles';
import * as screens from '@/app/screens';
import { DefaultTheme, NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

const Stack = createNativeStackNavigator();
const theme = {
	...DefaultTheme,
	colors: {
		...DefaultTheme.colors,
		background: 'transparent'
	}
};
const screenOptions = ({ route }) => ({
	animation: 'fade',
	headerStyle: {
		backgroundColor: Colors.Components.titlebar.background
	},
	headerTintColor: Colors.Components.main.text,
	headerTitleStyle: Typography.Semantic.title.m,
	title: $t(`screen_${route.name}`)
});

const keys = {
	Welcome: 'Welcome',
	CreateWallet: 'CreateWallet',
	ImportWallet: 'ImportWallet',
	Home: 'Home',
	AccountDetails: 'AccountDetails',
	Settings: 'Settings',
	SettingsAbout: 'SettingsAbout',
	SettingsNetwork: 'SettingsNetwork',
	SettingsSecurity: 'SettingsSecurity'
};

const linkingOptions = {
	prefixes: ['web+symbol://'],
	config: {
		screens: {
			[keys.TransactionRequest]: 'transaction'
		}
	}
};

export const navigationRef = createNavigationContainerRef();

export const RouterView = ({ isActive, flow }) => (
	<NavigationContainer theme={theme} ref={navigationRef} linking={linkingOptions}>
		{isActive && (
			<Stack.Navigator screenOptions={screenOptions}>
				{flow === 'onboarding' && (
					<Stack.Group screenOptions={{ headerShown: false }}>
						<Stack.Screen name={keys.Welcome} component={screens.Welcome} />
						<Stack.Screen name={keys.CreateWallet} component={screens.CreateWallet} />
						<Stack.Screen name={keys.ImportWallet} component={screens.ImportWallet} />
					</Stack.Group>
				)}
				{flow === 'main' && (
					<React.Fragment>
						<Stack.Group screenOptions={{ headerShown: false }}>
							<Stack.Screen name={keys.Home} component={screens.Home} />
						</Stack.Group>
						<Stack.Group>
							<Stack.Screen name={keys.AccountDetails} component={screens.AccountDetails} />
							<Stack.Screen name={keys.Settings} component={screens.Settings} />
							<Stack.Screen name={keys.SettingsAbout} component={screens.SettingsAbout} />
							<Stack.Screen name={keys.SettingsNetwork} component={screens.SettingsNetwork} />
							<Stack.Screen name={keys.SettingsSecurity} component={screens.SettingsSecurity} />
						</Stack.Group>
					</React.Fragment>
				)}
			</Stack.Navigator>
		)}
	</NavigationContainer>
);

export class Router {
	static goBack() {
		navigationRef.goBack();
	}
	static goToWelcome() {
		navigationRef.reset({
			index: 0,
			routes: [{ name: keys.Welcome }]
		});
	}
	static goToCreateWallet() {
		navigationRef.navigate(keys.CreateWallet);
	}
	static goToImportWallet() {
		navigationRef.navigate(keys.ImportWallet);
	}
	static goToHome() {
		navigationRef.reset({
			index: 0,
			routes: [{ name: keys.Home }]
		});
	}
	static goToAccountDetails(params) {
		navigationRef.navigate(keys.AccountDetails, params);
	}
	static goToSettings(params) {
		navigationRef.navigate(keys.Settings, params);
	}
	static goToSettingsAbout(params) {
		navigationRef.navigate(keys.SettingsAbout, params);
	}
	static goToSettingsNetwork(params) {
		navigationRef.navigate(keys.SettingsNetwork, params);
	}
	static goToSettingsSecurity(params) {
		navigationRef.navigate(keys.SettingsSecurity, params);
	}
}

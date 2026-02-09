import { $t } from '@/app/localization';
import { 
	DEEP_LINKING_PREFIX, 
	HEADER_BACKGROUND_COLOR, 
	HEADER_TINT_COLOR, 
	HEADER_TITLE_TEXT, 
	RouteName, 
	RouterFlow, 
	SCREEN_BACKGROUND_COLOR, 
	TRANSITION_ANIMATION 
} from '@/app/router/config';
import { navigationRef } from '@/app/router/navigationRef';
import * as screens from '@/app/screens';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { enableFreeze, enableScreens } from 'react-native-screens';

const Stack = createNativeStackNavigator();
enableScreens(true);
enableFreeze(true);

const theme = {
	...DefaultTheme,
	colors: {
		...DefaultTheme.colors,
		background: SCREEN_BACKGROUND_COLOR
	}
};

const screenOptions = ({ route }) => ({
	animation: TRANSITION_ANIMATION,
	headerStyle: {
		backgroundColor: HEADER_BACKGROUND_COLOR
	},
	headerTintColor: HEADER_TINT_COLOR,
	headerTitleStyle: HEADER_TITLE_TEXT,
	title: $t(`screen_${route.name}`)
});

const linkingOptions = {
	prefixes: [DEEP_LINKING_PREFIX],
	config: {
		screens: {
			[RouteName.TransactionRequest]: 'transaction'
		}
	}
};

export const RouterView = ({ isActive, flow }) => (
	<NavigationContainer theme={theme} ref={navigationRef} linking={linkingOptions}>
		{isActive && (
			<Stack.Navigator screenOptions={screenOptions}>
				{flow === RouterFlow.ONBOARDING && (
					<Stack.Group screenOptions={{ headerShown: false }}>
						<Stack.Screen name={RouteName.Welcome} component={screens.Welcome} />
						<Stack.Screen name={RouteName.CreateWallet} component={screens.CreateWallet} />
						<Stack.Screen name={RouteName.ImportWallet} component={screens.ImportWallet} />
					</Stack.Group>
				)}
				{flow === RouterFlow.MAIN && (
					<React.Fragment>
						<Stack.Group screenOptions={{ headerShown: false }}>
							<Stack.Screen name={RouteName.Home} component={screens.Home} />
							<Stack.Screen name={RouteName.History} component={screens.History} />
						</Stack.Group>
						<Stack.Group>
							<Stack.Screen name={RouteName.AccountDetails} component={screens.AccountDetails} />
							<Stack.Screen name={RouteName.AccountList} component={screens.AccountList} />
							<Stack.Screen name={RouteName.AddSeedAccount} component={screens.AddSeedAccount} />
							<Stack.Screen name={RouteName.Send} component={screens.Send} />
							<Stack.Screen name={RouteName.Settings} component={screens.Settings} />
							<Stack.Screen name={RouteName.SettingsAbout} component={screens.SettingsAbout} />
							<Stack.Screen name={RouteName.SettingsNetwork} component={screens.SettingsNetwork} />
							<Stack.Screen name={RouteName.SettingsSecurity} component={screens.SettingsSecurity} />
						</Stack.Group>
					</React.Fragment>
				)}
			</Stack.Navigator>
		)}
	</NavigationContainer>
);

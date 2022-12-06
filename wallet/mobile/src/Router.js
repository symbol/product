import { createNavigationContainerRef, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as screens from 'src/screens';
import { colors, fonts } from './styles';

const Stack = createNativeStackNavigator();
const theme = {
    ...DefaultTheme,
    colors: {
        ...DefaultTheme.colors,
        background: 'transparent',
    },
};
const screenOptions = {
    headerStyle: {
        backgroundColor: colors.bgNavbar,
    },
    headerTintColor: colors.textBody,
    headerTitleStyle: fonts.title,
};

const keys = {
    Welcome: 'Welcome',
    CreateWallet: 'CreateWallet',
    ImportWallet: 'ImportWallet',
    Home: 'Home',
    History: 'History',
    AccountList: 'AccountList',
    AddSeedAccount: 'AddSeedAccount',
    Settings: 'Settings',
    SettingsNetwork: 'SettingsNetwork',
    Passcode: 'Passcode',
};

export const navigationRef = createNavigationContainerRef();

export const RouterView = ({ isActive }) => (
    <NavigationContainer theme={theme} ref={navigationRef}>
        {isActive && (<Stack.Navigator screenOptions={screenOptions}>
            <>
                <Stack.Group screenOptions={{ headerShown: false }}>
                    <Stack.Screen name={keys.Welcome} component={screens.Welcome} />
                    <Stack.Screen name={keys.CreateWallet} component={screens.CreateWallet} />
                    <Stack.Screen name={keys.ImportWallet} component={screens.ImportWallet} />
                </Stack.Group>
                <Stack.Group screenOptions={{ headerShown: false }}>
                    <Stack.Screen name={keys.Home} component={screens.Home} />
                    <Stack.Screen name={keys.History} component={screens.History} />
                </Stack.Group>
                <Stack.Group>
                    <Stack.Screen name={keys.AccountList} component={screens.AccountList} />
                    <Stack.Screen name={keys.AddSeedAccount} component={screens.AddSeedAccount} />
                    <Stack.Screen name={keys.Settings} component={screens.Settings} />
                    <Stack.Screen name={keys.SettingsNetwork} component={screens.SettingsNetwork} />
                </Stack.Group>
                <Stack.Group screenOptions={{ headerShown: false }}>
                    <Stack.Screen name={keys.Passcode} component={screens.Passcode} />
                </Stack.Group>
            </>
        </Stack.Navigator>)}
    </NavigationContainer>
);

export class Router {
    static goBack() {
        navigationRef.goBack();
    }
    static goToWelcome() {
        navigationRef.reset({
            index: 0,
            routes: [{ name: keys.Welcome }],
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
            routes: [{ name: keys.Home }],
        });
    }
    static goToHistory() {
        navigationRef.reset({
            index: 0,
            routes: [{ name: keys.History }],
        });
    }
    static goToScan() {
        navigationRef.reset({
            index: 0,
            routes: [{ name: keys.Home }],
        });
    }
    static goToAssets() {
        navigationRef.reset({
            index: 0,
            routes: [{ name: keys.Home }],
        });
    }
    static goToActions() {
        navigationRef.reset({
            index: 0,
            routes: [{ name: keys.Home }],
        });
    }
    static goToAccountList() {
        navigationRef.navigate(keys.AccountList);
    }
    static goToAddSeedAccount() {
        navigationRef.navigate(keys.AddSeedAccount);
    }
    static goToSettings() {
        navigationRef.navigate(keys.Settings);
    }
    static goToSettingsNetwork() {
        navigationRef.navigate(keys.SettingsNetwork);
    }
    static goToPasscode(params) {
        navigationRef.navigate(keys.Passcode, params);
    }
}

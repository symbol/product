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
    animation: 'fade',
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
    Assets: 'Assets',
    AccountDetails: 'AccountDetails',
    AccountList: 'AccountList',
    AddExternalAccount: 'AddExternalAccount',
    AddSeedAccount: 'AddSeedAccount',
    AddressBookAddContact: 'AddressBookAddContact',
    AddressBookContact: 'AddressBookContact',
    AddressBookList: 'AddressBookList',
    Send: 'Send',
    Settings: 'Settings',
    SettingsAbout: 'SettingsAbout',
    SettingsNetwork: 'SettingsNetwork',
    SettingsSecurity: 'SettingsSecurity',
    TransactionDetails: 'TransactionDetails',
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
                    <Stack.Screen name={keys.Assets} component={screens.Assets} />
                </Stack.Group>
                <Stack.Group>
                    <Stack.Screen name={keys.AccountDetails} component={screens.AccountDetails} />
                    <Stack.Screen name={keys.AccountList} component={screens.AccountList} />
                    <Stack.Screen name={keys.AddExternalAccount} component={screens.AddExternalAccount} />
                    <Stack.Screen name={keys.AddSeedAccount} component={screens.AddSeedAccount} />
                    <Stack.Screen name={keys.AddressBookAddContact} component={screens.AddressBookAddContact} />
                    <Stack.Screen name={keys.AddressBookContact} component={screens.AddressBookContact} />
                    <Stack.Screen name={keys.AddressBookList} component={screens.AddressBookList} />
                    <Stack.Screen name={keys.Send} component={screens.Send} />
                    <Stack.Screen name={keys.Settings} component={screens.Settings} />
                    <Stack.Screen name={keys.SettingsAbout} component={screens.SettingsAbout} />
                    <Stack.Screen name={keys.SettingsNetwork} component={screens.SettingsNetwork} />
                    <Stack.Screen name={keys.SettingsSecurity} component={screens.SettingsSecurity} />
                    <Stack.Screen name={keys.TransactionDetails} component={screens.TransactionDetails} />
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
            routes: [{ name: keys.Assets }],
        });
    }
    static goToActions() {
        navigationRef.reset({
            index: 0,
            routes: [{ name: keys.Home }],
        });
    }
    static goToAccountDetails(params) {
        navigationRef.navigate(keys.AccountDetails, params);
    }
    static goToAccountList(params) {
        navigationRef.navigate(keys.AccountList, params);
    }
    static goToAddExternalAccount(params) {
        navigationRef.navigate(keys.AddExternalAccount, params);
    }
    static goToAddSeedAccount(params) {
        navigationRef.navigate(keys.AddSeedAccount, params);
    }
    static goToAddressBookAddContact(params) {
        navigationRef.navigate(keys.AddressBookAddContact, params);
    }
    static goToAddressBookContact(params) {
        navigationRef.navigate(keys.AddressBookContact, params);
    }
    static goToAddressBookList(params) {
        navigationRef.navigate(keys.AddressBookList, params);
    }
    static goToSend(params) {
        navigationRef.navigate(keys.Send, params);
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
    static goToTransactionDetails(params) {
        navigationRef.navigate(keys.TransactionDetails, params);
    }
    static goToPasscode(params) {
        navigationRef.navigate(keys.Passcode, params);
    }
}

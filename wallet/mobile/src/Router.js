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

export const navigationRef = createNavigationContainerRef()

export const RouterView = ({ isActive }) => (
    <NavigationContainer theme={theme} ref={navigationRef}>
        {isActive && (<Stack.Navigator screenOptions={screenOptions}>
            <>
                <Stack.Group screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="Welcome" component={screens.Welcome} />
                    <Stack.Screen name="CreateWallet" component={screens.CreateWallet} />
                    <Stack.Screen name="ImportWallet" component={screens.ImportWallet} />
                </Stack.Group>
                <Stack.Group screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="Home" component={screens.Home} />
                </Stack.Group>
                <Stack.Group>
                <Stack.Screen name="AccountList" component={screens.AccountList} />
                    <Stack.Screen name="Settings" component={screens.Settings} />
                    <Stack.Screen name="Network" component={screens.SettingsNetwork} />
                </Stack.Group>
                <Stack.Group screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="Passcode" component={screens.Passcode} />
                </Stack.Group>
            </>
        </Stack.Navigator>)}
    </NavigationContainer>
);

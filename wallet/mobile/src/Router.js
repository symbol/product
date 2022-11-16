import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as screens from 'src/screens';

const Stack = createNativeStackNavigator();
const theme = {
    ...DefaultTheme,
    colors: {
        ...DefaultTheme.colors,
        background: 'transparent',
    },
};

export const RouterView = () => (
    <NavigationContainer theme={theme}>
        <Stack.Navigator initialRouteName="Home">
            <Stack.Screen name="Home" component={screens.CreateWallet} />
            <Stack.Screen name="Transfer" component={screens.Home} />
        </Stack.Navigator>
    </NavigationContainer>
);

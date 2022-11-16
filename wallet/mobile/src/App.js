
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView, StatusBar } from 'react-native';
import { Provider } from 'react-redux'
import store from 'src/store';
import { RouterView } from './Router';
import { colors } from './styles';

const fillHeight = {flex: 1};
const appBackgroundColor = { backgroundColor: colors.bgGray };

const App = () => {
    return (
        <GestureHandlerRootView style={[fillHeight, appBackgroundColor]}>
            <SafeAreaView style={fillHeight} >
                <StatusBar />
                <Provider store={store}>
                    <RouterView />
                </Provider>
            </SafeAreaView >
        </GestureHandlerRootView>
    );
};

export default App;


import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView, StatusBar } from 'react-native';
import { RouterView } from './Router';
import { colors } from './styles';

const fillHeight = {flex: 1};
const appBackgroundColor = { backgroundColor: colors.bgGray };

const App = () => {
    return (
        <GestureHandlerRootView style={[fillHeight, appBackgroundColor]}>
            <SafeAreaView style={fillHeight} >
                <StatusBar />
                <RouterView />
            </SafeAreaView >
        </GestureHandlerRootView>
    );
};

export default App;

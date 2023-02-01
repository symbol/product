
import React, { useEffect, useState } from 'react';
import { AppState, BackHandler, DeviceEventEmitter, SafeAreaView, StatusBar } from 'react-native';
import { Provider } from 'react-redux'
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { hasUserSetPinCode } from '@haskkor/react-native-pincode';
import SplashScreen from 'react-native-splash-screen'
import FlashMessage from 'react-native-flash-message';
import { ConnectionStatus } from './components';
import { Passcode } from './screens';
import { SecureStorage } from './storage';
import store from 'src/store';
import { initLocalization } from './localization';
import { RouterView, Router } from './Router';
import { colors } from './styles';

const fillHeight = {flex: 1};
const appBackgroundColor = { backgroundColor: colors.bgGray };

const App = () => {
    const [isPasscodeEnabled, setIsPasscodeEnabled] = useState(false);
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [hasBeenUnlocked, setHasBeenUnlocked] = useState(false);
    const [isWalletExist, setIsWalletExist] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const isPasscodeShown = isPasscodeEnabled && !isUnlocked;
    const isMainContainerShown = !isLoading && !isPasscodeShown;
    const passcodeParams = {
        type: 'enter',
        successEvent: 'event.passcode.root.success',
        cancelEvent: 'event.passcode.root.cancel',
    };

    const unlock = () => {
        setIsUnlocked(true);
        setHasBeenUnlocked(true);
    }

    const handleStateChange = () => {
        // setIsUnlocked(false);
    };

    useEffect(() => {
        const load = async () => {
            const isPasscodeEnabled = await hasUserSetPinCode();
            const isWalletExist = !!(await SecureStorage.getMnemonic());
            await initLocalization();
            await store.dispatchAction({type: 'wallet/loadAll'});
            store.dispatchAction({type: 'network/connect'});

            setIsPasscodeEnabled(isPasscodeEnabled);
            setIsWalletExist(isWalletExist);
            setIsLoading(false);
            SplashScreen.hide();
        };

        load();

        AppState.addEventListener('change', handleStateChange);
        DeviceEventEmitter.addListener(passcodeParams.successEvent, unlock);
        DeviceEventEmitter.addListener(passcodeParams.cancel, BackHandler.exitApp);
    }, []);

    useEffect(() => {
        if (!isMainContainerShown || hasBeenUnlocked) {
            return;
        }

        if (isWalletExist) {
            Router.goToHome();
        }
    }, [isMainContainerShown]);

    return (<>
        <GestureHandlerRootView style={[fillHeight, appBackgroundColor]}>
            <SafeAreaView style={fillHeight} >
                <StatusBar backgroundColor={colors.bgStatusbar} />
                <Provider store={store}>
                    <ConnectionStatus />
                    <FlashMessage animationDuration={200} floating={true} />
                    <RouterView isActive={isMainContainerShown} />
                    {isPasscodeShown && (
                        <Passcode keepListener route={{params: passcodeParams}} />
                    )}
                </Provider>
            </SafeAreaView >
        </GestureHandlerRootView>
    </>);
};

export default App;

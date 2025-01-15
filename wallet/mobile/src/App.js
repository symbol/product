import React, { useEffect, useState } from 'react';
import { BackHandler, DeviceEventEmitter, SafeAreaView, StatusBar, View } from 'react-native';
import { Provider } from 'react-redux';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { hasUserSetPinCode } from '@haskkor/react-native-pincode';
import SplashScreen from 'react-native-splash-screen';
import FlashMessage from 'react-native-flash-message';
import { ConnectionStatus } from './components';
import { Passcode } from './screens';
import { SecureStorage, StorageMigration } from './storage';
import store from 'src/store';
import { initLocalization } from './localization';
import { RouterView } from './Router';
import { colors, fonts, layout } from './styles';
import { ControllerEventName } from 'src/constants';

const unsafeAreaStyle = { ...layout.fill, backgroundColor: colors.bgStatusbar };
const safeAreaStyle = { ...layout.fill, backgroundColor: colors.bgGray };
const flashMessageStyle = { backgroundColor: colors.bgForm, borderBottomColor: colors.primary, borderBottomWidth: 2 };
const flashMessageTextStyle = { ...fonts.notification, color: colors.primary };

const App = () => {
    const [isPasscodeEnabled, setIsPasscodeEnabled] = useState(false);
    const [isUnlocked, setIsUnlocked] = useState(false);
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
    };
    const load = async () => {
        await StorageMigration.migrate();
        await initLocalization();
        const isPasscodeEnabled = await hasUserSetPinCode();
        const isWalletExist = !!(await SecureStorage.getMnemonic());
        await store.dispatchAction({ type: 'wallet/loadAll' });
        store.dispatchAction({ type: 'network/connect' });

        setIsPasscodeEnabled(isPasscodeEnabled);
        setIsWalletExist(isWalletExist);
        setIsLoading(false);
        SplashScreen.hide();
    };

    useEffect(() => {
        // Initialize wallet and load data from cache
        load();

        // Listen for an event from the Passscode screen
        DeviceEventEmitter.addListener(passcodeParams.successEvent, unlock);
        DeviceEventEmitter.addListener(passcodeParams.cancel, BackHandler.exitApp);
        DeviceEventEmitter.addListener(ControllerEventName.LOGOUT, load);
        DeviceEventEmitter.addListener(ControllerEventName.LOGIN, load);
    }, []);

    return (
        <>
            <GestureHandlerRootView style={layout.fill}>
                <SafeAreaView style={unsafeAreaStyle}>
                    <View style={safeAreaStyle}>
                        <StatusBar backgroundColor={colors.bgStatusbar} barStyle="light-content" />
                        <Provider store={store}>
                            {isMainContainerShown && <ConnectionStatus />}
                            <FlashMessage
                                statusBarHeight={8}
                                animationDuration={200}
                                titleStyle={flashMessageTextStyle}
                                style={flashMessageStyle}
                            />
                            <RouterView isActive={isMainContainerShown} isWalletExist={isWalletExist} />
                            {isPasscodeShown && (
                                <Passcode hideCancelButton keepListener keepNavigation route={{ params: passcodeParams }} />
                            )}
                        </Provider>
                    </View>
                </SafeAreaView>
            </GestureHandlerRootView>
        </>
    );
};

export default App;

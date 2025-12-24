import { Router, RouterView } from '@/app/Router';
import { Button, ConnectionStatus } from '@/app/components';
import { useWalletController } from '@/app/hooks';
import { bridges, controllers } from '@/app/lib/controller';
import { EthModule } from '@/app/lib/controller/EthModule';
import { ethereumWalletController } from '@/app/lib/controller/MobileWalletController';
import { createFee } from '@/app/lib/controller/common-ethereum/src';
import { $t, initLocalization } from '@/app/localization';
import { Passcode } from '@/app/screens';
import { colors, fonts, layout } from '@/app/styles';
import { handleError, showMessage } from '@/app/utils';
import { deleteUserPinCode, hasUserSetPinCode } from '@haskkor/react-native-pincode';
import React, { useEffect, useState } from 'react';
import { BackHandler, DeviceEventEmitter, SafeAreaView, StatusBar, View } from 'react-native';
import FlashMessage from 'react-native-flash-message';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import SplashScreen from 'react-native-splash-screen';
import { constants } from 'wallet-common-core';

const unsafeAreaStyle = { ...layout.fill, backgroundColor: colors.bgStatusbar };
const safeAreaStyle = { ...layout.fill, backgroundColor: colors.bgGray };
const flashMessageStyle = { backgroundColor: colors.bgForm, borderBottomColor: colors.primary, borderBottomWidth: 2 };
const flashMessageTextStyle = { ...fonts.notification, color: colors.primary };

const App = () => {
	const WalletController = useWalletController();
	const [isPasscodeEnabled, setIsPasscodeEnabled] = useState(false);
	const [isUnlocked, setIsUnlocked] = useState(false);
	const isWalletStored = WalletController.hasAccounts;
	const [isWalletLoaded, setIsWalletLoaded] = useState(false);
	const isPasscodeShown = isPasscodeEnabled && !isUnlocked;
	const isMainContainerShown = isWalletLoaded && !isPasscodeShown;
	const passcodeParams = {
		type: 'enter',
		successEvent: 'event.passcode.root.success',
		cancelEvent: 'event.passcode.root.cancel'
	};

	const unlock = () => {
		setIsUnlocked(true);
	};

	// Initialize the app. Migrate storage, initialize localization, passcode and load the wallet
	const init = async () => {
		setIsWalletLoaded(false);

		const isPasscodeEnabled = await hasUserSetPinCode();
		setIsPasscodeEnabled(isPasscodeEnabled);

		await load();
		SplashScreen.hide();
	};

	// Load the wallet and data from cache. Connect to network and fetch data
	const load = async () => {
		try {
		await WalletController.loadCache();
		await Promise.all(controllers.additional.map(controller => controller.loadCache()));
		await initLocalization();
		setIsWalletLoaded(true);

		await WalletController.connectToNetwork();
		await Promise.all(controllers.additional.map(controller => controller.connectToNetwork()));
		WalletController.modules.market.fetchData();
		} catch (error) {
			console.error(error);
		}
	};
	const loadBridge = async () => {
		await Promise.all(controllers.additional
			.map(controller => controller.selectNetwork(WalletController.networkIdentifier))
		);
	};

	const handleLogout = async () => {
		await deleteUserPinCode();
		handleLoginStateChange();
	};
	const handleLoginStateChange = () => {
		Router.goToHome();
		load();
	};
	const handleAccountChange = () => {
		WalletController.fetchAccountInfo();
	};
	const handleNetworkChange = () => {
		loadBridge();
	};
	const handleNewConfirmedTransaction = () => {
		showMessage({ message: $t('message_transactionConfirmed'), type: 'info' });
		WalletController.fetchAccountTransactions();
		WalletController.fetchAccountInfo();
	};
	const handleTransactionError = (error) => {
		handleError(error);
	}

	useEffect(() => {
		// Initialize wallet and load data from cache
		init();

		// Listen for an event from the Passscode screen
		DeviceEventEmitter.addListener(passcodeParams.successEvent, unlock);
		DeviceEventEmitter.addListener(passcodeParams.cancel, BackHandler.exitApp);
		WalletController.on(constants.ControllerEventName.WALLET_CREATE, handleLoginStateChange);
		WalletController.on(constants.ControllerEventName.WALLET_CLEAR, handleLogout);
		WalletController.on(constants.ControllerEventName.ACCOUNT_CHANGE, handleAccountChange);
		WalletController.on(constants.ControllerEventName.NETWORK_CHANGE, handleNetworkChange);
		WalletController.on(constants.ControllerEventName.NEW_TRANSACTION_CONFIRMED, handleNewConfirmedTransaction);
		WalletController.on(constants.ControllerEventName.TRANSACTION_ERROR, handleTransactionError);
		
		
		controllers.additional[0].on(constants.ControllerEventName.NEW_TRANSACTION_CONFIRMED, handleNewConfirmedTransaction);

		return () => {
			WalletController.removeListener(constants.ControllerEventName.WALLET_CREATE, handleLoginStateChange);
			WalletController.removeListener(constants.ControllerEventName.WALLET_CLEAR, handleLogout);
			WalletController.removeListener(constants.ControllerEventName.ACCOUNT_CHANGE, handleAccountChange);
			WalletController.removeListener(constants.ControllerEventName.NETWORK_CHANGE, handleNetworkChange);
			WalletController.removeListener(constants.ControllerEventName.NEW_TRANSACTION_CONFIRMED, handleNewConfirmedTransaction);
			WalletController.removeListener(constants.ControllerEventName.TRANSACTION_ERROR, handleTransactionError);
			
			controllers.additional[0].removeListener(constants.ControllerEventName.NEW_TRANSACTION_CONFIRMED, handleNewConfirmedTransaction);
		};
	}, []);

	return (
		<>
			<GestureHandlerRootView style={layout.fill}>
				<SafeAreaView style={unsafeAreaStyle}>
					<View style={safeAreaStyle}>
						<StatusBar backgroundColor={colors.bgStatusbar} barStyle="light-content" />
						{isWalletStored && <ConnectionStatus />}
						

	




						<RouterView isActive={isMainContainerShown} isLoggedIn={isWalletStored} />
						{isPasscodeShown && <Passcode hideCancelButton keepListener keepNavigation route={{ params: passcodeParams }} />}
						<FlashMessage
							statusBarHeight={8}
							animationDuration={200}
							titleStyle={flashMessageTextStyle}
							style={flashMessageStyle}
							position="top"
						/>
					</View>
				</SafeAreaView>
			</GestureHandlerRootView>
		</>
	);
};

export default App;

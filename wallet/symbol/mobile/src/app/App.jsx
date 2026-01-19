import { RootLayout } from './layout/RootLayout';
import { Router, RouterView } from '@/app/Router';
import { PasscodeView } from '@/app/components';
import { useWalletController } from '@/app/hooks';
import { walletControllers } from '@/app/lib/controller';
import { passcodeManager } from '@/app/lib/passcode';
import { $t, initLocalization } from '@/app/localization';
import { handleError, showMessage } from '@/app/utils';
import React, { useEffect, useState } from 'react';
import SplashScreen from 'react-native-splash-screen';
import { constants } from 'wallet-common-core';
const { ControllerEventName } = constants;

export const App = () => {
	const mainWalletController = useWalletController();
	const [isWalletLoaded, setIsWalletLoaded] = useState(false);
	const [isUnlocked, setIsUnlocked] = useState(false);
	const isWalletCreated = mainWalletController.hasAccounts;
	const isPasscodeShown = !isUnlocked && isWalletCreated;

	const isRouterActive = isWalletLoaded && !isPasscodeShown;
	const routerFlow = isWalletCreated ? 'main' : 'onboarding';

	const unlock = () => {
		setIsUnlocked(true);
	};

	// Initialize the app.
	const init = async () => {
		setIsWalletLoaded(false);

		await load();
		SplashScreen.hide();
	};

	const loadCache = async () => {
		return Promise.all([
			mainWalletController.loadCache(),
			...walletControllers.additional.map(controller => controller.loadCache())
		]);
	};
	const connectToNetwork = async () => {
		return Promise.all([
			mainWalletController.connectToNetwork(),
			...walletControllers.additional.map(controller => controller.connectToNetwork())
		]);
	};

	// Load the wallet and data from cache. Connect to network and fetch data
	const load = async () => {
		try {
			await loadCache();
			await initLocalization();
			setIsWalletLoaded(true);

			await connectToNetwork();
			mainWalletController.modules.market.fetchData();
		} catch (error) {
			handleError(error);
		}
	};
	const handleLogout = async () => {
		await passcodeManager.clear();
		handleLoginStateChange();
	};
	const handleLoginStateChange = () => {
		Router.goToHome();
		load();
	};
	const handleAccountChange = () => {
		mainWalletController.fetchAccountInfo();
	};
	const handleNetworkChange = () => {
		walletControllers.additional.forEach(controller =>
			controller.selectNetwork(mainWalletController.networkIdentifier));
	};
	const handleNewConfirmedTransaction = () => {
		showMessage({ message: $t('message_transactionConfirmed'), type: 'info' });
		mainWalletController.fetchAccountTransactions();
		mainWalletController.fetchAccountInfo();
	};
	const handleTransactionError = error => {
		handleError(error);
	};

	useEffect(() => {
		// Initialize wallet and load data from cache
		init();

		// Listen main wallet controller
		mainWalletController.on(ControllerEventName.WALLET_CREATE, handleLoginStateChange);
		mainWalletController.on(ControllerEventName.WALLET_CLEAR, handleLogout);
		mainWalletController.on(ControllerEventName.ACCOUNT_CHANGE, handleAccountChange);
		mainWalletController.on(ControllerEventName.NETWORK_CHANGE, handleNetworkChange);
		mainWalletController.on(ControllerEventName.NEW_TRANSACTION_CONFIRMED, handleNewConfirmedTransaction);
		mainWalletController.on(ControllerEventName.TRANSACTION_ERROR, handleTransactionError);

		// Listen additional wallet controllers
		walletControllers.additional.forEach(walletController =>
			walletController.on(ControllerEventName.NEW_TRANSACTION_CONFIRMED, handleNewConfirmedTransaction));
		walletControllers.additional.forEach(walletController =>
			walletController.on(
				ControllerEventName.TRANSACTION_ERROR,
				handleTransactionError
			));

		return () => {
			// Cleanup main wallet controller listeners
			mainWalletController.removeListener(ControllerEventName.WALLET_CREATE, handleLoginStateChange);
			mainWalletController.removeListener(ControllerEventName.WALLET_CLEAR, handleLogout);
			mainWalletController.removeListener(ControllerEventName.ACCOUNT_CHANGE, handleAccountChange);
			mainWalletController.removeListener(ControllerEventName.NETWORK_CHANGE, handleNetworkChange);
			mainWalletController.removeListener(ControllerEventName.NEW_TRANSACTION_CONFIRMED, handleNewConfirmedTransaction);
			mainWalletController.removeListener(ControllerEventName.TRANSACTION_ERROR, handleTransactionError);

			// Cleanup additional wallet controllers listeners
			walletControllers.additional.forEach(walletController =>
				walletController.removeListener(ControllerEventName.NEW_TRANSACTION_CONFIRMED, handleNewConfirmedTransaction));
			walletControllers.additional.forEach(walletController =>
				walletController.removeListener(ControllerEventName.TRANSACTION_ERROR, handleTransactionError));
		};
	}, []);

	return (
		<RootLayout
			isNetworkStatusShown={isWalletCreated}
			networkStatus={mainWalletController.networkStatus}
		>
			<RouterView isActive={isRouterActive} flow={routerFlow} />
			<PasscodeView isVisible={isPasscodeShown} onSuccess={unlock} />
		</RootLayout>
	);
};

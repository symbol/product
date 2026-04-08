import { useCurrentRoute, useSyncNetworkType, useWalletWorkflow } from './hooks';
import { RootLayout } from './layout/RootLayout';
import { PasscodeView } from '@/app/components';
import { useTransactionListener, useWalletController, useWalletListener } from '@/app/hooks';
import { walletControllers } from '@/app/lib/controller';
import { passcodeManager } from '@/app/lib/passcode';
import { $t, initLocalization } from '@/app/localization';
import { RouterView } from '@/app/router/RouterView';
import { showError, showMessage } from '@/app/utils';
import React, { useEffect, useState } from 'react';
import SplashScreen from 'react-native-splash-screen';

export const App = () => {
	const mainWalletController = useWalletController();
	const [isWalletLoaded, setIsWalletLoaded] = useState(false);
	const [isUnlocked, setIsUnlocked] = useState(false);
	const [isWalletCreated, setIsWalletCreated] = useState(mainWalletController.hasAccounts);
	const isPasscodeShown = !isUnlocked && isWalletCreated;

	const isRouterActive = isWalletLoaded && !isPasscodeShown;
	const routerFlow = isWalletCreated ? 'main' : 'onboarding';

	const unlock = () => {
		setIsUnlocked(true);
	};

	// Initialize the app.
	const init = async () => {
		setIsWalletLoaded(false);

		await initialLoad();
		SplashScreen.hide();
		await initialConnection();
	};

	const { loadCache, connectToNetwork } = useWalletWorkflow({
		walletControllers: [mainWalletController, ...walletControllers.additional]
	});

	// Load the wallet and data from cache. Connect to network and fetch data
	const initialLoad = async () => {
		try {
			await loadCache();
			await initLocalization();
			setIsWalletLoaded(true);
			setIsWalletCreated(mainWalletController.hasAccounts);
		} catch (error) {
			showError(error);
		}
	};
	const initialConnection = async () => {
		try {
			await connectToNetwork();
			mainWalletController.modules.market.fetchData();
		} catch (error) {
			showError(error);
		}
	};
	const handleLogout = async () => {
		await passcodeManager.clear();
		setIsWalletCreated(false);
		await handleLoginStateChange();
	};
	const handleLoginStateChange = async () => {
		Router.goToHome();
		await initialLoad();
		await initialConnection();
	};
	const handleAccountChange = () => {
		if (mainWalletController.isWalletReady)
			mainWalletController.fetchAccountInfo();
	};
	const handleNetworkConnected = () => {
		if (mainWalletController.isWalletReady)
			mainWalletController.fetchAccountInfo();
	};

	// Transaction listeners
	const showTransactionMessage = () => {
		showMessage({ message: $t('message_transactionConfirmed'), type: 'info' });
	};
	const showTransactionMessageAndRefresh = () => {
		showTransactionMessage();
		mainWalletController.fetchAccountTransactions();
		mainWalletController.fetchAccountInfo();
	};
	useTransactionListener({
		walletControllers: [mainWalletController],
		onTransactionConfirmed: showTransactionMessageAndRefresh,
		onTransactionError: showError
	});
	useTransactionListener({
		walletControllers: walletControllers.additional,
		onTransactionConfirmed: showTransactionMessage,
		onTransactionError: showError
	});

	// Sync selected network across additional wallet controllers
	// When main controller network changes 'mainnet' <=> 'testnet', update additional controllers to match
	useSyncNetworkType({
		mainWalletController,
		additionalWalletControllers: walletControllers.additional
	}); 

	// Main wallet listeners - login, logout, account change
	useWalletListener({
		walletControllers: [mainWalletController],
		onWalletCreate: handleLoginStateChange,
		onWalletClear: handleLogout,
		onAccountChange: handleAccountChange,
		onNetworkConnected: handleNetworkConnected
	});

	const currentRouteName = useCurrentRoute();

	// Initialize app on mount
	useEffect(() => {
		init();
	}, []);

	return (
		<RootLayout
			isNetworkStatusShown={isWalletCreated}
			networkStatus={mainWalletController.networkStatus}
			currentRouteName={currentRouteName}
		>
			<RouterView isActive={isRouterActive} flow={routerFlow} />
			<PasscodeView isVisible={isPasscodeShown} onSuccess={unlock} />
		</RootLayout>
	);
};

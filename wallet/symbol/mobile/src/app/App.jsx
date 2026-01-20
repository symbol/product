import { useSyncNetworkType, useTransactionListener, useWalletListener, useWalletWorkflow } from './hooks';
import { RootLayout } from './layout/RootLayout';
import { Router, RouterView } from '@/app/Router';
import { PasscodeView } from '@/app/components';
import { useWalletController } from '@/app/hooks';
import { walletControllers } from '@/app/lib/controller';
import { passcodeManager } from '@/app/lib/passcode';
import { $t, initLocalization } from '@/app/localization';
import { showError, showMessage } from '@/app/utils';
import React, { useEffect, useState } from 'react';
import SplashScreen from 'react-native-splash-screen';

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

	const { loadCache, connectToNetwork } = useWalletWorkflow({
		walletControllers: [mainWalletController, ...walletControllers.additional]
	});

	// Load the wallet and data from cache. Connect to network and fetch data
	const load = async () => {
		try {
			await loadCache();
			await initLocalization();
			setIsWalletLoaded(true);

			await connectToNetwork();
			mainWalletController.modules.market.fetchData();
		} catch (error) {
			showError(error);
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
		onAccountChange: handleAccountChange
	});

	useEffect(() => {
		init();
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

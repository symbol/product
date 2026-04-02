import { useReactiveWalletControllers } from '@/app/hooks';
import { walletControllers as controllers } from '@/app/lib/controller';
import { useEffect } from 'react';
import { ControllerEventName } from 'wallet-common-core/src/constants';

/** @typedef {import('@/app/types/Wallet').WalletController} WalletController */
/** @typedef {import('@/app/screens/bridge/types/Bridge').BridgeAccountDisplayData} BridgeAccountDisplayData */

/**
 * Fetches account info if the wallet controller is ready.
 * @param {WalletController} walletController - The wallet controller.
 */
const fetchAccountInfoIfReady = walletController => {
	if (walletController.currentAccount && walletController.isWalletReady)
		walletController.fetchAccountInfo();
};

/**
 * Creates a bridge account object from a wallet controller.
 * @param {WalletController} walletController - The wallet controller.
 * @returns {BridgeAccountDisplayData} The bridge account object.
 */
const createBridgeAccountObject = walletController => ({
	chainName: walletController.chainName,
	ticker: walletController.ticker,
	isActive: !!walletController.currentAccount,
	account: walletController.currentAccount,
	balance: walletController.currentAccountInfo?.balance || 0,
	tokens: walletController.currentAccountInfo?.tokens || [],
	isAccountInfoLoaded: walletController.currentAccountInfo?.fetchedAt ? true : false
});

/**
 * Return type for useBridgeAccounts hook.
 * @typedef {Object} UseBridgeAccountsReturnType
 * @property {BridgeAccountDisplayData[]} accounts - Array of bridge account objects from additional wallet controllers.
 * @property {() => void} refresh - Refreshes all account balances.
 */

/**
 * React hook for managing bridge account data from additional wallet controllers.
 * Provides account information and automatic refresh on account/transaction changes.
 * @returns {UseBridgeAccountsReturnType}
 */
export const useBridgeAccounts = () => {
	const walletControllers = useReactiveWalletControllers(controllers.additional);

	// Accounts data from additional wallet controllers
	const accounts = walletControllers.map(createBridgeAccountObject);

	// Refreshes all accounts by fetching the latest account info using each wallet controller
	const refresh = () => {
		walletControllers.forEach(fetchAccountInfoIfReady);
	};

	// Subscribes to account changes and new transaction confirmations to keep account info up to date
	const subscribe = () => {
		const unsubscribes = walletControllers.map(controller => {
			const fetchData = () => fetchAccountInfoIfReady(controller);

			controller.on(ControllerEventName.ACCOUNT_CHANGE, fetchData);
			controller.on(ControllerEventName.NEW_TRANSACTION_CONFIRMED, fetchData);
			controller.on(ControllerEventName.NETWORK_CONNECTED, fetchData);

			return () => {
				controller.removeListener(ControllerEventName.ACCOUNT_CHANGE, fetchData);
				controller.removeListener(ControllerEventName.NEW_TRANSACTION_CONFIRMED, fetchData);
				controller.removeListener(ControllerEventName.NETWORK_CONNECTED, fetchData);
			};
		});

		return () => unsubscribes.forEach(unsubscribe => unsubscribe());
	};

	useEffect(() => {
		refresh();
		return subscribe();
	}, []);

	return { accounts, refresh };
};

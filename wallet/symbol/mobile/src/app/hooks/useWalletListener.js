import { useEffect } from 'react';
import { constants } from 'wallet-common-core';
const { ControllerEventName } = constants;

/** @typedef {import('wallet-common-core').WalletController} WalletController */

/**
 * Hook that monitors wallet lifecycle and account change events across multiple wallet controllers.
 * This enables components to respond to wallet creation, clearing, and account switches by
 * providing callback functions that are triggered when these events occur.
 *
 * @param {Object} options - Hook options.
 * @param {WalletController[]} options.walletControllers - Array of wallet controller instances to listen to.
 * @param {Function} options.onWalletCreate - Callback invoked when a wallet is created.
 *   Receives the newly created wallet object as its first parameter.
 * @param {Function} options.onWalletClear - Callback invoked when a wallet is cleared.
 *   Receives the cleared wallet identifier as its first parameter.
 * @param {Function} options.onAccountChange - Callback invoked when the active account changes.
 *   Receives the new account details as its first parameter.
 * @returns {void}
 */
export const useWalletListener = ({ 
	walletControllers, 
	onWalletCreate,
	onWalletClear, 
	onAccountChange
}) => {
	useEffect(() => {
		walletControllers.forEach(walletController =>
			walletController.on(ControllerEventName.WALLET_CREATE, onWalletCreate));
		walletControllers.forEach(walletController =>
			walletController.on(ControllerEventName.WALLET_CLEAR, onWalletClear));
		walletControllers.forEach(walletController =>
			walletController.on(ControllerEventName.ACCOUNT_CHANGE, onAccountChange));

		return () => {
			walletControllers.forEach(walletController =>
				walletController.removeListener(ControllerEventName.WALLET_CREATE, onWalletCreate));
			walletControllers.forEach(walletController =>
				walletController.removeListener(ControllerEventName.WALLET_CLEAR, onWalletClear));
			walletControllers.forEach(walletController =>
				walletController.removeListener(ControllerEventName.ACCOUNT_CHANGE, onAccountChange));
		};
	}, []);
};

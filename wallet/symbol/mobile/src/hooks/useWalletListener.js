import { useEffect } from 'react';
import { constants } from 'wallet-common-core';
const { ControllerEventName } = constants;

/** @typedef {import('wallet-common-core').WalletController} WalletController */

/**
 * React hook that monitors wallet lifecycle and account change events across multiple wallet controllers.
 * This enables components to respond to wallet creation, clearing, and account switches by
 * providing callback functions that are triggered when these events occur.
 * @param {object} options - Hook options.
 * @param {WalletController[]} options.walletControllers - Array of wallet controller instances to listen to.
 * @param {function(object): void} [options.onWalletCreate] - Callback invoked when a wallet is created.
 *   Receives the newly created wallet object as its first parameter.
 * @param {function(object): void} [options.onWalletClear] - Callback invoked when a wallet is cleared.
 *   Receives the cleared wallet identifier as its first parameter.
 * @param {function(object): void} [options.onAccountChange] - Callback invoked when the active account changes.
 *   Receives the new account details as its first parameter.
 * @param {function(object): void} [options.onNetworkConnected] - Callback invoked when the wallet connects to a network.
 *   Receives the network details as its first parameter.
 * @param {Array} [options.deps=[]] - Dependency array for the useEffect hook to control when listeners are re-registered.
 * @returns {void}
 */
export const useWalletListener = ({
	walletControllers,
	onWalletCreate,
	onWalletClear,
	onAccountChange,
	onNetworkConnected,
	deps = []
}) => {
	useEffect(() => {
		if (onWalletCreate) {
			walletControllers.forEach(walletController =>
				walletController.on(ControllerEventName.WALLET_CREATE, onWalletCreate));
		}

		if (onWalletClear) {
			walletControllers.forEach(walletController =>
				walletController.on(ControllerEventName.WALLET_CLEAR, onWalletClear));
		}

		if (onAccountChange) {
			walletControllers.forEach(walletController =>
				walletController.on(ControllerEventName.ACCOUNT_CHANGE, onAccountChange));
		}

		if (onNetworkConnected) {
			walletControllers.forEach(walletController =>
				walletController.on(ControllerEventName.NETWORK_CONNECTED, onNetworkConnected));
		}

		return () => {
			if (onWalletCreate) {
				walletControllers.forEach(walletController =>
					walletController.removeListener(ControllerEventName.WALLET_CREATE, onWalletCreate));
			}

			if (onWalletClear) {
				walletControllers.forEach(walletController =>
					walletController.removeListener(ControllerEventName.WALLET_CLEAR, onWalletClear));
			}

			if (onAccountChange) {
				walletControllers.forEach(walletController =>
					walletController.removeListener(ControllerEventName.ACCOUNT_CHANGE, onAccountChange));
			}

			if (onNetworkConnected) {
				walletControllers.forEach(walletController =>
					walletController.removeListener(ControllerEventName.NETWORK_CONNECTED, onNetworkConnected));
			}
		};
	}, deps);
};

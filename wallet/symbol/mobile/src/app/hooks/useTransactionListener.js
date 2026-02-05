import { useEffect } from 'react';
import { constants } from 'wallet-common-core';
const { ControllerEventName } = constants;

/** @typedef {import('wallet-common-core').WalletController} WalletController */

/**
 * Hook that sets up listeners for transaction-related events on multiple wallet controllers.
 * This allows components to react to transaction confirmations and errors by providing
 * callback functions that will be invoked when these events occur.
 *
 * @param {Object} options - Hook options.
 * @param {WalletController[]} options.walletControllers - Array of wallet controller instances to listen to.
 * @param {Function} options.onTransactionConfirmed - Callback invoked when a transaction is successfully confirmed.
 *   Receives the confirmed transaction object as its first parameter.
 * @param {Function} options.onTransactionError - Callback invoked when a transaction encounters an error.
 *   Receives the error details as its first parameter.
 * @returns {void}
 */
export const useTransactionListener = ({ walletControllers, onTransactionConfirmed, onTransactionError }) => {
	useEffect(() => {
		walletControllers.forEach(walletController =>
			walletController.on(ControllerEventName.NEW_TRANSACTION_CONFIRMED, onTransactionConfirmed));
		walletControllers.forEach(walletController =>
			walletController.on(ControllerEventName.TRANSACTION_ERROR, onTransactionError));

		return () => {
			walletControllers.forEach(walletController =>
				walletController.removeListener(ControllerEventName.NEW_TRANSACTION_CONFIRMED, onTransactionConfirmed));
			walletControllers.forEach(walletController =>
				walletController.removeListener(ControllerEventName.TRANSACTION_ERROR, onTransactionError));
		};
	}, []);
};

import { useEffect } from 'react';
import { constants } from 'wallet-common-core';
const { ControllerEventName } = constants;

/** @typedef {import('wallet-common-core').WalletController} WalletController */

/**
 * React hook that sets up listeners for transaction-related events on multiple wallet controllers.
 * @param {object} options - Hook options.
 * @param {WalletController[]} options.walletControllers - Array of wallet controller instances to listen to.
 * @param {function(object): void} [options.onTransactionConfirmed] - Callback invoked when a transaction is successfully confirmed.
 * @param {function(object): void} [options.onTransactionUnconfirmed] - Callback invoked when a transaction is announced 
 * but not yet confirmed.
 * @param {function(object): void} [options.onTransactionPartial] - Callback invoked when a partial transaction is announced.
 * @param {function(Error): void} [options.onTransactionError] - Callback invoked when a transaction encounters an error.
 *   Receives the error details as its first parameter.
 * @param {Array} [options.deps=[]] - Dependency array for the useEffect hook to control when listeners are re-registered.
 * @returns {void}
 */
export const useTransactionListener = ({
	walletControllers,
	onTransactionConfirmed,
	onTransactionUnconfirmed,
	onTransactionPartial,
	onTransactionError,
	deps = []
}) => {
	useEffect(() => {
		if (onTransactionConfirmed) {
			walletControllers.forEach(walletController =>
				walletController.on(ControllerEventName.NEW_TRANSACTION_CONFIRMED, onTransactionConfirmed));
		}
		if (onTransactionUnconfirmed) {
			walletControllers.forEach(walletController =>
				walletController.on(ControllerEventName.NEW_TRANSACTION_UNCONFIRMED, onTransactionUnconfirmed));
		}
		if (onTransactionPartial) {
			walletControllers.forEach(walletController =>
				walletController.on(ControllerEventName.NEW_TRANSACTION_PARTIAL, onTransactionPartial));
		}
		if (onTransactionError) {
			walletControllers.forEach(walletController =>
				walletController.on(ControllerEventName.TRANSACTION_ERROR, onTransactionError));
		}

		return () => {
			if (onTransactionConfirmed) {
				walletControllers.forEach(walletController =>
					walletController.removeListener(ControllerEventName.NEW_TRANSACTION_CONFIRMED, onTransactionConfirmed));
			}
			if (onTransactionUnconfirmed) {
				walletControllers.forEach(walletController =>
					walletController.removeListener(ControllerEventName.NEW_TRANSACTION_UNCONFIRMED, onTransactionUnconfirmed));
			}
			if (onTransactionPartial) {
				walletControllers.forEach(walletController =>
					walletController.removeListener(ControllerEventName.NEW_TRANSACTION_PARTIAL, onTransactionPartial));
			}
			if (onTransactionError) {
				walletControllers.forEach(walletController =>
					walletController.removeListener(ControllerEventName.TRANSACTION_ERROR, onTransactionError));
			}
		};
	}, deps);
};

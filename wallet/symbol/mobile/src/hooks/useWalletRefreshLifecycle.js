import { useTransactionListener } from './useTransactionListener';
import { useWalletListener } from './useWalletListener';
import { DB_UPDATE_LATENCY_AFTER_ANNOUNCE } from '@/app/constants';
import { useCallback, useRef } from 'react';

/** @typedef {import('@/app/types/Wallet').WalletController} WalletController */

/**
 * React hook for managing wallet refresh lifecycle.
 * Listens to transaction and wallet events to auto-refresh data.
 * When the wallet account changes, it executes the optional onClear callback to reset relevant data,
 * then calls onRefresh to fetch new data for the new account.
 * @param {object} config - Configuration object.
 * @param {WalletController} config.walletController - Wallet controller instance.
 * @param {() => void} config.onRefresh - Callback to refresh data.
 * @param {() => void} [config.onClear] - Callback to clear data.
 * @param {boolean} [config.hasPartialListener=false] - Whether to listen for partial transactions.
 * @param {boolean} [config.hasErrorListener=false] - Whether to listen for error transactions.
 * @param {boolean} [config.hasUnconfirmedListener=false] - Whether to listen for unconfirmed transactions.
 * @returns {void}
 */
export const useWalletRefreshLifecycle = config => {
	const { 
		walletController, 
		onRefresh, 
		onClear, 
		hasPartialListener = false,
		hasErrorListener = false,
		hasUnconfirmedListener = false
	} = config;

	// Ref to track if refresh is scheduled (avoids multiple timeouts)
	const refreshTimeoutRef = useRef(null);

	const refreshAllWithDelay = useCallback(() => {
		// Clear any existing scheduled refresh
		if (refreshTimeoutRef.current)
			clearTimeout(refreshTimeoutRef.current);

		refreshTimeoutRef.current = setTimeout(() => {
			onRefresh();
			refreshTimeoutRef.current = null;
		}, DB_UPDATE_LATENCY_AFTER_ANNOUNCE);
	}, [onRefresh]);
	const clearAll = useCallback(() => {
		if (onClear) 
			onClear();
	}, [onClear]);

	// Event handlers
	const handleTransactionStatusChange = useCallback(() => {
		refreshAllWithDelay();
	}, [refreshAllWithDelay]);
	const handleNetworkConnected = useCallback(() => {
		onRefresh();
	}, [onRefresh]);
	const handleAccountChange = useCallback(() => {
		clearAll();

		if (walletController.isWalletReady)
			onRefresh();
	}, [clearAll, onRefresh, walletController.isWalletReady]);

	// Listen to transaction events
	useTransactionListener({
		walletControllers: [walletController],
		onTransactionConfirmed: handleTransactionStatusChange,
		onTransactionPartial: hasPartialListener ? handleTransactionStatusChange : undefined,
		onTransactionError: hasErrorListener ? handleTransactionStatusChange : undefined,
		onTransactionUnconfirmed: hasUnconfirmedListener ? handleTransactionStatusChange : undefined
	});

	// Listen to wallet lifecycle events
	useWalletListener({
		walletControllers: [walletController],
		onAccountChange: handleAccountChange,
		onNetworkConnected: handleNetworkConnected
	});
};

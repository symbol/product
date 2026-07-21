import { useEventCallback } from './useEventCallback';
import { useTransactionListener } from './useTransactionListener';
import { useWalletListener } from './useWalletListener';
import { DB_UPDATE_LATENCY_AFTER_ANNOUNCE } from '@/app/constants';
import { useEffect, useRef } from 'react';

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

	// Event handlers
	const handleTransactionStatusChange = useEventCallback(() => {
		// Clear any existing scheduled refresh
		if (refreshTimeoutRef.current)
			clearTimeout(refreshTimeoutRef.current);

		refreshTimeoutRef.current = setTimeout(() => {
			onRefresh();
			refreshTimeoutRef.current = null;
		}, DB_UPDATE_LATENCY_AFTER_ANNOUNCE);
	});
	const handleNetworkConnected = useEventCallback(() => {
		onRefresh();
	});
	const handleAccountChange = useEventCallback(() => {
		if (onClear)
			onClear();

		if (walletController.isWalletReady)
			onRefresh();
	});

	// Cancel the scheduled refresh when the screen is unmounted
	useEffect(() => () => clearTimeout(refreshTimeoutRef.current), []);

	// Listen to transaction events
	useTransactionListener({
		walletControllers: [walletController],
		onTransactionConfirmed: handleTransactionStatusChange,
		onTransactionPartial: hasPartialListener ? handleTransactionStatusChange : undefined,
		onTransactionError: hasErrorListener ? handleTransactionStatusChange : undefined,
		onTransactionUnconfirmed: hasUnconfirmedListener ? handleTransactionStatusChange : undefined,
		deps: [walletController]
	});

	// Listen to wallet lifecycle events
	useWalletListener({
		walletControllers: [walletController],
		onAccountChange: handleAccountChange,
		onNetworkConnected: handleNetworkConnected,
		deps: [walletController]
	});
};

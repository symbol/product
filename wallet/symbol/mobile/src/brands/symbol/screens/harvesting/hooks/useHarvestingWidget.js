import { useHarvestingStatus } from './useHarvestingStatus';
import { useHarvestingSummary } from './useHarvestingSummary';
import { createHarvestingStatusViewModel, getHarvestingEligibility } from '../utils';
import { useWalletRefreshLifecycle } from '@/app/hooks';
import { useCallback, useMemo } from 'react';

/** @typedef {import('@/app/types/Wallet').MainWalletController} MainWalletController */
/** @typedef {import('../types/Harvesting').HarvestingWidgetProps} HarvestingWidgetProps */
/** @typedef {import('@/app/types/RefreshController').RefreshController} RefreshController */

/**
 * Return type for useHarvestingWidget hook.
 * @typedef {object} UseHarvestingWidgetReturnType
 * @property {boolean} isVisible - Whether the widget should be visible.
 * @property {boolean} isLoading - Whether data is being fetched.
 * @property {HarvestingWidgetProps} props - Props for the HarvestingWidget component.
 */

/**
 * React hook for managing the harvesting widget state.
 * Loads summary data and listens to wallet events for automatic reloads.
 * @param {MainWalletController} walletController - Wallet controller instance.
 * @param {RefreshController} refreshController - Screen refresh controller.
 * @returns {UseHarvestingWidgetReturnType} Widget state and props.
 */
export const useHarvestingWidget = (walletController, refreshController) => {
	const { ticker, currentAccount, networkProperties } = walletController;
	const currentAccountInfo = walletController.currentAccountInfo || {};

	// The widget always reflects the current account
	const currentAccountWithInfo = useMemo(
		() => ({ ...currentAccountInfo, address: currentAccount.address, publicKey: currentAccount.publicKey }),
		[currentAccountInfo, currentAccount.address, currentAccount.publicKey]
	);

	// Harvesting status
	const statusManager = useHarvestingStatus(walletController, currentAccountWithInfo);
	const { harvestingStatus } = statusManager;
	const eligibility = getHarvestingEligibility(currentAccountWithInfo, networkProperties?.networkCurrency?.divisibility);
	const statusViewModel = createHarvestingStatusViewModel({ harvestingStatus, eligibility });

	// Harvesting summary
	const summaryManager = useHarvestingSummary(walletController, currentAccount.address);
	const { summaryViewModel } = summaryManager;

	// Subscribe to wallet events for automatic loading
	const loadAll = useCallback(() => {
		walletController.fetchAccountInfo();
		statusManager.load();
		summaryManager.load();
	}, [walletController, statusManager, summaryManager]);
	const clearAll = useCallback(() => {
		statusManager.reset();
		summaryManager.reset();
	}, [statusManager, summaryManager]);
	useWalletRefreshLifecycle({
		walletController,
		refreshController,
		onRefresh: loadAll,
		onClear: clearAll,
		shouldLoadOnMount: true
	});

	return {
		isVisible: summaryViewModel.hasData,
		isLoading: summaryManager.isLoading || statusManager.isLoading,
		props: {
			summaryViewModel,
			statusViewModel,
			ticker
		}
	};
};

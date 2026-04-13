import { useWalletRefreshLifecycle } from '@/app/hooks';
import { useHarvestingAccountInfo } from '@/app/screens/harvesting/hooks/useHarvestingAccountInfo';
import { useHarvestingSummary } from '@/app/screens/harvesting/hooks/useHarvestingSummary';
import { createHarvestingStatusViewModel } from '@/app/screens/harvesting/utils';
import { useCallback } from 'react';

/** @typedef {import('@/app/types/Wallet').MainWalletController} MainWalletController */
/** @typedef {import('../types/Harvesting').HarvestingWidgetProps} HarvestingWidgetProps */

/**
 * Return type for useHarvestingWidget hook.
 * @typedef {Object} UseHarvestingWidgetReturnType
 * @property {boolean} isVisible - Whether the widget should be visible.
 * @property {() => void} refresh - Function to load harvesting data.
 * @property {boolean} isLoading - Whether data is being fetched.
 * @property {HarvestingWidgetProps} props - Props for the HarvestingWidget component.
 */

/**
 * React hook for managing the harvesting widget state.
 * Loads summary data and listens to wallet events for automatic reloads.
 *
 * @param {MainWalletController} walletController - Wallet controller instance.
 * @returns {UseHarvestingWidgetReturnType} Widget state and props.
 */
export const useHarvestingWidget = walletController => {
	const { ticker } = walletController;

	// Harvesting status
	const statusManager = useHarvestingAccountInfo(walletController);
	const { 
		harvestingStatus, 
		isAccountBalanceSufficient, 
		isAccountImportanceSufficient, 
		isPendingTransaction 
	} = statusManager;
	const statusViewModel = createHarvestingStatusViewModel({
		harvestingStatus,
		isBalanceSufficient: isAccountBalanceSufficient,
		isImportanceSufficient: isAccountImportanceSufficient,
		isPendingTransaction
	});

	// Harvesting summary
	const summaryManager = useHarvestingSummary(walletController);
	const { summaryViewModel } = summaryManager;

	// Subscribe to wallet events for automatic loading
	const loadAll = useCallback(() => {
		statusManager.load();
		summaryManager.load();
	}, [statusManager, summaryManager]);
	const clearAll = useCallback(() => {
		statusManager.reset();
		summaryManager.reset();
	}, [statusManager, summaryManager]);
	useWalletRefreshLifecycle({
		walletController,
		onRefresh: loadAll,
		onClear: clearAll
	});

	return {
		isVisible: summaryViewModel.hasData,
		refresh: loadAll,
		isLoading: summaryManager.isLoading || statusManager.isLoading,
		props: {
			summaryViewModel,
			statusViewModel,
			ticker
		}
	};
};

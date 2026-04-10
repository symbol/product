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
 * @property {() => void} refresh - Function to refresh harvesting data.
 * @property {boolean} isLoading - Whether data is being fetched.
 * @property {HarvestingWidgetProps} props - Props for the HarvestingWidget component.
 */

/**
 * React hook for managing the harvesting widget state.
 * Fetches summary data and listens to wallet events for auto-refresh.
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

	// Subscribe to wallet events for auto-refresh
	const refreshAll = useCallback(() => {
		statusManager.refresh();
		summaryManager.refresh();
	}, [statusManager, summaryManager]);
	const clearAll = useCallback(() => {
		statusManager.reset();
		summaryManager.reset();
	}, [statusManager, summaryManager]);
	useWalletRefreshLifecycle({
		walletController,
		onRefresh: refreshAll,
		onClear: clearAll
	});

	return {
		isVisible: summaryViewModel.hasData,
		refresh: refreshAll,
		isLoading: summaryManager.isLoading || statusManager.isLoading,
		props: {
			summaryViewModel,
			statusViewModel,
			ticker
		}
	};
};

import { useAsyncManager, useWalletRefreshLifecycle } from '@/app/hooks';
import { createHarvestingSummaryViewModel } from '@/app/screens/harvesting/utils';

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

	// Harvesting summary
	const summaryManager = useAsyncManager({
		callback: async () => walletController.modules.harvesting.fetchSummary()
	});
	const summaryViewModel = createHarvestingSummaryViewModel(summaryManager.data);

	// Subscribe to wallet events for auto-refresh
	useWalletRefreshLifecycle({
		walletController,
		onRefresh: summaryManager.call,
		onClear: summaryManager.reset
	});

	return {
		isVisible: summaryViewModel.hasData,
		refresh: summaryManager.call,
		isLoading: summaryManager.isLoading,
		props: {
			summaryViewModel,
			ticker
		}
	};
};

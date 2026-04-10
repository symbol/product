import { useAsyncManager } from '@/app/hooks';
import { createHarvestingSummaryViewModel } from '@/app/screens/harvesting/utils';
import { useCallback } from 'react';

/** @typedef {import('@/app/types/Wallet').MainWalletController} MainWalletController */
/** @typedef {import('@/app/screens/harvesting/utils/harvesting-summary').HarvestingSummaryViewModel} HarvestingSummaryViewModel */

/**
 * Return type for useHarvestingSummary hook.
 * @typedef {Object} UseHarvestingSummaryReturnType
 * @property {HarvestingSummaryViewModel} summaryViewModel - Summary view model for rendering.
 * @property {boolean} isLoading - Whether summary is loading.
 * @property {() => void} refresh - Refetches summary data.
 * @property {() => void} reset - Resets summary state.
 */

/**
 * React hook for fetching and managing harvesting summary data.
 *
 * @param {MainWalletController} walletController - Wallet controller instance.
 * @returns {UseHarvestingSummaryReturnType}
 */
export const useHarvestingSummary = walletController => {
	const summaryManager = useAsyncManager({
		callback: async () => walletController.modules.harvesting.fetchSummary()
	});

	const summaryViewModel = createHarvestingSummaryViewModel(summaryManager.data);

	const refresh = useCallback(() => {
		summaryManager.call();
	}, [summaryManager]);

	const reset = useCallback(() => {
		summaryManager.reset();
	}, [summaryManager]);

	return {
		summaryViewModel,
		isLoading: summaryManager.isLoading,
		refresh,
		reset
	};
};

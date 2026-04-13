import { useAsyncManager } from '@/app/hooks';
import { createHarvestingSummaryViewModel } from '@/app/screens/harvesting/utils';
import { useCallback } from 'react';

/** @typedef {import('@/app/types/Wallet').MainWalletController} MainWalletController */
/** @typedef {import('../types/Harvesting').HarvestingSummaryViewModel} HarvestingSummaryViewModel */

/**
 * Return type for useHarvestingSummary hook.
 * @typedef {Object} UseHarvestingSummaryReturnType
 * @property {HarvestingSummaryViewModel} summaryViewModel - Summary view model for rendering.
 * @property {boolean} isLoading - Whether summary is loading.
 * @property {() => void} load - Loads summary data.
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
		callback: async () => walletController.modules.harvesting.fetchSummary(),
		defaultData: walletController.modules.harvesting.summary
	});

	const summaryViewModel = createHarvestingSummaryViewModel(summaryManager.data);

	const load = useCallback(() => {
		summaryManager.call();
	}, [summaryManager]);

	const reset = useCallback(() => {
		summaryManager.reset();
	}, [summaryManager]);

	return {
		summaryViewModel,
		isLoading: summaryManager.isLoading,
		load,
		reset
	};
};

import { useAsyncManager } from '@/app/hooks';
import { createHarvestingSummaryViewModel } from '@/app/screens/harvesting/utils';
import { useCallback } from 'react';

/** @typedef {import('@/app/types/Wallet').MainWalletController} MainWalletController */
/** @typedef {import('../types/Harvesting').HarvestingSummaryViewModel} HarvestingSummaryViewModel */

/**
 * Return type for useHarvestingSummary hook.
 * @typedef {object} UseHarvestingSummaryReturnType
 * @property {HarvestingSummaryViewModel} summaryViewModel - Summary view model for rendering.
 * @property {boolean} isLoading - Whether the summary is being fetched, or is not known yet.
 * @property {() => void} load - Loads summary data of the selected account.
 * @property {() => void} reset - Resets summary state.
 */

/**
 * React hook for fetching and managing harvesting summary data for the selected account.
 * The summary is read from the address-keyed module cache instead of being mirrored into the component state,
 * so it always belongs to the selected account, even while a fetch for a previously selected one is in flight.
 * @param {MainWalletController} walletController - Wallet controller instance.
 * @param {string} [harvesterAddress] - The selected harvester account address (current or multisig).
 * @returns {UseHarvestingSummaryReturnType}
 */
export const useHarvestingSummary = (walletController, harvesterAddress) => {
	const { harvesting } = walletController.modules;

	const summaryManager = useAsyncManager({
		callback: async () => harvesting.fetchSummary(harvesterAddress)
	});

	const load = useCallback(() => {
		if (!harvesterAddress)
			return;

		summaryManager.call();
	}, [summaryManager, harvesterAddress]);

	const reset = useCallback(() => {
		summaryManager.reset();
	}, [summaryManager]);

	const summary = harvesting.getSummary(harvesterAddress);
	const summaryViewModel = createHarvestingSummaryViewModel(summary);

	return {
		summaryViewModel,
		isLoading: summaryManager.isLoading,
		load,
		reset
	};
};

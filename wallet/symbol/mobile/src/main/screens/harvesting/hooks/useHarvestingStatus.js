import { useAsyncManager } from '@/app/hooks';
import { useCallback } from 'react';

/** @typedef {import('@/app/types/Wallet').MainWalletController} MainWalletController */
/** @typedef {import('@/app/types/Account').SymbolAccountInfo} SymbolAccountInfo */
/** @typedef {import('wallet-common-symbol').HarvestingStatus} HarvestingStatusData */

/**
 * Return type for useHarvestingStatus hook.
 * @typedef {object} UseHarvestingStatusReturnType
 * @property {HarvestingStatusData|null} harvestingStatus - Harvesting status of the selected account.
 * @property {boolean} isLoading - Whether the status is being fetched, or is not known yet.
 * @property {() => void} load - Fetches the latest harvesting status of the selected account.
 * @property {() => void} reset - Resets state.
 */

/**
 * React hook for fetching and managing the harvesting status of the selected account.
 * The status is read from the address-keyed module cache instead of being mirrored into the component state,
 * so it always belongs to the selected account, even while a fetch for a previously selected one is in flight.
 * @param {MainWalletController} walletController - The wallet controller instance.
 * @param {SymbolAccountInfo} [harvesterAccountInfo] - The selected harvester account info (current or multisig).
 * @returns {UseHarvestingStatusReturnType}
 */
export const useHarvestingStatus = (walletController, harvesterAccountInfo) => {
	const { harvesting } = walletController.modules;
	const selectedAddress = harvesterAccountInfo?.address;

	const statusManager = useAsyncManager({
		callback: async () => harvesting.fetchStatus(harvesterAccountInfo),
		defaultLoadingState: true
	});

	const load = useCallback(() => {
		if (!selectedAddress)
			return;

		statusManager.call();
	}, [statusManager, selectedAddress]);

	const reset = useCallback(() => {
		statusManager.reset();
	}, [statusManager]);

	const harvestingStatus = harvesting.getStatus(selectedAddress);

	return {
		harvestingStatus,
		isLoading: statusManager.isLoading,
		load,
		reset
	};
};

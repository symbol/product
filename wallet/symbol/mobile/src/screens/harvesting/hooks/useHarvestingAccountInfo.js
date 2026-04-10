import { useAsyncManager } from '@/app/hooks';
import { isBalanceSufficient, isImportanceSufficient } from '@/app/screens/harvesting/utils';
import { useCallback, useState } from 'react';

/** @typedef {import('@/app/types/Wallet').MainWalletController} MainWalletController */
/** @typedef {import('wallet-common-symbol').HarvestingStatus} HarvestingStatusData */

/**
 * Return type for useHarvestingAccountInfo hook.
 * @typedef {Object} UseHarvestingAccountInfoReturnType
 * @property {() => void} refresh - Fetches the latest harvesting status.
 * @property {boolean} isLoading - Whether data is being fetched.
 * @property {HarvestingStatusData|null} harvestingStatus - Current harvesting status.
 * @property {boolean} isEligible - Whether account is eligible for harvesting.
 * @property {boolean} isAccountBalanceSufficient - Whether account balance is sufficient.
 * @property {boolean} isAccountImportanceSufficient - Whether account importance is sufficient.
 * @property {() => void} reset - Resets state.
 */

/**
 * React hook for fetching and managing harvesting account information.
 *
 * @param {MainWalletController} walletController - The wallet controller instance.
 * @returns {UseHarvestingAccountInfoReturnType}
 */
export const useHarvestingAccountInfo = walletController => {
	const { currentAccountInfo, networkProperties } = walletController;
	const divisibility = networkProperties?.networkCurrency?.divisibility ?? 6;
	const balance = currentAccountInfo?.balance ?? '0';
	const importance = currentAccountInfo?.importance ?? 0;

	// Track if initial data has been loaded
	const [isInitialLoad, setIsInitialLoad] = useState(true);

	// Harvesting status
	const statusManager = useAsyncManager({
		callback: async () => {
			const result = await walletController.modules.harvesting.fetchStatus();
			setIsInitialLoad(false);
			return result;
		}
	});

	const refresh = useCallback(async () => {
		await walletController.fetchAccountInfo();
		await statusManager.call();
	}, [walletController, statusManager]);

	const reset = useCallback(() => {
		setIsInitialLoad(true);
		statusManager.reset();
	}, [statusManager]);

	const isAccountBalanceSufficient = isBalanceSufficient(balance, divisibility);
	const isAccountImportanceSufficient = isImportanceSufficient(importance);
	const isEligible = isAccountBalanceSufficient && isAccountImportanceSufficient;

	// Show loading if initial data hasn't been loaded yet or if actively fetching
	const isLoading = isInitialLoad || statusManager.isLoading;

	return {
		refresh,
		isLoading,
		harvestingStatus: statusManager.data,
		isEligible,
		isAccountBalanceSufficient,
		isAccountImportanceSufficient,
		reset
	};
};

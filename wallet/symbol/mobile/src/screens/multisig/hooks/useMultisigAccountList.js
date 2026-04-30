import { useAsyncManager } from '@/app/hooks';
import { useCallback } from 'react';

/** @typedef {import('@/app/types/Wallet').MainWalletController} MainWalletController */
/** @typedef {import('@/app/types/Account').SymbolAccountInfo} SymbolAccountInfo */

/**
 * Return type for useMultisigAccountList hook.
 * @typedef {object} UseMultisigAccountListReturnType
 * @property {() => void} load - Fetches the latest multisig account list.
 * @property {() => void} reset - Resets the multisig account list state.
 * @property {SymbolAccountInfo[]} data - The list of multisig accounts.
 * @property {boolean} isLoading - Whether data is currently being fetched.
 */

/**
 * React hook for fetching and managing the list of multisig accounts.
 * @param {MainWalletController} walletController - The wallet controller instance.
 * @returns {UseMultisigAccountListReturnType}
 */
export const useMultisigAccountList = walletController => {
	const dataManager = useAsyncManager({
		callback: async () => walletController.modules.multisig.fetchData()
	});

	const load = useCallback(() => {
		dataManager.call();
	}, [dataManager]);

	const reset = useCallback(() => {
		dataManager.reset();
	}, [dataManager]);

	return {
		load,
		reset,
		data: walletController.modules.multisig.multisigAccounts,
		isLoading: dataManager.isLoading
	};
};

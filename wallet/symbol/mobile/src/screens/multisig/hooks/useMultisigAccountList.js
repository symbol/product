import { useAsyncManager, useTransactionListener, useWalletListener } from '@/app/hooks';

/** @typedef {import('@/app/types/Wallet').MainWalletController} MainWalletController */
/** @typedef {import('@/app/types/Account').SymbolAccountInfo} SymbolAccountInfo */

/**
 * Return type for useMultisigAccountList hook.
 * @typedef {Object} UseMultisigAccountListReturnType
 * @property {() => void} refresh - Fetches the latest multisig account list.
 * @property {SymbolAccountInfo[]} data - The list of multisig accounts.
 * @property {boolean} isLoading - Whether data is currently being fetched.
 */

/**
 * React hook for fetching and managing the list of multisig accounts.
 * Automatically refreshes when transactions are confirmed or the current account changes.
 *
 * @param {MainWalletController} walletController - The wallet controller instance.
 * @returns {UseMultisigAccountListReturnType}
 */
export const useMultisigAccountList = walletController => {
	const dataManager = useAsyncManager({
		callback: async () => walletController.modules.multisig.fetchData()
	});

	const refresh = () => {
		dataManager.call();
	};
	const clear = () => {
		dataManager.reset();
	};

	const handleTransactionStatusChange = () => {
		refresh();
	};
	const handleAccountChange = () => {
		clear();
		refresh();
	};

	useTransactionListener({
		walletControllers: [walletController],
		onTransactionConfirmed: handleTransactionStatusChange,
		onTransactionUnconfirmed: handleTransactionStatusChange,
		onTransactionPartial: handleTransactionStatusChange,
		onTransactionError: handleTransactionStatusChange
	});

	useWalletListener({
		walletControllers: [walletController],
		onAccountChange: handleAccountChange
	});

	return {
		refresh,
		data: walletController.modules.multisig.multisigAccounts,
		isLoading: dataManager.isLoading
	};
};

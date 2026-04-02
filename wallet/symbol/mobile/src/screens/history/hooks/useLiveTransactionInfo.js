import { useAsyncManager, useTimer } from '@/app/hooks';
import { REFRESH_TRANSACTION_DETAILS_INTERVAL } from '@/app/screens/history/constants';
import { TransactionGroup } from '@/app/types/Transaction';

/** @typedef {import('@/app/types/Transaction').Transaction} Transaction */
/** @typedef {import('@/app/types/Wallet').WalletController} WalletController */

/**
 * Transaction status information.
 * @typedef {Object} TransactionStatus
 * @property {string} group - Transaction group from TransactionGroup enum.
 */

/**
 * Live transaction data returned by the hook.
 * @typedef {Object} LiveTransactionData
 * @property {TransactionStatus} status - Current transaction status.
 * @property {Transaction} transaction - Transaction data.
 */

/**
 * @typedef {Object} UseLiveTransactionInfoResult
 * @property {LiveTransactionData} data - Live transaction data with status.
 * @property {boolean} isLoading - Whether data is being fetched.
 * @property {Error|null} error - Error if fetch failed.
 * @property {function(): void} refresh - Function to manually refresh data.
 */

/**
 * React hook for fetching and auto-refreshing transaction information.
 * Polls for transaction status updates at regular intervals.
 *
 * @param {WalletController} walletController - Wallet controller instance.
 * @param {Transaction} preloadedData - Initial transaction data.
 * @param {string} preloadedGroup - Initial transaction group.
 * @returns {UseLiveTransactionInfoResult} Live transaction data and controls.
 */
export const useLiveTransactionInfo = (walletController, preloadedData, preloadedGroup) => {
	const { isWalletReady } = walletController;

	const transactionManager = useAsyncManager({
		callback: async () => {
			const status = await walletController.fetchTransactionStatus(preloadedData.hash);

			if (status.group === TransactionGroup.FAILED)
				return { status, transaction: preloadedData };

			const transaction = await walletController.fetchAccountTransaction(preloadedData.hash);

			return { status, transaction };
		},
		defaultData: {
			status: { group: preloadedGroup },
			transaction: preloadedData
		}
	});

	useTimer({
		isActive: isWalletReady,
		callback: transactionManager.call,
		interval: REFRESH_TRANSACTION_DETAILS_INTERVAL,
		hasImmediateExecution: true
	});

	return {
		data: transactionManager.data,
		isLoading: transactionManager.isLoading,
		error: transactionManager.error,
		refresh: transactionManager.call
	};
};

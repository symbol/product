import { useAsyncManager } from '@/app/hooks';

/** @typedef {import('@/app/types/Wallet').WalletController} WalletController */
/** @typedef {import('@/app/types/Transaction').TransactionFeeTiers} TransactionFeeTiers */
/** @typedef {import('@/app/types/Transaction').TransactionBundle} TransactionBundle */

/**
 * A custom hook that calculates transaction fees.
 * @param {function(): Promise<TransactionBundle>} createTransaction - A callback function that creates and returns a transaction object.
 * @param {WalletController} walletController - The wallet controller instance.
 * @returns {TransactionFeeTiers} An object containing the transaction fees data, loading state,
 * and a function to trigger the calculation.
 */
export const useTransactionFees = (createTransaction, walletController) => {
	return useAsyncManager({
		callback: async () => {
			const transaction = await createTransaction();
			return await walletController.modules.transfer.calculateTransactionFees(transaction);
		},
		shouldShowErrorPopup: false
	});
};

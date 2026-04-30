import { useAsyncManager } from '@/app/hooks';

/**
 * A custom hook that calculates transaction fees.
 * @param {function(): Promise<object>} createTransaction - A callback function that creates and returns a transaction object.
 * @param {import('wallet-common-core/src/lib/controller/WalletController').WalletController}
 * walletController - The wallet controller instance.
 * @returns {object} An object containing the transaction fees data, loading state,.
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

import { objectToTableData } from '@/app/utils';

/** @typedef {import('@/app/screens/bridge/types/Bridge').SwapWorkflowManager} SwapWorkflowManager */
/** @typedef {import('@/app/screens/bridge/types/Bridge').SwapSide} SwapSide */
/** @typedef {import('@/app/screens/bridge/types/Bridge').BridgeEstimation} BridgeEstimation */
/** @typedef {import('@/app/types/Transaction').TransactionBundle} TransactionBundle */
/** @typedef {import('@/app/types/Wallet').WalletController} WalletController */
/** @typedef {import('@/app/types/Transaction').TransactionConfirmationDialogSection} TransactionConfirmationDialogSection */

/**
 * Return type for useBridgeTransaction hook.
 * @typedef {object} UseBridgeTransactionReturnType
 * @property {() => Promise<TransactionBundle>} createTransaction - Creates a bridge transaction bundle.
 * @property {(transactionBundle: TransactionBundle) => TransactionConfirmationDialogSection[]} getConfirmationPreview
 *   - Generates confirmation sections for the transaction confirmation dialog.
 */

/**
 * React hook for creating bridge transactions and generating transaction preview data.
 * @param {object} params - Hook parameters.
 * @param {SwapWorkflowManager|null} params.bridge - The bridge manager instance.
 * @param {SwapSide|null} params.target - The target swap side.
 * @param {string} params.amount - The amount to transfer.
 * @param {BridgeEstimation} params.estimation - The estimation data for the transaction.
 * @param {WalletController} params.walletController - The source wallet controller instance.
 * @returns {UseBridgeTransactionReturnType}
 */
export const useBridgeTransaction = ({ bridge, target, amount, estimation, walletController }) => {
	/**
	 * Creates a bridge transaction bundle.
	 * @returns {Promise<TransactionBundle>}
	 */
	const createTransaction = async () => {
		const transactionBundle = await bridge.createTransactionForStep(0, {
			recipientAddress: target.walletController.currentAccount.address,
			amount,
			amountOutMinimum: estimation?.receiveAmount
		});

		return transactionBundle;
	};

	/**
	 * Generates confirmation sections for the transaction confirmation dialog.
	 * @param {TransactionBundle} transactionBundle - The transaction bundle to preview.
	 * @returns {TransactionConfirmationDialogSection[]}
	 */
	const getConfirmationPreview = transactionBundle => {
		const { chainName, networkIdentifier, modules: { addressBook }, accounts } = walletController;
		const walletAccounts = accounts;

		return transactionBundle.transactions.map((transaction, index) => {
			const swapData = {
				signerAddress: transaction.signerAddress,
				recipientAddress: transaction.message?.text ?? transaction.recipientAddress,
				tokens: transaction.mosaics || transaction.tokens || (transaction.sourceToken ? [transaction.sourceToken] : []),
				fee: transaction.fee
			};

			return {
				id: `section_${index}`,
				title: '',
				chainName,
				networkIdentifier,
				addressBook,
				walletAccounts,
				tableData: objectToTableData(swapData)
			};
		});
	};

	return {
		createTransaction,
		getConfirmationPreview
	};
};

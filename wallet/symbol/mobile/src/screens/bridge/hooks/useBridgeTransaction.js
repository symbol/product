import { objectToTableData } from '@/app/utils';

/** @typedef {import('@/app/screens/bridge/types/Bridge').SwapWorkflowManager} SwapWorkflowManager */
/** @typedef {import('@/app/screens/bridge/types/Bridge').BridgeEstimation} BridgeEstimation */
/** @typedef {import('@/app/types/Transaction').TransactionBundle} TransactionBundle */
/** @typedef {import('@/app/types/Transaction').TransactionConfirmationDialogSection} TransactionConfirmationDialogSection */
/** @typedef {import('@/app/types/Wallet').WalletController} WalletController */

/**
 * Return type for useBridgeTransaction hook.
 * @typedef {object} UseBridgeTransactionReturnType
 * @property {(stepIndex?: number) => Promise<TransactionBundle>} createTransaction 
 * - Creates a bridge transaction bundle for the given step.
 * @property {(transactionBundle: TransactionBundle|TransactionBundle[]) => TransactionConfirmationDialogSection[]} getConfirmationPreview
 * - Generates confirmation sections for the transaction confirmation dialog.
 */

/**
 * React hook for creating bridge transactions and generating transaction preview data.
 * @param {object} params - Hook parameters.
 * @param {SwapWorkflowManager|null} params.bridge - The bridge manager instance.
 * @param {string} params.amount - The amount to transfer.
 * @param {BridgeEstimation[]} params.estimations - The estimations data for the transactions.
 * @param {WalletController} params.walletController - The source wallet controller instance.
 * @returns {UseBridgeTransactionReturnType}
 */
export const useBridgeTransaction = ({ bridge, amount, estimations, walletController }) => {
	/**
	 * Creates a bridge transaction bundle.
	 * @returns {Promise<TransactionBundle>}
	 */
	const createTransaction = async (stepIndex = 0) => {
		const stepPair = bridge?.getPairForStep(stepIndex);

		if (!stepPair)
			throw new Error(`No pair found for step index ${stepIndex}`);

		const estimation = estimations ? estimations[stepIndex] : null;
		const previousEstimation = estimations ? estimations[stepIndex - 1] : null;

		const transactionBundle = await stepPair.createTransaction({
			recipientAddress: stepPair.targetWalletController.currentAccount.address,
			amount: stepIndex === 0 ? amount : previousEstimation?.receiveAmount,
			amountOutMinimum: estimation?.receiveAmount
		});

		return transactionBundle;
	};

	/**
	 * Generates confirmation sections for the transaction confirmation dialog.
	 * Handles both a single TransactionBundle (single-step) and an array of bundles (dual-step).
	 * @param {TransactionBundle|TransactionBundle[]} transactionBundle - The transaction bundle(s) to preview.
	 * @returns {TransactionConfirmationDialogSection[]}
	 */
	const getConfirmationPreview = transactionBundle => {
		const { modules: { addressBook }, accounts } = walletController;
		const walletAccounts = accounts;

		const bundles = Array.isArray(transactionBundle) ? transactionBundle : [transactionBundle];

		return bundles.flatMap((bundle, bundleIndex) =>
			bundle.transactions.map((transaction, index) => {
				const stepPair = bridge?.getPairForStep(bundleIndex);

				if (!stepPair)
					throw new Error(`No pair found for step index ${bundleIndex}`);

				const { chainName, networkIdentifier } = stepPair.sourceWalletController;
				
				const swapData = {
					signerAddress: transaction.signerAddress,
					recipientAddress: transaction.message?.text ?? transaction.recipientAddress,
					tokens: transaction.mosaics || transaction.tokens || (transaction.sourceToken ? [transaction.sourceToken] : []),
					fee: transaction.fee
				};

				return {
					id: `section_${bundleIndex}_${index}`,
					title: '',
					chainName,
					networkIdentifier,
					addressBook,
					walletAccounts,
					tableData: objectToTableData(swapData)
				};
			}));
	};

	return {
		createTransaction,
		getConfirmationPreview
	};
};

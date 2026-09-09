import { objectToTableData } from '@/app/utils';

/** @typedef {import('@/app/screens/bridge/types/Bridge').BridgeEstimation} BridgeEstimation */
/** @typedef {import('@/app/screens/bridge/types/Bridge').SwapStep} SwapStep */
/** @typedef {import('@/app/types/Transaction').TransactionBundle} TransactionBundle */
/** @typedef {import('@/app/types/Transaction').TransactionConfirmationDialogSection} TransactionConfirmationDialogSection */

/**
 * Return type for useBridgeTransaction hook.
 * @typedef {object} UseBridgeTransactionReturnType
 * @property {(stepIndex?: number) => Promise<TransactionBundle>} createTransaction
 * - Creates a bridge transaction bundle for the given step.
 * @property {(transactionBundle: TransactionBundle|TransactionBundle[]) => TransactionConfirmationDialogSection[]} getConfirmationPreview
 * - Generates confirmation sections for the transaction confirmation dialog.
 */

/**
 * React hook for generating transaction preview data and creating bridge transactions.
 * @param {object} params - Hook parameters.
 * @param {SwapStep[]} params.steps - Steps of the selected route; empty while no route is selected.
 * @param {string} params.amount - The amount to transfer.
 * @param {BridgeEstimation[]|null} params.estimations - Per-step estimations, null when absent.
 * @returns {UseBridgeTransactionReturnType}
 */
export const useBridgeTransaction = ({ steps, amount, estimations }) => {
	/**
	 * Retrieves the swap step manager by given step index.
	 * @param {number} stepIndex - Zero-based step index.
	 * @returns {SwapStep} The route step.
	 */
	const getStep = stepIndex => {
		const step = steps[stepIndex];

		if (!step)
			throw new Error(`No step found for index ${stepIndex}`);

		return step;
	};

	/**
	 * Creates a bridge transaction bundle for the swap step. The estimated output of the previous step used as the
	 * input amount for a next step.
	 * @param {number} [stepIndex=0] - Zero-based step index.
	 * @returns {Promise<TransactionBundle>} The transaction bundle.
	 */
	const createTransaction = async (stepIndex = 0) => {
		const step = getStep(stepIndex);
		const estimation = estimations ? estimations[stepIndex] : null;
		const previousEstimation = estimations ? estimations[stepIndex - 1] : null;

		return step.createTransaction({
			recipientAddress: step.targetWalletController.currentAccount.address,
			amount: stepIndex === 0 ? amount : previousEstimation?.receiveAmount,
			amountOutMinimum: estimation?.receiveAmount
		});
	};

	/**
	 * Creates confirmation sections for the transaction confirmation dialog. 
	 * Accepts either an array of bundles for dual-step or a single bundle for single-step.
	 * @param {TransactionBundle|TransactionBundle[]} transactionBundle - The transaction bundle(s) to preview.
	 * @returns {TransactionConfirmationDialogSection[]} Confirmation sections.
	 */
	const getConfirmationPreview = transactionBundle => {
		const bundles = Array.isArray(transactionBundle) ? transactionBundle : [transactionBundle];

		return bundles.flatMap((bundle, bundleIndex) => {
			const { chainName } = getStep(bundleIndex).sourceWalletController;

			return bundle.transactions.map((transaction, index) => ({
				id: `section_${bundleIndex}_${index}`,
				title: '',
				chainName,
				tableData: objectToTableData({
					signerAddress: transaction.signerAddress,
					recipientAddress: transaction.message?.text ?? transaction.recipientAddress,
					tokens: transaction.mosaics || transaction.tokens || (transaction.sourceToken ? [transaction.sourceToken] : []),
					fee: transaction.fee
				})
			}));
		});
	};

	return {
		createTransaction,
		getConfirmationPreview
	};
};

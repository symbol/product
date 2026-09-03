import { useAsyncManager } from '@/app/hooks';

/** @typedef {import('@/app/screens/bridge/types/Bridge').BridgeEstimation} BridgeEstimation */
/** @typedef {import('@/app/screens/bridge/types/Bridge').StepTransactionFees} StepTransactionFees */
/** @typedef {import('@/app/screens/bridge/types/Bridge').SwapWorkflowManager} SwapWorkflowManager */
/** @typedef {import('@/app/types/Transaction').TransactionBundle} TransactionBundle */

/**
 * Return type for useAdditionalStepFees hook.
 * @typedef {object} UseAdditionalStepFeesReturnType
 * @property {StepTransactionFees[]|null} additionalStepFees - Fee data of the steps after the first one.
 * @property {() => Promise<StepTransactionFees[]>} fetchAdditionalStepFees - Fetches the fee data.
 * @property {() => void} clearAdditionalStepFees - Clears the fee data.
 * @property {boolean} isLoading - Whether the fee data is being fetched.
 */

/**
 * React hook for estimating the transaction fees of the swap steps after the first one, so the
 * summary can display the gas of every step. It must run after the estimation arrives, because a
 * later step's transaction amount is the previous step's estimated output. Resolves to an empty
 * list for single-step routes and incomplete or failed estimations.
 * @param {object} params - Hook parameters.
 * @param {SwapWorkflowManager|null} params.bridge - The bridge manager instance.
 * @param {BridgeEstimation[]|null} params.estimations - Per-step bridge estimations.
 * @param {(stepIndex?: number) => Promise<TransactionBundle>} params.createTransaction - Creates a step's transaction bundle.
 * @returns {UseAdditionalStepFeesReturnType}
 */
export const useAdditionalStepFees = ({ bridge, estimations, createTransaction }) => {
	const manager = useAsyncManager({
		callback: async () => {
			const stepCount = bridge?.steps ?? 0;
			const isEstimationComplete = estimations?.length === stepCount
				&& estimations.every(estimation => estimation && !estimation.error);

			if (stepCount <= 1 || !isEstimationComplete)
				return [];

			const stepFees = [];
			for (let stepIndex = 1; stepIndex < stepCount; ++stepIndex) {
				const pair = bridge.getPairForStep(stepIndex);
				const transactionBundle = await createTransaction(stepIndex);
				const feeTiers = await pair.sourceWalletController.modules.transfer.calculateTransactionFees(transactionBundle);

				stepFees.push({
					chainName: pair.sourceWalletController.chainName,
					networkIdentifier: pair.sourceWalletController.networkIdentifier,
					networkCurrency: pair.sourceWalletController.networkProperties.networkCurrency,
					feeTiers
				});
			}

			return stepFees;
		},
		shouldShowErrorPopup: false
	});

	return {
		additionalStepFees: manager.data,
		fetchAdditionalStepFees: manager.call,
		clearAdditionalStepFees: manager.reset,
		isLoading: manager.isLoading
	};
};

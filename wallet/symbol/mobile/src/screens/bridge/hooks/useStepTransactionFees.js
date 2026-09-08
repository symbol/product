import { useAsyncManager } from '@/app/hooks';
import { isEstimationComplete } from '@/app/screens/bridge/utils';

/** @typedef {import('@/app/screens/bridge/types/Bridge').BridgeEstimation} BridgeEstimation */
/** @typedef {import('@/app/screens/bridge/types/Bridge').StepFees} StepFees */
/** @typedef {import('@/app/screens/bridge/types/Bridge').SwapStep} SwapStep */
/** @typedef {import('@/app/types/Transaction').TransactionBundle} TransactionBundle */
/** @typedef {import('@/app/types/Transaction').TransactionFeeTiers} TransactionFeeTiers */

/**
 * Builds the fee data for a swap step.
 * @param {number} stepIndex - Zero-based step index.
 * @param {SwapStep} step - The route step.
 * @param {TransactionFeeTiers[]|null} feeTiers - Fetched tiers, or null until fetched.
 * @returns {StepFees} Step fee data.
 */
const createStepFees = (stepIndex, step, feeTiers) => ({
	stepIndex,
	chainName: step.sourceWalletController.chainName,
	networkIdentifier: step.sourceWalletController.networkIdentifier,
	feeTiers
});

/**
 * Return type for useStepTransactionFees hook.
 * @typedef {object} UseStepTransactionFeesReturnType
 * @property {StepFees[]} stepFees - One entry per route step in order; feeTiers is null until fetched.
 * @property {boolean} isLoading - Whether any step's fees are being fetched.
 * @property {boolean} hasFailed - Whether the last fee request of any step failed outright.
 * @property {() => Promise<TransactionFeeTiers[]>} fetchFirstStepFees - Fetches the step-0 fees; requires a selected route.
 * @property {(estimations: BridgeEstimation[]|null) => Promise<object[]>} fetchRemainingStepFees - Fetches the fees of
 * the steps after the first; empty for single-step routes or an incomplete estimation.
 * @property {() => void} clearRemainingStepFees - Drops the fees of the steps after the first one.
 */

/**
 * React hook for managing the transaction fee tiers of every swap step. Step 0 only requires the entered amount. 
 * The next step amount is retrieved from the estimation output and fees fetched later once amount is available.
 * @param {object} params - Hook parameters.
 * @param {SwapStep[]} params.steps - Steps of the selected route.
 * @param {(stepIndex: number) => Promise<TransactionBundle>} params.createTransaction - Creates a step's transaction bundle.
 * @returns {UseStepTransactionFeesReturnType}
 */
export const useStepTransactionFees = ({ steps, createTransaction }) => {
	const firstStepManager = useAsyncManager({
		callback: async () => {
			const transactionBundle = await createTransaction(0);

			return steps[0].sourceWalletController.modules.transfer.calculateTransactionFees(transactionBundle);
		},
		shouldShowErrorPopup: false
	});

	const remainingStepsManager = useAsyncManager({
		callback: async estimations => {
			if (steps.length <= 1 || !isEstimationComplete(estimations, steps.length))
				return [];

			const remainingStepFees = [];
			for (let stepIndex = 1; stepIndex < steps.length; ++stepIndex) {
				const transactionBundle = await createTransaction(stepIndex);
				const feeTiers = await steps[stepIndex].sourceWalletController.modules.transfer
					.calculateTransactionFees(transactionBundle);

				remainingStepFees.push({ stepIndex, feeTiers });
			}

			return remainingStepFees;
		},
		defaultData: [],
		shouldShowErrorPopup: false
	});

	const feeTiersByStepIndex = new Map([
		[0, firstStepManager.data],
		...remainingStepsManager.data.map(({ stepIndex, feeTiers }) => [stepIndex, feeTiers])
	]);
	const stepFees = steps.map((step, stepIndex) =>
		createStepFees(stepIndex, step, feeTiersByStepIndex.get(stepIndex) ?? null));

	return {
		stepFees,
		isLoading: firstStepManager.isLoading || remainingStepsManager.isLoading,
		hasFailed: firstStepManager.hasFailed || remainingStepsManager.hasFailed,
		fetchFirstStepFees: firstStepManager.call,
		fetchRemainingStepFees: remainingStepsManager.call,
		clearRemainingStepFees: remainingStepsManager.reset
	};
};

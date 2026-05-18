import { useAsyncManager } from '@/app/hooks';

/** @typedef {import('@/app/screens/bridge/types/Bridge').SwapWorkflowManager} SwapWorkflowManager */
/** @typedef {import('@/app/screens/bridge/types/Bridge').BridgeEstimation} BridgeEstimation */

/**
 * Return type for useEstimation hook.
 * @typedef {object} UseEstimationReturnType
 * @property {() => Promise<void>} estimate - Fetches bridge fee estimation.
 * @property {BridgeEstimation[]|null} estimations - Current estimation data.
 * @property {() => void} clearEstimation - Clears the estimation data.
 * @property {boolean} isLoading - Whether estimation is being fetched.
 */

/**
 * React hook for fetching bridge fee and receive amount estimations.
 * @param {object} params - Hook parameters.
 * @param {SwapWorkflowManager|null} params.bridge - The bridge manager instance.
 * @param {string} params.amount - The amount to estimate.
 * @returns {UseEstimationReturnType}
 */
export const useEstimation = ({ bridge, amount }) => {
	const estimationManager = useAsyncManager({
		callback: async () => {
			const estimations = await bridge.estimateRequest(amount);

			return estimations;
		},
		shouldShowErrorPopup: false,
		shouldClearDataOnCall: true
	});

	
	return {
		estimate: estimationManager.call,
		estimations: estimationManager.data,
		clearEstimation: estimationManager.reset,
		isLoading: estimationManager.isLoading
	};
};

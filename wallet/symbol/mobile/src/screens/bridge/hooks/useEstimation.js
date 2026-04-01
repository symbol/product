import { useAsyncManager } from '@/app/hooks';

/** @typedef {import('@/app/screens/bridge/types/Bridge').BridgeManager} BridgeManager */
/** @typedef {import('@/app/screens/bridge/types/Bridge').BridgeEstimation} BridgeEstimation */
/** @typedef {import('@/app/screens/bridge/types/Bridge').BridgeModeType} BridgeModeType */

/**
 * Return type for useEstimation hook.
 * @typedef {Object} UseEstimationReturnType
 * @property {() => Promise<void>} estimate - Fetches bridge fee estimation.
 * @property {BridgeEstimation|null} estimation - Current estimation data.
 * @property {() => void} clearEstimation - Clears the estimation data.
 * @property {boolean} isLoading - Whether estimation is being fetched.
 */

/**
 * React hook for fetching bridge fee and receive amount estimations.
 * @param {Object} params - Hook parameters.
 * @param {BridgeManager|null} params.bridge - The bridge manager instance.
 * @param {BridgeModeType|null} params.mode - The bridge operation mode.
 * @param {string} params.amount - The amount to estimate.
 * @returns {UseEstimationReturnType}
 */
export const useEstimation = ({ bridge, mode, amount }) => {
	const estimationManager = useAsyncManager({
		callback: async () => bridge.estimateRequest(mode, amount),
		shouldShowErrorPopup: false,
		shouldClearDataOnCall: true
	});
	
	return {
		estimate: estimationManager.call,
		estimation: estimationManager.data,
		clearEstimation: estimationManager.reset,
		isLoading: estimationManager.isLoading
	};
};

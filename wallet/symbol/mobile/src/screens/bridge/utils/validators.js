/** @typedef {import('@/app/screens/bridge/types/Bridge').BridgeEstimation} BridgeEstimation */

/**
 * Creates a validator function for bridge estimation errors.
 * @param {BridgeEstimation|null} estimation - The estimation to validate.
 * @returns {() => string|undefined} Validator function returning error key or undefined.
 */
export const validateEstimation = estimation => () => {
	if (estimation?.error?.isAmountLow)
		return 'validation_error_amount_low';

	if (estimation?.error?.isAmountHigh)
		return 'validation_error_amount_high';
};

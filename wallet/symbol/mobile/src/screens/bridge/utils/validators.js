/** @typedef {import('@/app/screens/bridge/types/Bridge').BridgeEstimation} BridgeEstimation */

/**
 * Creates a validator function for bridge estimations errors.
 * @param {BridgeEstimation[]|null} estimations - The estimations to validate.
 * @returns {() => string|undefined} Validator function returning error key or undefined.
 */
export const validateEstimation = estimations => () => {
	const estimationList = estimations ?? [];

	let hasLowAmountError = false;
	let hasHighAmountError = false;
	
	for (const estimation of estimationList) {
		if (estimation.error?.isAmountLow)
			hasLowAmountError = true;

		if (estimation.error?.isAmountHigh)
			hasHighAmountError = true;
	}
	
	if (hasLowAmountError)
		return 'validation_error_amount_low';

	if (hasHighAmountError)
		return 'validation_error_amount_high';
};

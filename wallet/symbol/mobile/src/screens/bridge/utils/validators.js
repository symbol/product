import { constants } from 'wallet-common-core';

/** @typedef {import('@/app/screens/bridge/types/Bridge').BridgeEstimation} BridgeEstimation */

const { BridgeEstimationErrorCode } = constants;

const estimationErrorPriority = [
	BridgeEstimationErrorCode.AMOUNT_LOW,
	BridgeEstimationErrorCode.REQUEST_LIMIT_EXCEEDED,
	BridgeEstimationErrorCode.DAILY_LIMIT_EXCEEDED,
	BridgeEstimationErrorCode.AMOUNT_HIGH
];

const estimationErrorTranslationKeyMap = {
	[BridgeEstimationErrorCode.AMOUNT_LOW]: 'validation_error_amount_low',
	[BridgeEstimationErrorCode.REQUEST_LIMIT_EXCEEDED]: 'validation_error_amount_transferLimit',
	[BridgeEstimationErrorCode.DAILY_LIMIT_EXCEEDED]: 'validation_error_amount_dailyLimit',
	[BridgeEstimationErrorCode.AMOUNT_HIGH]: 'validation_error_amount_high'
};

/**
 * Creates a validator function for bridge estimation errors.
 * @param {BridgeEstimation[]|null} estimations - The estimations to validate.
 * @param {boolean} hasEstimationFailed - Whether the last estimation request failed outright.
 * @returns {() => string|undefined} Validator function returning error key or undefined.
 */
export const validateEstimation = (estimations, hasEstimationFailed) => () => {
	if (hasEstimationFailed)
		return 'validation_error_estimation_unavailable';

	const errorCodes = (estimations ?? [])
		.map(estimation => estimation.error?.code)
		.filter(Boolean);
	const errorCode = estimationErrorPriority.find(code => errorCodes.includes(code));

	return estimationErrorTranslationKeyMap[errorCode];
};

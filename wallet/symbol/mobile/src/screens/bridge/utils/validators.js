import { formatAmountInput } from '@/app/utils';
import { constants } from 'wallet-common-core';

/** @typedef {import('@/app/screens/bridge/types/Bridge').BridgeEstimation} BridgeEstimation */

const { BridgeEstimationErrorCode } = constants;

const MAX_AMOUNT_DISPLAY_DECIMALS = 6;

const estimationErrorPriority = [
	BridgeEstimationErrorCode.INSUFFICIENT_LIQUIDITY,
	BridgeEstimationErrorCode.AMOUNT_LOW,
	BridgeEstimationErrorCode.REQUEST_LIMIT_EXCEEDED,
	BridgeEstimationErrorCode.DAILY_LIMIT_EXCEEDED
];

const estimationErrorTranslationKeyMap = {
	[BridgeEstimationErrorCode.AMOUNT_LOW]: 'validation_error_amount_low',
	[BridgeEstimationErrorCode.REQUEST_LIMIT_EXCEEDED]: 'validation_error_amount_transferLimit',
	[BridgeEstimationErrorCode.DAILY_LIMIT_EXCEEDED]: 'validation_error_amount_dailyLimit'
};

/**
 * Creates a validator function for bridge estimation errors.
 * @param {BridgeEstimation[]|null} estimations - The estimations to validate.
 * @param {boolean} hasEstimationFailed - Whether the last estimation request failed outright.
 * @returns {() => string|{key: string, params: object}|undefined} Validator function returning
 * an error key (optionally with message parameters) or undefined.
 */
export const validateEstimation = (estimations, hasEstimationFailed) => () => {
	if (hasEstimationFailed)
		return 'validation_error_estimation_unavailable';

	const errors = (estimations ?? [])
		.map(estimation => estimation.error)
		.filter(Boolean);
	const errorCodes = errors.map(error => error.code);
	const errorCode = estimationErrorPriority.find(code => errorCodes.includes(code));

	if (errorCode === BridgeEstimationErrorCode.INSUFFICIENT_LIQUIDITY)
		return createInsufficientLiquidityResult(errors);

	return estimationErrorTranslationKeyMap[errorCode];
};

/**
 * Builds the insufficient-liquidity validation result. Includes the maximum amount that can be sent
 * when the estimation provides it, truncated down so the message never suggests more than is available.
 * @param {Array} errors - Estimation errors collected from all steps.
 * @returns {string|{key: string, params: object}} Error key, with message parameters when available.
 */
const createInsufficientLiquidityResult = errors => {
	const insufficientLiquidityError = errors.find(error => error.code === BridgeEstimationErrorCode.INSUFFICIENT_LIQUIDITY);
	const params = insufficientLiquidityError?.params;

	if (!params?.maxAmount)
		return 'validation_error_insufficientLiquidity_generic';

	return {
		key: 'validation_error_insufficientLiquidity',
		params: {
			...params,
			maxAmount: formatAmountInput(params.maxAmount, MAX_AMOUNT_DISPLAY_DECIMALS)
		}
	};
};

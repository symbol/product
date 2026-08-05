import { validateEstimation } from '@/app/screens/bridge/utils/validators';
import { constants } from 'wallet-common-core';

const { BridgeEstimationErrorCode } = constants;

// Screen Text

const SCREEN_TEXT = {
	textAmountLow: 'validation_error_amount_low',
	textTransferLimit: 'validation_error_amount_transferLimit',
	textDailyLimit: 'validation_error_amount_dailyLimit',
	textEstimationUnavailable: 'validation_error_estimation_unavailable',
	textInsufficientLiquidity: 'validation_error_insufficientLiquidity',
	textInsufficientLiquidityGeneric: 'validation_error_insufficientLiquidity_generic'
};

// Fixtures

const maxSwappableAmount = '0.235399146392349099';
const maxSwappableAmountTruncated = '0.235399';
const sourceTokenTicker = 'ETH';

const createEstimation = (receiveAmount = '10') => ({ receiveAmount, bridgeFee: '1', error: null });

const createFailedEstimation = (code, params) => ({
	receiveAmount: null,
	bridgeFee: null,
	error: { code, ...(params && { params }) }
});

describe('screens/bridge/utils/validators', () => {
	describe('validateEstimation', () => {
		const runValidateEstimationTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const validator = validateEstimation(config.estimations, config.hasEstimationFailed);

				// Act:
				const result = validator();

				// Assert:
				expect(result).toStrictEqual(expected.errorKey);
			});
		};

		const validateEstimationTests = [
			{
				description: 'returns no error when there are no estimations yet',
				config: { estimations: null, hasEstimationFailed: false },
				expected: { errorKey: undefined }
			},
			{
				description: 'returns no error when the estimation list is empty',
				config: { estimations: [], hasEstimationFailed: false },
				expected: { errorKey: undefined }
			},
			{
				description: 'returns no error when every step estimated successfully',
				config: { estimations: [createEstimation(), createEstimation('9')], hasEstimationFailed: false },
				expected: { errorKey: undefined }
			},
			{
				description: 'returns the amount low error when the amount does not cover the bridge fee',
				config: {
					estimations: [createFailedEstimation(BridgeEstimationErrorCode.AMOUNT_LOW)],
					hasEstimationFailed: false
				},
				expected: { errorKey: SCREEN_TEXT.textAmountLow }
			},
			{
				description: 'returns the transfer limit error when the per-transfer cap is exceeded',
				config: {
					estimations: [createFailedEstimation(BridgeEstimationErrorCode.REQUEST_LIMIT_EXCEEDED)],
					hasEstimationFailed: false
				},
				expected: { errorKey: SCREEN_TEXT.textTransferLimit }
			},
			{
				description: 'returns the daily limit error when the daily cap is exceeded',
				config: {
					estimations: [createFailedEstimation(BridgeEstimationErrorCode.DAILY_LIMIT_EXCEEDED)],
					hasEstimationFailed: false
				},
				expected: { errorKey: SCREEN_TEXT.textDailyLimit }
			},
			{
				description: 'returns the error of a failed step when an earlier step succeeded',
				config: {
					estimations: [createEstimation(), createFailedEstimation(BridgeEstimationErrorCode.DAILY_LIMIT_EXCEEDED)],
					hasEstimationFailed: false
				},
				expected: { errorKey: SCREEN_TEXT.textDailyLimit }
			},
			{
				description: 'prefers the amount low error over the transfer limit error',
				config: {
					estimations: [
						createFailedEstimation(BridgeEstimationErrorCode.REQUEST_LIMIT_EXCEEDED),
						createFailedEstimation(BridgeEstimationErrorCode.AMOUNT_LOW)
					],
					hasEstimationFailed: false
				},
				expected: { errorKey: SCREEN_TEXT.textAmountLow }
			},
			{
				description: 'prefers the transfer limit error over the daily limit error',
				config: {
					estimations: [
						createFailedEstimation(BridgeEstimationErrorCode.DAILY_LIMIT_EXCEEDED),
						createFailedEstimation(BridgeEstimationErrorCode.REQUEST_LIMIT_EXCEEDED)
					],
					hasEstimationFailed: false
				},
				expected: { errorKey: SCREEN_TEXT.textTransferLimit }
			},
			{
				description: 'returns the insufficient liquidity error with a truncated max amount and ticker',
				config: {
					estimations: [createFailedEstimation(
						BridgeEstimationErrorCode.INSUFFICIENT_LIQUIDITY,
						{ maxAmount: maxSwappableAmount, ticker: sourceTokenTicker }
					)],
					hasEstimationFailed: false
				},
				expected: {
					errorKey: {
						key: SCREEN_TEXT.textInsufficientLiquidity,
						params: { maxAmount: maxSwappableAmountTruncated, ticker: sourceTokenTicker }
					}
				}
			},
			{
				description: 'returns the generic insufficient liquidity error when the max amount is unknown',
				config: {
					estimations: [createFailedEstimation(BridgeEstimationErrorCode.INSUFFICIENT_LIQUIDITY)],
					hasEstimationFailed: false
				},
				expected: { errorKey: SCREEN_TEXT.textInsufficientLiquidityGeneric }
			},
			{
				description: 'prefers the insufficient liquidity error over any other failing step',
				config: {
					estimations: [
						createFailedEstimation(BridgeEstimationErrorCode.AMOUNT_LOW),
						createFailedEstimation(BridgeEstimationErrorCode.INSUFFICIENT_LIQUIDITY)
					],
					hasEstimationFailed: false
				},
				expected: { errorKey: SCREEN_TEXT.textInsufficientLiquidityGeneric }
			},
			{
				description: 'returns the unavailable error when the estimation request failed outright',
				config: { estimations: null, hasEstimationFailed: true },
				expected: { errorKey: SCREEN_TEXT.textEstimationUnavailable }
			},
			{
				description: 'prefers the unavailable error over a stale estimation error',
				config: {
					estimations: [createFailedEstimation(BridgeEstimationErrorCode.AMOUNT_LOW)],
					hasEstimationFailed: true
				},
				expected: { errorKey: SCREEN_TEXT.textEstimationUnavailable }
			}
		];

		validateEstimationTests.forEach(test => {
			runValidateEstimationTest(test.description, test.config, test.expected);
		});
	});
});

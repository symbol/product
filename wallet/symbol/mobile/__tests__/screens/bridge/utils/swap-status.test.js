import { BridgePayoutStatus, BridgeRequestStatus } from '@/app/screens/bridge/types/Bridge';
import { getSwapStatus, getSwapStatusCaption } from '@/app/screens/bridge/utils/swap-status';
import { mockLocalization } from '__tests__/mock-helpers';

// Screen Text

const SCREEN_TEXT = {
	textStatusUnprocessed: 's_bridge_history_status_unprocessed',
	textStatusProcessing: 's_bridge_history_status_processing',
	textStatusSent: 's_bridge_history_status_sent',
	textStatusCompleted: 's_bridge_history_status_completed',
	textStatusFailed: 's_bridge_history_status_failed',
	textRequestTransactionConfirmed: 's_bridge_history_requestTransactionConfirmed'
};

// Icon Names

const IconName = {
	PENDING: 'pending',
	SEND_PLANE: 'send-plane',
	CHECK_CIRCLE: 'check-circle',
	ALERT_DANGER: 'alert-danger'
};

// Variants

const Variant = {
	WARNING: 'warning',
	SUCCESS: 'success',
	DANGER: 'danger'
};

// Constants

const ERROR_MESSAGE = 'Bridge processing error';

describe('screens/bridge/utils/swap-status', () => {
	beforeEach(() => {
		mockLocalization();
	});

	describe('getSwapStatus', () => {
		describe('request status only', () => {
			const runRequestStatusTest = (description, config, expected) => {
				it(description, () => {
					// Act:
					const result = getSwapStatus(config.requestStatus, config.payoutStatus);

					// Assert:
					expect(result.variant).toBe(expected.variant);
					expect(result.iconName).toBe(expected.iconName);
					expect(result.text).toBe(expected.text);
				});
			};

			const requestStatusTests = [
				{
					description: 'returns unprocessed status when request is confirmed without payout',
					config: {
						requestStatus: BridgeRequestStatus.CONFIRMED
					},
					expected: {
						variant: Variant.WARNING,
						iconName: IconName.PENDING,
						text: SCREEN_TEXT.textStatusUnprocessed
					}
				},
				{
					description: 'returns failed status when request has error',
					config: {
						requestStatus: BridgeRequestStatus.ERROR
					},
					expected: {
						variant: Variant.DANGER,
						iconName: IconName.ALERT_DANGER,
						text: SCREEN_TEXT.textStatusFailed
					}
				}
			];

			requestStatusTests.forEach(test => {
				runRequestStatusTest(test.description, test.config, test.expected);
			});
		});

		describe('payout status', () => {
			const runPayoutStatusTest = (description, config, expected) => {
				it(description, () => {
					// Act:
					const result = getSwapStatus(config.requestStatus, config.payoutStatus);

					// Assert:
					expect(result.variant).toBe(expected.variant);
					expect(result.iconName).toBe(expected.iconName);
					expect(result.text).toBe(expected.text);
				});
			};

			const payoutStatusTests = [
				{
					description: 'returns processing status when payout is unprocessed',
					config: {
						requestStatus: BridgeRequestStatus.CONFIRMED,
						payoutStatus: BridgePayoutStatus.UNPROCESSED
					},
					expected: {
						variant: Variant.WARNING,
						iconName: IconName.PENDING,
						text: SCREEN_TEXT.textStatusProcessing
					}
				},
				{
					description: 'returns sent status when payout is sent',
					config: {
						requestStatus: BridgeRequestStatus.CONFIRMED,
						payoutStatus: BridgePayoutStatus.SENT
					},
					expected: {
						variant: Variant.WARNING,
						iconName: IconName.SEND_PLANE,
						text: SCREEN_TEXT.textStatusSent
					}
				},
				{
					description: 'returns completed status when payout is completed',
					config: {
						requestStatus: BridgeRequestStatus.CONFIRMED,
						payoutStatus: BridgePayoutStatus.COMPLETED
					},
					expected: {
						variant: Variant.SUCCESS,
						iconName: IconName.CHECK_CIRCLE,
						text: SCREEN_TEXT.textStatusCompleted
					}
				},
				{
					description: 'returns failed status when payout has failed',
					config: {
						requestStatus: BridgeRequestStatus.CONFIRMED,
						payoutStatus: BridgePayoutStatus.FAILED
					},
					expected: {
						variant: Variant.DANGER,
						iconName: IconName.ALERT_DANGER,
						text: SCREEN_TEXT.textStatusFailed
					}
				}
			];

			payoutStatusTests.forEach(test => {
				runPayoutStatusTest(test.description, test.config, test.expected);
			});
		});
	});

	describe('getSwapStatusCaption', () => {
		const runCaptionTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const data = {
					requestStatus: config.requestStatus,
					errorMessage: config.errorMessage
				};

				// Act:
				const result = getSwapStatusCaption(data);

				// Assert:
				expect(result.isVisible).toBe(expected.isVisible);
				expect(result.text).toBe(expected.text);
				expect(result.textStyle).toBe(expected.textStyle);
				expect(result.textType).toBe(expected.textType);
			});
		};

		const captionTests = [
			{
				description: 'returns confirmed caption when request is confirmed',
				config: {
					requestStatus: BridgeRequestStatus.CONFIRMED,
					errorMessage: null
				},
				expected: {
					isVisible: true,
					text: SCREEN_TEXT.textRequestTransactionConfirmed,
					textStyle: 'regular',
					textType: 'body'
				}
			},
			{
				description: 'returns error caption with message when request has error',
				config: {
					requestStatus: BridgeRequestStatus.ERROR,
					errorMessage: ERROR_MESSAGE
				},
				expected: {
					isVisible: true,
					text: ERROR_MESSAGE,
					textStyle: 'error',
					textType: 'label'
				}
			},
			{
				description: 'returns hidden caption when request is unconfirmed',
				config: {
					requestStatus: BridgeRequestStatus.UNCONFIRMED,
					errorMessage: null
				},
				expected: {
					isVisible: false,
					text: null,
					textStyle: null,
					textType: null
				}
			}
		];

		captionTests.forEach(test => {
			runCaptionTest(test.description, test.config, test.expected);
		});
	});
});

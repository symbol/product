import { BridgePayoutStatus, BridgeRequestStatus } from '@/app/screens/bridge/types/Bridge';
import { createSwapStatusDisplayData } from '@/app/screens/bridge/utils/swap-status';
import { mockLocalization } from '__tests__/mock-helpers';

// Screen Text

const SCREEN_TEXT = {
	textStatusUnprocessed: 's_bridge_history_status_unprocessed',
	textStatusProcessing: 's_bridge_history_status_processing',
	textStatusSent: 's_bridge_history_status_sent',
	textStatusCompleted: 's_bridge_history_status_completed',
	textStatusFailed: 's_bridge_history_status_failed'
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

describe('screens/bridge/utils/swap-status', () => {
	beforeEach(() => {
		mockLocalization();
	});

	describe('createSwapStatusDisplayData', () => {
		describe('request status only', () => {
			const runRequestStatusTest = (description, config, expected) => {
				it(description, () => {
					// Act:
					const result = createSwapStatusDisplayData(config.requestStatus, config.payoutStatus);

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
					const result = createSwapStatusDisplayData(config.requestStatus, config.payoutStatus);

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
});

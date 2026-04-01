import { ActivityStatus } from '@/app/constants';
import { BridgePayoutStatus, BridgeRequestStatus } from '@/app/screens/bridge/types/Bridge';
import { buildActivityLog } from '@/app/screens/bridge/utils/activity-log';
import { formatDate } from '@/app/utils';
import { mockLocalization } from '__tests__/mock-helpers';

// Constants

const REQUEST_TIMESTAMP = 1684265310994;
const PAYOUT_TIMESTAMP = 1684351710994;
const ERROR_MESSAGE = 'Bridge processing error';

// Screen Text

const SCREEN_TEXT = {
	textStepRequestSend: 's_bridge_swapStatus_step_requestSend',
	textStepAwaitingBridge: 's_bridge_swapStatus_step_awaitingBridge',
	textStepPayoutSend: 's_bridge_swapStatus_step_payoutSend',
	textStepPayoutConfirmation: 's_bridge_swapStatus_step_payoutConfirmation',
	textRequestDateValue: formatDate(REQUEST_TIMESTAMP, key => key, true),
	textPayoutDateValue: formatDate(PAYOUT_TIMESTAMP, key => key, true)
};

// Icon Names

const IconName = {
	SEND_PLANE: 'send-plane',
	PENDING: 'pending',
	SWAP: 'swap',
	CHECK: 'check'
};

describe('screens/bridge/utils/activity-log', () => {
	beforeEach(() => {
		mockLocalization();
	});

	describe('buildActivityLog', () => {
		describe('activity log structure', () => {
			it('returns array with four activity log items', () => {
				// Arrange:
				const params = {
					requestStatus: BridgeRequestStatus.CONFIRMED,
					payoutStatus: BridgePayoutStatus.COMPLETED
				};

				// Act:
				const result = buildActivityLog(params);

				// Assert:
				expect(result).toHaveLength(4);
			});

			it('returns items with correct titles', () => {
				// Arrange:
				const params = {
					requestStatus: BridgeRequestStatus.CONFIRMED,
					payoutStatus: BridgePayoutStatus.COMPLETED
				};

				// Act:
				const result = buildActivityLog(params);

				// Assert:
				expect(result[0].title).toBe(SCREEN_TEXT.textStepRequestSend);
				expect(result[1].title).toBe(SCREEN_TEXT.textStepAwaitingBridge);
				expect(result[2].title).toBe(SCREEN_TEXT.textStepPayoutSend);
				expect(result[3].title).toBe(SCREEN_TEXT.textStepPayoutConfirmation);
			});

			it('returns items with correct icons', () => {
				// Arrange:
				const params = {
					requestStatus: BridgeRequestStatus.CONFIRMED,
					payoutStatus: BridgePayoutStatus.COMPLETED
				};

				// Act:
				const result = buildActivityLog(params);

				// Assert:
				expect(result[0].icon).toBe(IconName.SEND_PLANE);
				expect(result[1].icon).toBe(IconName.PENDING);
				expect(result[2].icon).toBe(IconName.SWAP);
				expect(result[3].icon).toBe(IconName.CHECK);
			});
		});

		describe('status transitions', () => {
			const runStatusTest = (description, config, expected) => {
				it(description, () => {
					// Arrange:
					const params = {
						requestStatus: config.requestStatus,
						payoutStatus: config.payoutStatus,
						requestTimestamp: config.requestTimestamp,
						payoutTimestamp: config.payoutTimestamp,
						errorMessage: config.errorMessage
					};

					// Act:
					const result = buildActivityLog(params);

					// Assert:
					expect(result[0].status).toBe(expected.requestSendStatus);
					expect(result[1].status).toBe(expected.awaitingBridgeStatus);
					expect(result[2].status).toBe(expected.payoutSendStatus);
					expect(result[3].status).toBe(expected.payoutConfirmationStatus);
				});
			};

			const statusTests = [
				{
					description: 'all steps complete when payout is completed',
					config: {
						requestStatus: BridgeRequestStatus.CONFIRMED,
						payoutStatus: BridgePayoutStatus.COMPLETED
					},
					expected: {
						requestSendStatus: ActivityStatus.COMPLETE,
						awaitingBridgeStatus: ActivityStatus.COMPLETE,
						payoutSendStatus: ActivityStatus.COMPLETE,
						payoutConfirmationStatus: ActivityStatus.COMPLETE
					}
				},
				{
					description: 'payout confirmation loading when payout is sent',
					config: {
						requestStatus: BridgeRequestStatus.CONFIRMED,
						payoutStatus: BridgePayoutStatus.SENT
					},
					expected: {
						requestSendStatus: ActivityStatus.COMPLETE,
						awaitingBridgeStatus: ActivityStatus.COMPLETE,
						payoutSendStatus: ActivityStatus.COMPLETE,
						payoutConfirmationStatus: ActivityStatus.LOADING
					}
				},
				{
					description: 'payout send loading when payout is unprocessed',
					config: {
						requestStatus: BridgeRequestStatus.CONFIRMED,
						payoutStatus: BridgePayoutStatus.UNPROCESSED
					},
					expected: {
						requestSendStatus: ActivityStatus.COMPLETE,
						awaitingBridgeStatus: ActivityStatus.COMPLETE,
						payoutSendStatus: ActivityStatus.LOADING,
						payoutConfirmationStatus: ActivityStatus.PENDING
					}
				},
				{
					description: 'awaiting bridge loading when request is confirmed',
					config: {
						requestStatus: BridgeRequestStatus.CONFIRMED,
						payoutStatus: undefined
					},
					expected: {
						requestSendStatus: ActivityStatus.COMPLETE,
						awaitingBridgeStatus: ActivityStatus.LOADING,
						payoutSendStatus: ActivityStatus.PENDING,
						payoutConfirmationStatus: ActivityStatus.PENDING
					}
				},
				{
					description: 'awaiting bridge error when request fails',
					config: {
						requestStatus: BridgeRequestStatus.ERROR,
						payoutStatus: undefined,
						errorMessage: ERROR_MESSAGE
					},
					expected: {
						requestSendStatus: ActivityStatus.COMPLETE,
						awaitingBridgeStatus: ActivityStatus.ERROR,
						payoutSendStatus: ActivityStatus.PENDING,
						payoutConfirmationStatus: ActivityStatus.PENDING
					}
				},
				{
					description: 'payout send error when payout fails',
					config: {
						requestStatus: BridgeRequestStatus.CONFIRMED,
						payoutStatus: BridgePayoutStatus.FAILED,
						errorMessage: ERROR_MESSAGE
					},
					expected: {
						requestSendStatus: ActivityStatus.COMPLETE,
						awaitingBridgeStatus: ActivityStatus.COMPLETE,
						payoutSendStatus: ActivityStatus.ERROR,
						payoutConfirmationStatus: ActivityStatus.PENDING
					}
				}
			];

			statusTests.forEach(test => {
				runStatusTest(test.description, test.config, test.expected);
			});
		});

		describe('timestamps', () => {
			it('formats request timestamp when provided', () => {
				// Arrange:
				const params = {
					requestStatus: BridgeRequestStatus.CONFIRMED,
					payoutStatus: BridgePayoutStatus.COMPLETED,
					requestTimestamp: REQUEST_TIMESTAMP
				};

				// Act:
				const result = buildActivityLog(params);

				// Assert:
				expect(result[0].caption).toBe(SCREEN_TEXT.textRequestDateValue);
			});

			it('formats payout timestamp when provided', () => {
				// Arrange:
				const params = {
					requestStatus: BridgeRequestStatus.CONFIRMED,
					payoutStatus: BridgePayoutStatus.COMPLETED,
					payoutTimestamp: PAYOUT_TIMESTAMP
				};

				// Act:
				const result = buildActivityLog(params);

				// Assert:
				expect(result[3].caption).toBe(SCREEN_TEXT.textPayoutDateValue);
			});

			it('returns empty caption when request timestamp not provided', () => {
				// Arrange:
				const params = {
					requestStatus: BridgeRequestStatus.CONFIRMED,
					payoutStatus: BridgePayoutStatus.COMPLETED
				};

				// Act:
				const result = buildActivityLog(params);

				// Assert:
				expect(result[0].caption).toBe('');
			});

			it('returns empty caption when payout timestamp not provided', () => {
				// Arrange:
				const params = {
					requestStatus: BridgeRequestStatus.CONFIRMED,
					payoutStatus: BridgePayoutStatus.COMPLETED
				};

				// Act:
				const result = buildActivityLog(params);

				// Assert:
				expect(result[3].caption).toBe('');
			});
		});
	});
});

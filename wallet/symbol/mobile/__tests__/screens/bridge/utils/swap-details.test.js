import { ActivityStatus } from '@/app/constants';
import { BridgePayoutStatus, BridgeRequestStatus } from '@/app/screens/bridge/types/Bridge';
import { buildActivityLog, createSwapDetailsViewModel } from '@/app/screens/bridge/utils/swap-details';
import { formatDate } from '@/app/utils';
import { AccountFixtureBuilder } from '__fixtures__/local/AccountFixtureBuilder';
import { TokenFixtureBuilder } from '__fixtures__/local/TokenFixtureBuilder';
import { createWalletControllerMock, mockLocalization } from '__tests__/mock-helpers';

// Constants

const CHAIN_NAME_SYMBOL = 'symbol';
const CHAIN_NAME_ETHEREUM = 'ethereum';
const NETWORK_IDENTIFIER = 'testnet';
const REQUEST_TRANSACTION_HASH = 'ABC123DEF456789REQUEST';
const PAYOUT_TRANSACTION_HASH = '0xPAYOUT789ABC123DEF';
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
	textPayoutDateValue: formatDate(PAYOUT_TIMESTAMP, key => key, true),
	textStatusCompleted: 's_bridge_history_status_completed',
	textStatusProcessing: 's_bridge_history_status_processing',
	textStatusFailed: 's_bridge_history_status_failed'
};

// Icon Names

const IconName = {
	SEND_PLANE: 'send-plane',
	PENDING: 'pending',
	SWAP: 'swap',
	CHECK: 'check'
};

// Account Fixtures

const symbolAccount = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME_SYMBOL, NETWORK_IDENTIFIER, 0)
	.build();

const ethereumAccount = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME_ETHEREUM, NETWORK_IDENTIFIER, 0)
	.build();

// Token Fixtures

const tokenXym = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME_SYMBOL, NETWORK_IDENTIFIER, 0)
	.build();

const tokenBxym = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME_ETHEREUM, NETWORK_IDENTIFIER, 1)
	.build();

// Wallet Controller Fixtures

// Each controller holds its chain's account, so the side accounts resolve to their wallet names
const symbolWalletController = createWalletControllerMock({
	chainName: CHAIN_NAME_SYMBOL,
	networkIdentifier: NETWORK_IDENTIFIER,
	accounts: { [NETWORK_IDENTIFIER]: [symbolAccount] }
});

const ethereumWalletController = createWalletControllerMock({
	chainName: CHAIN_NAME_ETHEREUM,
	networkIdentifier: NETWORK_IDENTIFIER,
	accounts: { [NETWORK_IDENTIFIER]: [ethereumAccount] }
});

// Bridge Request Fixtures

const createBridgeRequest = (overrides = {}) => ({
	sourceChainName: CHAIN_NAME_SYMBOL,
	targetChainName: CHAIN_NAME_ETHEREUM,
	sourceTokenInfo: tokenXym,
	targetTokenInfo: tokenBxym,
	requestStatus: BridgeRequestStatus.CONFIRMED,
	payoutStatus: BridgePayoutStatus.COMPLETED,
	requestTransaction: {
		hash: REQUEST_TRANSACTION_HASH,
		timestamp: REQUEST_TIMESTAMP,
		signerAddress: symbolAccount.address,
		token: { amount: '100' }
	},
	payoutTransaction: {
		hash: PAYOUT_TRANSACTION_HASH,
		timestamp: PAYOUT_TIMESTAMP,
		recipientAddress: ethereumAccount.address,
		token: { amount: '99' }
	},
	errorMessage: null,
	...overrides
});

const requestCompleted = createBridgeRequest();

const requestWithoutPayout = createBridgeRequest({
	payoutStatus: BridgePayoutStatus.UNPROCESSED,
	payoutTransaction: null
});

const requestFailed = createBridgeRequest({
	requestStatus: BridgeRequestStatus.ERROR,
	payoutStatus: undefined,
	payoutTransaction: null,
	errorMessage: ERROR_MESSAGE
});

// Expected Sides

const expectedSourceSide = {
	chainName: CHAIN_NAME_SYMBOL,
	networkIdentifier: NETWORK_IDENTIFIER,
	token: { name: 'Symbol', ticker: 'XYM', imageId: 'xym', amount: '100' },
	account: { address: symbolAccount.address, name: symbolAccount.name, imageId: null },
	transactionHash: REQUEST_TRANSACTION_HASH
};

const expectedTargetSide = {
	chainName: CHAIN_NAME_ETHEREUM,
	networkIdentifier: NETWORK_IDENTIFIER,
	token: { name: 'Bridged XYM', ticker: 'bXYM', imageId: 'bxym', amount: '99' },
	account: { address: ethereumAccount.address, name: ethereumAccount.name, imageId: null },
	transactionHash: PAYOUT_TRANSACTION_HASH
};

const expectedTargetSideWithoutPayout = {
	...expectedTargetSide,
	token: { ...expectedTargetSide.token, amount: null },
	account: null,
	transactionHash: null
};

describe('screens/bridge/utils/swap-details', () => {
	beforeEach(() => {
		mockLocalization();
	});

	describe('createSwapDetailsViewModel()', () => {
		const runCreateSwapDetailsViewModelTest = (description, config, expected) => {
			it(description, () => {
				// Act:
				const result = createSwapDetailsViewModel({
					request: config.request,
					sourceWalletController: symbolWalletController,
					targetWalletController: ethereumWalletController
				});

				// Assert:
				expect(result.status).toStrictEqual(expected.status);
				expect(result.source).toStrictEqual(expected.source);
				expect(result.target).toStrictEqual(expected.target);
				expect(result.activityLog.map(item => item.status)).toStrictEqual(expected.activityLogStatuses);
			});
		};

		const createSwapDetailsViewModelTests = [
			{
				description: 'resolves both sides and a complete activity log for a completed swap',
				config: { request: requestCompleted },
				expected: {
					status: { variant: 'success', iconName: 'check-circle', text: SCREEN_TEXT.textStatusCompleted },
					source: expectedSourceSide,
					target: expectedTargetSide,
					activityLogStatuses: [
						ActivityStatus.COMPLETE,
						ActivityStatus.COMPLETE,
						ActivityStatus.COMPLETE,
						ActivityStatus.COMPLETE
					]
				}
			},
			{
				description: 'leaves the target account, hash and amount empty before the payout exists',
				config: { request: requestWithoutPayout },
				expected: {
					status: { variant: 'warning', iconName: 'pending', text: SCREEN_TEXT.textStatusProcessing },
					source: expectedSourceSide,
					target: expectedTargetSideWithoutPayout,
					activityLogStatuses: [
						ActivityStatus.COMPLETE,
						ActivityStatus.COMPLETE,
						ActivityStatus.LOADING,
						ActivityStatus.PENDING
					]
				}
			},
			{
				description: 'marks the bridge step as failed for a rejected request',
				config: { request: requestFailed },
				expected: {
					status: { variant: 'danger', iconName: 'alert-danger', text: SCREEN_TEXT.textStatusFailed },
					source: expectedSourceSide,
					target: expectedTargetSideWithoutPayout,
					activityLogStatuses: [
						ActivityStatus.COMPLETE,
						ActivityStatus.ERROR,
						ActivityStatus.PENDING,
						ActivityStatus.PENDING
					]
				}
			}
		];

		createSwapDetailsViewModelTests.forEach(test =>
			runCreateSwapDetailsViewModelTest(test.description, test.config, test.expected));
	});

	describe('buildActivityLog()', () => {
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

import { ActivityStatus } from '@/app/constants';
import { BridgeTransactionWorkflowStatus } from '@/app/screens/bridge/constants';
import { createTransactionProgressViewModel } from '@/app/screens/bridge/utils/transaction-progress';
import { TokenFixtureBuilder } from '__fixtures__/local/TokenFixtureBuilder';
import { mockLocalization } from '__tests__/mock-helpers';

// Mocks

const mockCreateStandardTransactionProgressViewModel = jest.fn();

jest.mock('@/app/components/templates/TransactionScreenTemplate/utils', () => ({
	createTransactionProgressViewModel: (...args) => mockCreateStandardTransactionProgressViewModel(...args)
}));

// Constants

const CHAIN_NAME_SYMBOL = 'symbol';
const CHAIN_NAME_ETHEREUM = 'ethereum';
const NETWORK_IDENTIFIER = 'testnet';
const HASH_STEP_1 = 'hash-step-1';
const HASH_STEP_2 = 'hash-step-2';
const ERROR_MESSAGE = 'Signing failed';
const UNKNOWN_TOKEN_TEXT = 'unknown';
const UNKNOWN_STATUS = 'unknown-status';

// Tickers resolved from the known-tokens configuration
const TICKER_XYM = 'XYM';
const TICKER_ETH = 'ETH';
const TICKER_BXYM = 'bXYM';

const { PENDING, LOADING, COMPLETE, ERROR } = ActivityStatus;

// Icons of the seven log items; the confirm items show 'cross' instead of 'check' once a transaction fails
const LOG_ICONS = ['plus', 'sign', 'send-plane', 'check', 'sign', 'send-plane', 'check'];
const LOG_ICONS_STEP_1_FAILED = ['plus', 'sign', 'send-plane', 'cross', 'sign', 'send-plane', 'check'];

// Text Keys

const TEXT_KEY = {
	statusUnknownTitle: 'c_bridgeTransactionStatus_status_unknown_title',
	statusUnknownDescription: 'c_bridgeTransactionStatus_status_unknown_description',
	statusSendingTitle: 'c_bridgeTransactionStatus_status_sending_title',
	statusSendingDescription: 'c_bridgeTransactionStatus_status_sending_description',
	statusStepSendingDescription: 'c_bridgeTransactionStatus_status_step_sending_description',
	statusCreateErrorTitle: 'c_bridgeTransactionStatus_status_createError_title',
	statusCreateErrorDescription: 'c_bridgeTransactionStatus_status_createError_description',
	statusSignErrorTitle: 'c_bridgeTransactionStatus_status_signError_title',
	statusSignErrorDescription: 'c_bridgeTransactionStatus_status_signError_description',
	statusAnnounceErrorTitle: 'c_bridgeTransactionStatus_status_announceError_title',
	statusAnnounceErrorDescription: 'c_bridgeTransactionStatus_status_announceError_description',
	statusFailedTransactionTitle: 'c_bridgeTransactionStatus_status_failedTransaction_title',
	statusFailedTransactionDescription: 'c_bridgeTransactionStatus_status_failedTransaction_description',
	statusConfirmingTitle: 'c_bridgeTransactionStatus_status_confirming_title',
	statusConfirmingDescription: 'c_bridgeTransactionStatus_status_confirming_description',
	statusConfirmedTitle: 'c_bridgeTransactionStatus_status_confirmed_title',
	statusConfirmedDescription: 'c_bridgeTransactionStatus_status_confirmed_description',
	stepCreate: 'c_bridgeTransactionStatus_step_create',
	stepSign: 'c_bridgeTransactionStatus_step_sign',
	stepAnnounce: 'c_bridgeTransactionStatus_step_announce',
	stepConfirm: 'c_bridgeTransactionStatus_step_confirm'
};

// The localization mock echoes the key and, when given, its params
const createText = (key, params) => (params ? `${key}|${JSON.stringify(params)}` : key);

// Token Fixtures

const tokenXym = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME_SYMBOL, NETWORK_IDENTIFIER, 0)
	.build();

const tokenEth = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME_ETHEREUM, NETWORK_IDENTIFIER, 0)
	.build();

const tokenBxym = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME_ETHEREUM, NETWORK_IDENTIFIER, 1)
	.build();

// Workflow Meta Fixtures (XYM -> ETH: bridge step on symbol, then swap step on ethereum)

const createMetaSide = (tokenInfo, chainName) => ({
	tokenInfo,
	chainName,
	networkIdentifier: NETWORK_IDENTIFIER
});

const dualStepMeta = {
	step1: {
		source: createMetaSide(tokenXym, CHAIN_NAME_SYMBOL),
		target: createMetaSide(tokenBxym, CHAIN_NAME_ETHEREUM)
	},
	step2: {
		source: createMetaSide(tokenBxym, CHAIN_NAME_ETHEREUM),
		target: createMetaSide(tokenEth, CHAIN_NAME_ETHEREUM)
	}
};

const metaWithUnknownStep2Target = {
	step1: dualStepMeta.step1,
	step2: {
		source: dualStepMeta.step2.source,
		target: createMetaSide(null, CHAIN_NAME_ETHEREUM)
	}
};

// Token pairs as passed to the step texts
const pairStep1 = { from: TICKER_XYM, to: TICKER_BXYM };
const pairStep2 = { from: TICKER_BXYM, to: TICKER_ETH };

// Manager Fixtures

const createManager = ({ isLoading = false, isCompleted = false, error = null } = {}) => ({
	isLoading,
	isCompleted,
	error
});

const managerPending = createManager();
const managerLoading = createManager({ isLoading: true });
const managerCompleted = createManager({ isCompleted: true });
const managerFailed = createManager({ error: new Error(ERROR_MESSAGE) });

const step1ManagersCompleted = {
	createManager1: managerCompleted,
	signManager1: managerCompleted,
	announceManager1: managerCompleted
};

// Workflow Fixtures

const createDualStepWorkflow = ({
	status = BridgeTransactionWorkflowStatus.IDLE,
	isSending = false,
	meta = dualStepMeta,
	managers = {},
	hash = {}
} = {}) => ({
	steps: 2,
	status,
	isSending,
	meta,
	managers: {
		createManager1: managerPending,
		signManager1: managerPending,
		announceManager1: managerPending,
		createManager2: managerPending,
		signManager2: managerPending,
		announceManager2: managerPending,
		...managers
	},
	hash: {
		signed1: [],
		confirmed1: [],
		failed1: [],
		partial1: [],
		signed2: [],
		confirmed2: [],
		failed2: [],
		partial2: [],
		...hash
	}
});

const workflowIdle = createDualStepWorkflow();

// Step 1 announced, waiting for its confirmation
const workflowStep1Announced = createDualStepWorkflow({
	managers: step1ManagersCompleted,
	hash: { signed1: [HASH_STEP_1] }
});

// Step 1 confirmed, step 2 being signed
const workflowStep2Signing = createDualStepWorkflow({
	managers: { ...step1ManagersCompleted, signManager2: managerLoading },
	hash: { signed1: [HASH_STEP_1], confirmed1: [HASH_STEP_1] }
});

// Step 1 announced, rejected by the network
const workflowStep1Failed = createDualStepWorkflow({
	managers: step1ManagersCompleted,
	hash: { signed1: [HASH_STEP_1], failed1: [HASH_STEP_1] }
});

// Step 1 signing failed
const workflowSignError1 = createDualStepWorkflow({
	managers: { createManager1: managerCompleted, signManager1: managerFailed }
});

// Both steps confirmed
const workflowCompleted = createDualStepWorkflow({
	managers: {
		...step1ManagersCompleted,
		createManager2: managerCompleted,
		signManager2: managerCompleted,
		announceManager2: managerCompleted
	},
	hash: {
		signed1: [HASH_STEP_1],
		confirmed1: [HASH_STEP_1],
		signed2: [HASH_STEP_2],
		confirmed2: [HASH_STEP_2]
	}
});

// Expected Status Info

const createExpectedStatusInfo = (icon, variant, titleKey, descriptionKey, pair) => ({
	icon,
	variant,
	title: createText(titleKey),
	description: createText(descriptionKey, pair)
});

const createStepSendingStatusInfo = pair =>
	createExpectedStatusInfo('pending', 'warning', TEXT_KEY.statusSendingTitle, TEXT_KEY.statusStepSendingDescription, pair);

const createErrorStatusInfo = (titleKey, descriptionKey, pair) =>
	createExpectedStatusInfo('cross-circle', 'danger', titleKey, descriptionKey, pair);

const statusInfoUnknown = createExpectedStatusInfo(
	'question-circle',
	'neutral',
	TEXT_KEY.statusUnknownTitle,
	TEXT_KEY.statusUnknownDescription
);
const statusInfoSending = createExpectedStatusInfo(
	'pending',
	'warning',
	TEXT_KEY.statusSendingTitle,
	TEXT_KEY.statusSendingDescription
);
const statusInfoStep1Sending = createStepSendingStatusInfo(pairStep1);
const statusInfoStep2Sending = createStepSendingStatusInfo(pairStep2);
const statusInfoCreateError = createErrorStatusInfo(TEXT_KEY.statusCreateErrorTitle, TEXT_KEY.statusCreateErrorDescription);
const statusInfoSignError1 = createErrorStatusInfo(TEXT_KEY.statusSignErrorTitle, TEXT_KEY.statusSignErrorDescription, pairStep1);
const statusInfoSignError2 = createErrorStatusInfo(TEXT_KEY.statusSignErrorTitle, TEXT_KEY.statusSignErrorDescription, pairStep2);
const statusInfoAnnounceError1 = createErrorStatusInfo(
	TEXT_KEY.statusAnnounceErrorTitle,
	TEXT_KEY.statusAnnounceErrorDescription,
	pairStep1
);
const statusInfoAnnounceError2 = createErrorStatusInfo(
	TEXT_KEY.statusAnnounceErrorTitle,
	TEXT_KEY.statusAnnounceErrorDescription,
	pairStep2
);
const statusInfoFailed1 = createErrorStatusInfo(
	TEXT_KEY.statusFailedTransactionTitle,
	TEXT_KEY.statusFailedTransactionDescription,
	pairStep1
);
const statusInfoFailed2 = createErrorStatusInfo(
	TEXT_KEY.statusFailedTransactionTitle,
	TEXT_KEY.statusFailedTransactionDescription,
	pairStep2
);
const statusInfoConfirming = createExpectedStatusInfo(
	'check-circle',
	'neutral',
	TEXT_KEY.statusConfirmingTitle,
	TEXT_KEY.statusConfirmingDescription,
	pairStep2
);
const statusInfoConfirmed = createExpectedStatusInfo(
	'check-circle',
	'success',
	TEXT_KEY.statusConfirmedTitle,
	TEXT_KEY.statusConfirmedDescription
);

// Expected Activity Log

const expectedLogTitles = [
	createText(TEXT_KEY.stepCreate),
	createText(TEXT_KEY.stepSign, { count: 1, ...pairStep1 }),
	createText(TEXT_KEY.stepAnnounce, { count: 1, ...pairStep1 }),
	createText(TEXT_KEY.stepConfirm, { count: 1, ...pairStep1 }),
	createText(TEXT_KEY.stepSign, { count: 2, ...pairStep2 }),
	createText(TEXT_KEY.stepAnnounce, { count: 2, ...pairStep2 }),
	createText(TEXT_KEY.stepConfirm, { count: 2, ...pairStep2 })
];

const createExplorerLink = (chainName, hash) => ({
	chainName,
	networkIdentifier: NETWORK_IDENTIFIER,
	hash
});

describe('screens/bridge/utils/transaction-progress', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockLocalization(createText);
	});

	describe('createTransactionProgressViewModel()', () => {
		describe('single-step workflow', () => {
			it('delegates to the standard view model with the source network', () => {
				// Arrange:
				const standardViewModel = { isCloseButtonDisabled: false };
				mockCreateStandardTransactionProgressViewModel.mockReturnValue(standardViewModel);
				const workflow = {
					steps: 1,
					meta: {
						source: createMetaSide(tokenXym, CHAIN_NAME_SYMBOL),
						target: createMetaSide(tokenBxym, CHAIN_NAME_ETHEREUM)
					}
				};

				// Act:
				const viewModel = createTransactionProgressViewModel(workflow);

				// Assert:
				expect(viewModel).toBe(standardViewModel);
				expect(mockCreateStandardTransactionProgressViewModel)
					.toHaveBeenCalledWith(workflow, CHAIN_NAME_SYMBOL, NETWORK_IDENTIFIER);
			});
		});

		describe('status info', () => {
			const runStatusInfoTest = (description, config, expected) => {
				it(description, () => {
					// Arrange:
					const workflow = createDualStepWorkflow({ status: config.status });

					// Act:
					const viewModel = createTransactionProgressViewModel(workflow);

					// Assert:
					expect(viewModel.statusInfo).toStrictEqual(expected.statusInfo);
				});
			};

			const statusInfoTests = [
				{
					description: 'shows sending while idle',
					config: { status: BridgeTransactionWorkflowStatus.IDLE },
					expected: { statusInfo: statusInfoSending }
				},
				{
					description: 'shows sending while creating',
					config: { status: BridgeTransactionWorkflowStatus.CREATING },
					expected: { statusInfo: statusInfoSending }
				},
				{
					description: 'shows sending once created',
					config: { status: BridgeTransactionWorkflowStatus.CREATED },
					expected: { statusInfo: statusInfoSending }
				},
				{
					description: 'shows the create error',
					config: { status: BridgeTransactionWorkflowStatus.CREATE_ERROR },
					expected: { statusInfo: statusInfoCreateError }
				},
				{
					description: 'shows step 1 sending while signing step 1',
					config: { status: BridgeTransactionWorkflowStatus.SIGNING_1 },
					expected: { statusInfo: statusInfoStep1Sending }
				},
				{
					description: 'shows step 1 sending once step 1 is signed',
					config: { status: BridgeTransactionWorkflowStatus.SIGNED_1 },
					expected: { statusInfo: statusInfoStep1Sending }
				},
				{
					description: 'shows step 1 sending while announcing step 1',
					config: { status: BridgeTransactionWorkflowStatus.ANNOUNCING_1 },
					expected: { statusInfo: statusInfoStep1Sending }
				},
				{
					description: 'shows step 1 sending once step 1 is announced',
					config: { status: BridgeTransactionWorkflowStatus.ANNOUNCED_1 },
					expected: { statusInfo: statusInfoStep1Sending }
				},
				{
					description: 'shows step 1 sending once step 1 is confirmed',
					config: { status: BridgeTransactionWorkflowStatus.CONFIRMED_1 },
					expected: { statusInfo: statusInfoStep1Sending }
				},
				{
					description: 'shows the step 1 sign error',
					config: { status: BridgeTransactionWorkflowStatus.SIGN_ERROR_1 },
					expected: { statusInfo: statusInfoSignError1 }
				},
				{
					description: 'shows the step 1 announce error',
					config: { status: BridgeTransactionWorkflowStatus.ANNOUNCE_ERROR_1 },
					expected: { statusInfo: statusInfoAnnounceError1 }
				},
				{
					description: 'shows the step 1 failed transaction',
					config: { status: BridgeTransactionWorkflowStatus.FAILED_1 },
					expected: { statusInfo: statusInfoFailed1 }
				},
				{
					description: 'shows step 2 sending while signing step 2',
					config: { status: BridgeTransactionWorkflowStatus.SIGNING_2 },
					expected: { statusInfo: statusInfoStep2Sending }
				},
				{
					description: 'shows step 2 sending once step 2 is signed',
					config: { status: BridgeTransactionWorkflowStatus.SIGNED_2 },
					expected: { statusInfo: statusInfoStep2Sending }
				},
				{
					description: 'shows step 2 sending while announcing step 2',
					config: { status: BridgeTransactionWorkflowStatus.ANNOUNCING_2 },
					expected: { statusInfo: statusInfoStep2Sending }
				},
				{
					description: 'shows the step 2 sign error',
					config: { status: BridgeTransactionWorkflowStatus.SIGN_ERROR_2 },
					expected: { statusInfo: statusInfoSignError2 }
				},
				{
					description: 'shows the step 2 announce error',
					config: { status: BridgeTransactionWorkflowStatus.ANNOUNCE_ERROR_2 },
					expected: { statusInfo: statusInfoAnnounceError2 }
				},
				{
					description: 'shows confirming once step 2 is announced',
					config: { status: BridgeTransactionWorkflowStatus.ANNOUNCED_2 },
					expected: { statusInfo: statusInfoConfirming }
				},
				{
					description: 'shows confirmed once step 2 is confirmed',
					config: { status: BridgeTransactionWorkflowStatus.CONFIRMED_2 },
					expected: { statusInfo: statusInfoConfirmed }
				},
				{
					description: 'shows the step 2 failed transaction',
					config: { status: BridgeTransactionWorkflowStatus.FAILED_2 },
					expected: { statusInfo: statusInfoFailed2 }
				},
				{
					description: 'shows the unknown status for a status outside the workflow',
					config: { status: UNKNOWN_STATUS },
					expected: { statusInfo: statusInfoUnknown }
				}
			];

			statusInfoTests.forEach(test => runStatusInfoTest(test.description, test.config, test.expected));

			it('labels a side without token info as unknown', () => {
				// Arrange:
				const workflow = createDualStepWorkflow({
					status: BridgeTransactionWorkflowStatus.SIGNING_2,
					meta: metaWithUnknownStep2Target
				});

				// Act:
				const viewModel = createTransactionProgressViewModel(workflow);

				// Assert:
				expect(viewModel.statusInfo.description).toBe(createText(
					TEXT_KEY.statusStepSendingDescription,
					{ from: TICKER_BXYM, to: UNKNOWN_TOKEN_TEXT }
				));
			});
		});

		describe('activity log', () => {
			it('lists the create step and the sign, announce and confirm steps of both routes', () => {
				// Act:
				const viewModel = createTransactionProgressViewModel(workflowIdle);

				// Assert:
				expect(viewModel.activityLogData).toStrictEqual(expectedLogTitles.map((title, index) => ({
					title,
					icon: LOG_ICONS[index],
					status: PENDING,
					caption: ''
				})));
			});

			const runActivityLogTest = (description, config, expected) => {
				it(description, () => {
					// Act:
					const viewModel = createTransactionProgressViewModel(config.workflow);

					// Assert:
					expect(viewModel.activityLogData.map(item => item.status)).toStrictEqual(expected.statuses);
					expect(viewModel.activityLogData.map(item => item.icon)).toStrictEqual(expected.icons);
					expect(viewModel.activityLogData.map(item => item.caption)).toStrictEqual(expected.captions);
				});
			};

			const activityLogTests = [
				{
					description: 'keeps every step pending while idle',
					config: { workflow: workflowIdle },
					expected: {
						statuses: [PENDING, PENDING, PENDING, PENDING, PENDING, PENDING, PENDING],
						icons: LOG_ICONS,
						captions: ['', '', '', '', '', '', '']
					}
				},
				{
					description: 'loads the step 1 confirmation once step 1 is announced',
					config: { workflow: workflowStep1Announced },
					expected: {
						statuses: [COMPLETE, COMPLETE, COMPLETE, LOADING, PENDING, PENDING, PENDING],
						icons: LOG_ICONS,
						captions: ['', '', '', '', '', '', '']
					}
				},
				{
					description: 'completes step 1 and loads the step 2 signing',
					config: { workflow: workflowStep2Signing },
					expected: {
						statuses: [COMPLETE, COMPLETE, COMPLETE, COMPLETE, LOADING, PENDING, PENDING],
						icons: LOG_ICONS,
						captions: ['', '', '', '', '', '', '']
					}
				},
				{
					description: 'fails the step 1 confirmation when the network rejects its transaction',
					config: { workflow: workflowStep1Failed },
					expected: {
						statuses: [COMPLETE, COMPLETE, COMPLETE, ERROR, PENDING, PENDING, PENDING],
						icons: LOG_ICONS_STEP_1_FAILED,
						captions: ['', '', '', '', '', '', '']
					}
				},
				{
					description: 'fails the step 1 signing with the error message as caption',
					config: { workflow: workflowSignError1 },
					expected: {
						statuses: [COMPLETE, ERROR, PENDING, PENDING, PENDING, PENDING, PENDING],
						icons: LOG_ICONS,
						captions: ['', ERROR_MESSAGE, '', '', '', '', '']
					}
				},
				{
					description: 'completes every step once both routes are confirmed',
					config: { workflow: workflowCompleted },
					expected: {
						statuses: [COMPLETE, COMPLETE, COMPLETE, COMPLETE, COMPLETE, COMPLETE, COMPLETE],
						icons: LOG_ICONS,
						captions: ['', '', '', '', '', '', '']
					}
				}
			];

			activityLogTests.forEach(test => runActivityLogTest(test.description, test.config, test.expected));
		});

		describe('explorer links', () => {
			const runExplorerLinksTest = (description, config, expected) => {
				it(description, () => {
					// Act:
					const viewModel = createTransactionProgressViewModel(config.workflow);

					// Assert:
					expect(viewModel.explorerLinks).toStrictEqual(expected.explorerLinks);
				});
			};

			const explorerLinksTests = [
				{
					description: 'has no links while nothing is announced',
					config: { workflow: workflowIdle },
					expected: { explorerLinks: [] }
				},
				{
					description: 'links the step 1 transaction on the step 1 source network once announced',
					config: { workflow: workflowStep1Announced },
					expected: { explorerLinks: [createExplorerLink(CHAIN_NAME_SYMBOL, HASH_STEP_1)] }
				},
				{
					description: 'links each step transaction on its own source network once both are announced',
					config: { workflow: workflowCompleted },
					expected: {
						explorerLinks: [
							createExplorerLink(CHAIN_NAME_SYMBOL, HASH_STEP_1),
							createExplorerLink(CHAIN_NAME_ETHEREUM, HASH_STEP_2)
						]
					}
				}
			];

			explorerLinksTests.forEach(test => runExplorerLinksTest(test.description, test.config, test.expected));
		});

		describe('close button', () => {
			const runCloseButtonTest = (description, config, expected) => {
				it(description, () => {
					// Arrange:
					const workflow = createDualStepWorkflow({ isSending: config.isSending });

					// Act:
					const viewModel = createTransactionProgressViewModel(workflow);

					// Assert:
					expect(viewModel.isCloseButtonDisabled).toBe(expected.isCloseButtonDisabled);
				});
			};

			const closeButtonTests = [
				{
					description: 'is disabled while sending',
					config: { isSending: true },
					expected: { isCloseButtonDisabled: true }
				},
				{
					description: 'is enabled while not sending',
					config: { isSending: false },
					expected: { isCloseButtonDisabled: false }
				}
			];

			closeButtonTests.forEach(test => runCloseButtonTest(test.description, test.config, test.expected));
		});
	});
});

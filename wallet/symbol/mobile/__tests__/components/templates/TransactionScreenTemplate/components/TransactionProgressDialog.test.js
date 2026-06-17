import { TransactionProgressDialog } from '@/app/components/templates/TransactionScreenTemplate/components/TransactionProgressDialog';
import { TransactionWorkflowStatus } from '@/app/components/templates/TransactionScreenTemplate/constants';
import { createTransactionProgressViewModel } from '@/app/components/templates/TransactionScreenTemplate/utils/transaction-progress';
import { ScreenTester } from '__tests__/ScreenTester';
import { runRenderComponentTest } from '__tests__/component-tests';
import { mockLink, mockLocalization, mockOs } from '__tests__/mock-helpers';
import { fireEvent, render } from '@testing-library/react-native';

// mocks

jest.mock('@/app/lib/platform/PlatformUtils', () => ({
	PlatformUtils: {
		openLink: jest.fn(),
		getOS: jest.fn(() => 'android')
	}
}));

jest.mock('@/app/utils', () => ({
	createExplorerTransactionUrl: jest.fn((chainName, networkIdentifier, hash) =>
		`https://explorer.${chainName}.${networkIdentifier}/tx/${hash}`)
}));

// constants

const SCREEN_TEXT_TRANSACTION_COUNTER = 'c_transactionStatus_transaction_text';
const SCREEN_TEXT = {
	// Dialog
	textDialogTitle: 'c_transactionStatus_dialog_title',
	buttonOk: 'button_ok',

	// Activity log steps
	textStepCreate: 'c_transactionStatus_step_create',
	textStepSign: 'c_transactionStatus_step_sign',
	textStepAnnounce: 'c_transactionStatus_step_announce',
	textStepConfirm: 'c_transactionStatus_step_confirm',

	// Status card titles
	textStatusSending: 'c_transactionStatus_status_sending_title',
	textStatusConfirming: 'c_transactionStatus_status_confirming_title',
	textStatusSuccess: 'c_transactionStatus_status_confirmed_title',
	textStatusCreateError: 'c_transactionStatus_status_createError_title',
	textStatusSignError: 'c_transactionStatus_status_signError_title',
	textStatusPartial: 'c_transactionStatus_status_partial_title',
	textStatusAnnounceError: 'c_transactionStatus_status_announceError_title',

	// Status card descriptions
	textDescriptionSending: 'c_transactionStatus_status_sending_description',
	textDescriptionConfirming: 'c_transactionStatus_status_confirming_description',
	textDescriptionPartial: 'c_transactionStatus_status_partial_description',
	textDescriptionSuccess: 'c_transactionStatus_status_confirmed_description',
	textDescriptionCreateError: 'c_transactionStatus_status_createError_description',
	textDescriptionSignError: 'c_transactionStatus_status_signError_description',
	textDescriptionAnnounceError: 'c_transactionStatus_status_announceError_description',
	textDescriptionRejected: 'c_transactionStatus_status_failedTransaction_description',

	// Explorer button
	buttonViewInExplorer: 'button_openTransactionInExplorer',

	// Transaction labels
	textTransaction1: `${SCREEN_TEXT_TRANSACTION_COUNTER}__1`,
	textTransaction2: `${SCREEN_TEXT_TRANSACTION_COUNTER}__2`
};

const TEST_HASHES = {
	single: ['ABC123DEF456'],
	multiple: ['HASH001', 'HASH002'],
	failed: ['FAILED_HASH'],
	partial: ['PARTIAL_HASH']
};

const NETWORK_CONFIG = {
	chainName: 'symbol',
	networkIdentifier: 'mainnet'
};

// Workflow mock factory

const createManagerState = ({
	isLoading = false,
	error = null,
	isCompleted = false
} = {}) => ({ isLoading, error, isCompleted });

const pendingManager = createManagerState();
const loadingManager = createManagerState({ isLoading: true });
const completedManager = createManagerState({ isCompleted: true });
const createErrorManager = message => createManagerState({ error: new Error(message) });

const createScenarioWorkflow = ({
	create = pendingManager,
	sign = pendingManager,
	announce = pendingManager,
	signedHashes = [],
	confirmedHashes = [],
	failedHashes = [],
	partialHashes = [],
	workflowStatus = TransactionWorkflowStatus.IDLE
} = {}) => ({
	status: workflowStatus,
	isSending: create.isLoading || sign.isLoading || announce.isLoading,
	isSent: create.isCompleted && sign.isCompleted && announce.isCompleted,
	managers: {
		createManager: create,
		signManager: sign,
		announceManager: announce
	},
	hashes: {
		signed: signedHashes,
		confirmed: confirmedHashes,
		failed: failedHashes,
		partial: partialHashes
	}
});

const createProgressViewModel = (workflow = createScenarioWorkflow()) =>
	createTransactionProgressViewModel(workflow, NETWORK_CONFIG.chainName, NETWORK_CONFIG.networkIdentifier);

// Scenario workflows

const ScenarioWorkflow = {
	INITIAL: createScenarioWorkflow({ workflowStatus: TransactionWorkflowStatus.IDLE }),
	CREATING: createScenarioWorkflow({
		create: loadingManager,
		workflowStatus: TransactionWorkflowStatus.CREATING
	}),
	SIGNING: createScenarioWorkflow({
		create: completedManager,
		sign: loadingManager,
		workflowStatus: TransactionWorkflowStatus.SIGNING
	}),
	ANNOUNCING: createScenarioWorkflow({
		create: completedManager,
		sign: completedManager,
		announce: loadingManager,
		workflowStatus: TransactionWorkflowStatus.ANNOUNCING
	}),
	ANNOUNCED: createScenarioWorkflow({
		create: completedManager,
		sign: completedManager,
		announce: completedManager,
		signedHashes: TEST_HASHES.single,
		workflowStatus: TransactionWorkflowStatus.ANNOUNCED
	}),
	CONFIRMED: createScenarioWorkflow({
		create: completedManager,
		sign: completedManager,
		announce: completedManager,
		signedHashes: TEST_HASHES.single,
		confirmedHashes: TEST_HASHES.single,
		workflowStatus: TransactionWorkflowStatus.CONFIRMED
	}),
	PARTIAL: createScenarioWorkflow({
		create: completedManager,
		sign: completedManager,
		announce: completedManager,
		signedHashes: TEST_HASHES.partial,
		partialHashes: TEST_HASHES.partial,
		workflowStatus: TransactionWorkflowStatus.PARTIAL
	}),
	FAILED: createScenarioWorkflow({
		create: completedManager,
		sign: completedManager,
		announce: completedManager,
		failedHashes: TEST_HASHES.failed,
		workflowStatus: TransactionWorkflowStatus.FAILED_TRANSACTIONS
	}),
	CREATE_ERROR: createScenarioWorkflow({
		create: createErrorManager('Create error'),
		workflowStatus: TransactionWorkflowStatus.CREATE_ERROR
	}),
	SIGN_ERROR: createScenarioWorkflow({
		create: completedManager,
		sign: createErrorManager('Sign error'),
		workflowStatus: TransactionWorkflowStatus.SIGN_ERROR
	}),
	ANNOUNCE_ERROR: createScenarioWorkflow({
		create: completedManager,
		sign: completedManager,
		announce: createErrorManager('Announce error'),
		workflowStatus: TransactionWorkflowStatus.ANNOUNCE_ERROR
	})
};

// props factory

const createDefaultProps = (scenario = ScenarioWorkflow.INITIAL, overrides = {}) => ({
	isVisible: true,
	transactionProgressViewModel: createProgressViewModel(scenario),
	onClose: jest.fn(),
	...overrides
});

describe('components/TransactionProgressDialog', () => {
	beforeEach(() => {
		mockLocalization((key, config) => key === SCREEN_TEXT_TRANSACTION_COUNTER ? `${key}__${config.index}` : key);
		mockOs('android');
		jest.clearAllMocks();
	});

	runRenderComponentTest(TransactionProgressDialog, {
		props: createDefaultProps()
	});

	describe('render', () => {
		it('renders dialog title and activity log steps', () => {
			// Arrange:
			const props = createDefaultProps();
			const expectedTexts = [
				SCREEN_TEXT.textStepCreate,
				SCREEN_TEXT.textStepSign,
				SCREEN_TEXT.textStepAnnounce,
				SCREEN_TEXT.textStepConfirm
			];

			// Act:
			const screenTester = new ScreenTester(TransactionProgressDialog, props);

			// Assert:
			screenTester.expectText(expectedTexts, true);
		});

		it('does not render content when isVisible is false', () => {
			// Arrange:
			const props = createDefaultProps(ScenarioWorkflow.INITIAL, { isVisible: false });

			// Act:
			const { queryByText } = render(<TransactionProgressDialog {...props} />);

			// Assert:
			expect(queryByText(SCREEN_TEXT.textStepCreate)).toBeNull();
		});
	});

	describe('transaction status scenarios', () => {
		const runStatusScenarioTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const props = createDefaultProps(config.scenario);

				// Act:
				const screenTester = new ScreenTester(TransactionProgressDialog, props);

				// Assert:
				screenTester.expectText([expected.statusTitle, expected.statusDescription]);
			});
		};

		const statusScenarioTests = [
			{
				description: 'shows sending status when creating transaction',
				config: { scenario: ScenarioWorkflow.CREATING },
				expected: {
					statusTitle: SCREEN_TEXT.textStatusSending,
					statusDescription: SCREEN_TEXT.textDescriptionSending
				}
			},
			{
				description: 'shows sending status when signing transaction',
				config: { scenario: ScenarioWorkflow.SIGNING },
				expected: {
					statusTitle: SCREEN_TEXT.textStatusSending,
					statusDescription: SCREEN_TEXT.textDescriptionSending
				}
			},
			{
				description: 'shows sending status when announcing transaction',
				config: { scenario: ScenarioWorkflow.ANNOUNCING },
				expected: {
					statusTitle: SCREEN_TEXT.textStatusSending,
					statusDescription: SCREEN_TEXT.textDescriptionSending
				}
			},
			{
				description: 'shows confirming status when announced but not confirmed',
				config: { scenario: ScenarioWorkflow.ANNOUNCED },
				expected: {
					statusTitle: SCREEN_TEXT.textStatusConfirming,
					statusDescription: SCREEN_TEXT.textDescriptionConfirming
				}
			},
			{
				description: 'shows success status when transaction is confirmed',
				config: { scenario: ScenarioWorkflow.CONFIRMED },
				expected: {
					statusTitle: SCREEN_TEXT.textStatusSuccess,
					statusDescription: SCREEN_TEXT.textDescriptionSuccess
				}
			},
			{
				description: 'shows partial status for multisig transaction awaiting signatures',
				config: { scenario: ScenarioWorkflow.PARTIAL },
				expected: {
					statusTitle: SCREEN_TEXT.textStatusPartial,
					statusDescription: SCREEN_TEXT.textDescriptionPartial
				}
			},
			{
				description: 'shows failed status when transaction is rejected by network',
				config: { scenario: ScenarioWorkflow.FAILED },
				expected: {
					statusTitle: SCREEN_TEXT.textDescriptionRejected,
					statusDescription: SCREEN_TEXT.textDescriptionRejected
				}
			},
			{
				description: 'shows create error status when transaction creation fails',
				config: { scenario: ScenarioWorkflow.CREATE_ERROR },
				expected: {
					statusTitle: SCREEN_TEXT.textStatusCreateError,
					statusDescription: SCREEN_TEXT.textDescriptionCreateError
				}
			},
			{
				description: 'shows sign error status when transaction signing fails',
				config: { scenario: ScenarioWorkflow.SIGN_ERROR },
				expected: {
					statusTitle: SCREEN_TEXT.textStatusSignError,
					statusDescription: SCREEN_TEXT.textDescriptionSignError
				}
			},
			{
				description: 'shows announce error status when transaction announcement fails',
				config: { scenario: ScenarioWorkflow.ANNOUNCE_ERROR },
				expected: {
					statusTitle: SCREEN_TEXT.textStatusAnnounceError,
					statusDescription: SCREEN_TEXT.textDescriptionAnnounceError
				}
			}
		];

		statusScenarioTests.forEach(test => {
			runStatusScenarioTest(test.description, test.config, test.expected);
		});
	});

	describe('explorer button', () => {
		const runExplorerButtonVisibilityTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const props = createDefaultProps(config.scenario);

				// Act:
				const screenTester = new ScreenTester(TransactionProgressDialog, props);

				// Assert:
				if (expected.isVisible)
					screenTester.expectText([SCREEN_TEXT.buttonViewInExplorer]);
				else
					screenTester.notExpectText([SCREEN_TEXT.buttonViewInExplorer]);
			});
		};

		const explorerButtonVisibilityTests = [
			{
				description: 'shows explorer button when transaction is announced',
				config: { scenario: ScenarioWorkflow.ANNOUNCED },
				expected: { isVisible: true }
			},
			{
				description: 'shows explorer button when transaction is confirmed',
				config: { scenario: ScenarioWorkflow.CONFIRMED },
				expected: { isVisible: true }
			},
			{
				description: 'does not show explorer button when signing',
				config: { scenario: ScenarioWorkflow.SIGNING },
				expected: { isVisible: false }
			},
			{
				description: 'does not show explorer button when announce fails',
				config: { scenario: ScenarioWorkflow.ANNOUNCE_ERROR },
				expected: { isVisible: false }
			}
		];

		explorerButtonVisibilityTests.forEach(test => {
			runExplorerButtonVisibilityTest(test.description, test.config, test.expected);
		});

		it('shows multiple explorer buttons for multiple transactions', () => {
			// Arrange:
			const announcedWithMultipleHashes = createScenarioWorkflow({
				create: completedManager,
				sign: completedManager,
				announce: completedManager,
				signedHashes: TEST_HASHES.multiple,
				workflowStatus: TransactionWorkflowStatus.ANNOUNCED
			});
			const props = createDefaultProps(announcedWithMultipleHashes);

			// Act:
			const { getAllByText, getByText } = render(<TransactionProgressDialog {...props} />);

			// Assert:
			expect(getAllByText(SCREEN_TEXT.buttonViewInExplorer).length).toBe(2);
			expect(getByText(SCREEN_TEXT.textTransaction1)).toBeTruthy();
			expect(getByText(SCREEN_TEXT.textTransaction2)).toBeTruthy();
		});

		it('opens block explorer with correct URL when button is pressed', () => {
			// Arrange:
			const openLinkMock = mockLink();
			const props = createDefaultProps(ScenarioWorkflow.ANNOUNCED);
			const expectedUrl =
				`https://explorer.${NETWORK_CONFIG.chainName}.${NETWORK_CONFIG.networkIdentifier}/tx/${TEST_HASHES.single[0]}`;

			// Act:
			const { getByText } = render(<TransactionProgressDialog {...props} />);
			fireEvent.press(getByText(SCREEN_TEXT.buttonViewInExplorer));

			// Assert:
			expect(openLinkMock).toHaveBeenCalledWith(expectedUrl);
		});
	});

	describe('close button', () => {
		const runCloseButtonTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const onCloseMock = jest.fn();
				const props = createDefaultProps(config.scenario, { onClose: onCloseMock });

				// Act:
				const screenTester = new ScreenTester(TransactionProgressDialog, props);

				if (expected.isButtonDisabled) {
					// Assert:
					screenTester.expectButtonDisabled(SCREEN_TEXT.buttonOk);
				} else {
					screenTester.pressButton(SCREEN_TEXT.buttonOk);

					// Assert:
					expect(onCloseMock).toHaveBeenCalledTimes(1);
				}
			});
		};

		const closeButtonTests = [
			{
				description: 'close button is disabled when creating transaction',
				config: { scenario: ScenarioWorkflow.CREATING },
				expected: { isButtonDisabled: true }
			},
			{
				description: 'close button is disabled when signing transaction',
				config: { scenario: ScenarioWorkflow.SIGNING },
				expected: { isButtonDisabled: true }
			},
			{
				description: 'close button is disabled when announcing transaction',
				config: { scenario: ScenarioWorkflow.ANNOUNCING },
				expected: { isButtonDisabled: true }
			},
			{
				description: 'close button is visible and triggers callback when announced',
				config: { scenario: ScenarioWorkflow.ANNOUNCED },
				expected: { isButtonDisabled: false }
			},
			{
				description: 'close button is visible and triggers callback when confirmed',
				config: { scenario: ScenarioWorkflow.CONFIRMED },
				expected: { isButtonDisabled: false }
			},
			{
				description: 'close button is visible and triggers callback on create error',
				config: { scenario: ScenarioWorkflow.CREATE_ERROR },
				expected: { isButtonDisabled: false }
			},
			{
				description: 'close button is visible and triggers callback on sign error',
				config: { scenario: ScenarioWorkflow.SIGN_ERROR },
				expected: { isButtonDisabled: false }
			},
			{
				description: 'close button is visible and triggers callback on announce error',
				config: { scenario: ScenarioWorkflow.ANNOUNCE_ERROR },
				expected: { isButtonDisabled: false }
			}
		];

		closeButtonTests.forEach(test => {
			runCloseButtonTest(test.description, test.config, test.expected);
		});
	});

	describe('activity log error messages', () => {
		const runActivityLogErrorTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const props = createDefaultProps(config.scenario);

				// Act:
				const screenTester = new ScreenTester(TransactionProgressDialog, props);

				// Assert:
				if (expected.errorMessage)
					screenTester.expectText([expected.errorMessage]);
			});
		};

		const activityLogErrorTests = [
			{
				description: 'shows error message in activity log when creation fails',
				config: { scenario: ScenarioWorkflow.CREATE_ERROR },
				expected: { errorMessage: 'Create error' }
			},
			{
				description: 'shows error message in activity log when signing fails',
				config: { scenario: ScenarioWorkflow.SIGN_ERROR },
				expected: { errorMessage: 'Sign error' }
			},
			{
				description: 'shows error message in activity log when announcement fails',
				config: { scenario: ScenarioWorkflow.ANNOUNCE_ERROR },
				expected: { errorMessage: 'Announce error' }
			}
		];

		activityLogErrorTests.forEach(test => {
			runActivityLogErrorTest(test.description, test.config, test.expected);
		});
	});
});

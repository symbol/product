import { TransactionStatusDialog } from '@/app/components/templates/TransactionScreenTemplate/components/TransactionStatusDialog';
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

// action status factories

const ActionStatusType = {
	PENDING: 'pending',
	LOADING: 'loading',
	COMPLETE: 'complete',
	ERROR: 'error'
};

const createActionStatus = (status, errorMessage = null) => ({
	status,
	errorMessage
});

const ActionStatusFactory = {
	pending: () => createActionStatus(ActionStatusType.PENDING),
	loading: () => createActionStatus(ActionStatusType.LOADING),
	complete: () => createActionStatus(ActionStatusType.COMPLETE),
	error: (message = 'Error occurred') => createActionStatus(ActionStatusType.ERROR, message)
};

// scenario configs

const ScenarioConfig = {
	INITIAL: {
		createStatus: ActionStatusFactory.pending(),
		signStatus: ActionStatusFactory.pending(),
		announceStatus: ActionStatusFactory.pending()
	},
	CREATING: {
		createStatus: ActionStatusFactory.loading(),
		signStatus: ActionStatusFactory.pending(),
		announceStatus: ActionStatusFactory.pending()
	},
	SIGNING: {
		createStatus: ActionStatusFactory.complete(),
		signStatus: ActionStatusFactory.loading(),
		announceStatus: ActionStatusFactory.pending()
	},
	ANNOUNCING: {
		createStatus: ActionStatusFactory.complete(),
		signStatus: ActionStatusFactory.complete(),
		announceStatus: ActionStatusFactory.loading()
	},
	ANNOUNCED: {
		createStatus: ActionStatusFactory.complete(),
		signStatus: ActionStatusFactory.complete(),
		announceStatus: ActionStatusFactory.complete(),
		signedTransactionHashes: TEST_HASHES.single
	},
	CONFIRMED: {
		createStatus: ActionStatusFactory.complete(),
		signStatus: ActionStatusFactory.complete(),
		announceStatus: ActionStatusFactory.complete(),
		transactionCount: 1,
		signedTransactionHashes: TEST_HASHES.single,
		confirmedTransactionHashes: TEST_HASHES.single
	},
	PARTIAL: {
		createStatus: ActionStatusFactory.complete(),
		signStatus: ActionStatusFactory.complete(),
		announceStatus: ActionStatusFactory.complete(),
		transactionCount: 1,
		signedTransactionHashes: TEST_HASHES.partial,
		partialTransactionHashes: TEST_HASHES.partial
	},
	FAILED: {
		createStatus: ActionStatusFactory.complete(),
		signStatus: ActionStatusFactory.complete(),
		announceStatus: ActionStatusFactory.complete(),
		transactionCount: 1,
		failedTransactionHashes: TEST_HASHES.failed
	},
	CREATE_ERROR: {
		createStatus: ActionStatusFactory.error('Create error'),
		signStatus: ActionStatusFactory.pending(),
		announceStatus: ActionStatusFactory.pending()
	},
	SIGN_ERROR: {
		createStatus: ActionStatusFactory.complete(),
		signStatus: ActionStatusFactory.error('Sign error'),
		announceStatus: ActionStatusFactory.pending()
	},
	ANNOUNCE_ERROR: {
		createStatus: ActionStatusFactory.complete(),
		signStatus: ActionStatusFactory.complete(),
		announceStatus: ActionStatusFactory.error('Announce error')
	}
};

// props factory

const createDefaultProps = (overrides = {}) => ({
	isVisible: true,
	createStatus: ActionStatusFactory.pending(),
	signStatus: ActionStatusFactory.pending(),
	announceStatus: ActionStatusFactory.pending(),
	transactionCount: 1,
	signedTransactionHashes: [],
	confirmedTransactionHashes: [],
	failedTransactionHashes: [],
	partialTransactionHashes: [],
	chainName: NETWORK_CONFIG.chainName,
	networkIdentifier: NETWORK_CONFIG.networkIdentifier,
	onClose: jest.fn(),
	...overrides
});

describe('components/TransactionStatusDialog', () => {
	beforeEach(() => {
		mockLocalization((key, config) => key === SCREEN_TEXT_TRANSACTION_COUNTER ? `${key}__${config.index}` : key);
		mockOs('android');
		jest.clearAllMocks();
	});

	runRenderComponentTest(TransactionStatusDialog, {
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
			const screenTester = new ScreenTester(TransactionStatusDialog, props);

			// Assert:
			screenTester.expectText(expectedTexts, true);
		});

		it('does not render content when isVisible is false', () => {
			// Arrange:
			const props = createDefaultProps({ isVisible: false });

			// Act:
			const { queryByText } = render(<TransactionStatusDialog {...props} />);

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
				const screenTester = new ScreenTester(TransactionStatusDialog, props);

				// Assert:
				screenTester.expectText([expected.statusTitle, expected.statusDescription]);
			});
		};

		const statusScenarioTests = [
			{
				description: 'shows sending status when creating transaction',
				config: { scenario: ScenarioConfig.CREATING },
				expected: {
					statusTitle: SCREEN_TEXT.textStatusSending,
					statusDescription: SCREEN_TEXT.textDescriptionSending
				}
			},
			{
				description: 'shows sending status when signing transaction',
				config: { scenario: ScenarioConfig.SIGNING },
				expected: {
					statusTitle: SCREEN_TEXT.textStatusSending,
					statusDescription: SCREEN_TEXT.textDescriptionSending
				}
			},
			{
				description: 'shows sending status when announcing transaction',
				config: { scenario: ScenarioConfig.ANNOUNCING },
				expected: {
					statusTitle: SCREEN_TEXT.textStatusSending,
					statusDescription: SCREEN_TEXT.textDescriptionSending
				}
			},
			{
				description: 'shows confirming status when announced but not confirmed',
				config: { scenario: ScenarioConfig.ANNOUNCED },
				expected: {
					statusTitle: SCREEN_TEXT.textStatusConfirming,
					statusDescription: SCREEN_TEXT.textDescriptionConfirming
				}
			},
			{
				description: 'shows success status when transaction is confirmed',
				config: { scenario: ScenarioConfig.CONFIRMED },
				expected: {
					statusTitle: SCREEN_TEXT.textStatusSuccess,
					statusDescription: SCREEN_TEXT.textDescriptionSuccess
				}
			},
			{
				description: 'shows partial status for multisig transaction awaiting signatures',
				config: { scenario: ScenarioConfig.PARTIAL },
				expected: {
					statusTitle: SCREEN_TEXT.textStatusPartial,
					statusDescription: SCREEN_TEXT.textDescriptionPartial
				}
			},
			{
				description: 'shows failed status when transaction is rejected by network',
				config: { scenario: ScenarioConfig.FAILED },
				expected: {
					statusTitle: SCREEN_TEXT.textDescriptionRejected,
					statusDescription: SCREEN_TEXT.textDescriptionRejected
				}
			},
			{
				description: 'shows create error status when transaction creation fails',
				config: { scenario: ScenarioConfig.CREATE_ERROR },
				expected: {
					statusTitle: SCREEN_TEXT.textStatusCreateError,
					statusDescription: SCREEN_TEXT.textDescriptionCreateError
				}
			},
			{
				description: 'shows sign error status when transaction signing fails',
				config: { scenario: ScenarioConfig.SIGN_ERROR },
				expected: {
					statusTitle: SCREEN_TEXT.textStatusSignError,
					statusDescription: SCREEN_TEXT.textDescriptionSignError
				}
			},
			{
				description: 'shows announce error status when transaction announcement fails',
				config: { scenario: ScenarioConfig.ANNOUNCE_ERROR },
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
				const screenTester = new ScreenTester(TransactionStatusDialog, props);

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
				config: { scenario: ScenarioConfig.ANNOUNCED },
				expected: { isVisible: true }
			},
			{
				description: 'shows explorer button when transaction is confirmed',
				config: { scenario: ScenarioConfig.CONFIRMED },
				expected: { isVisible: true }
			},
			{
				description: 'does not show explorer button when signing',
				config: { scenario: ScenarioConfig.SIGNING },
				expected: { isVisible: false }
			},
			{
				description: 'does not show explorer button when announce fails',
				config: { scenario: ScenarioConfig.ANNOUNCE_ERROR },
				expected: { isVisible: false }
			}
		];

		explorerButtonVisibilityTests.forEach(test => {
			runExplorerButtonVisibilityTest(test.description, test.config, test.expected);
		});

		it('shows multiple explorer buttons for multiple transactions', () => {
			// Arrange:
			const props = createDefaultProps({
				...ScenarioConfig.ANNOUNCED,
				signedTransactionHashes: TEST_HASHES.multiple
			});

			// Act:
			const { getAllByText, getByText } = render(<TransactionStatusDialog {...props} />);

			// Assert:
			expect(getAllByText(SCREEN_TEXT.buttonViewInExplorer).length).toBe(2);
			expect(getByText(SCREEN_TEXT.textTransaction1)).toBeTruthy();
			expect(getByText(SCREEN_TEXT.textTransaction2)).toBeTruthy();
		});

		it('opens block explorer with correct URL when button is pressed', () => {
			// Arrange:
			const openLinkMock = mockLink();
			const props = createDefaultProps({
				...ScenarioConfig.ANNOUNCED,
				signedTransactionHashes: [TEST_HASHES.single[0]]
			});
			const expectedUrl =
				`https://explorer.${NETWORK_CONFIG.chainName}.${NETWORK_CONFIG.networkIdentifier}/tx/${TEST_HASHES.single[0]}`;

			// Act:
			const { getByText } = render(<TransactionStatusDialog {...props} />);
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
				const props = createDefaultProps({
					...config.scenario,
					onClose: onCloseMock
				});

				// Act:
				const screenTester = new ScreenTester(TransactionStatusDialog, props);

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
				config: { scenario: ScenarioConfig.CREATING },
				expected: { isButtonDisabled: true }
			},
			{
				description: 'close button is disabled when signing transaction',
				config: { scenario: ScenarioConfig.SIGNING },
				expected: { isButtonDisabled: true }
			},
			{
				description: 'close button is disabled when announcing transaction',
				config: { scenario: ScenarioConfig.ANNOUNCING },
				expected: { isButtonDisabled: true }
			},
			{
				description: 'close button is visible and triggers callback when announced',
				config: { scenario: ScenarioConfig.ANNOUNCED },
				expected: { isButtonDisabled: false }
			},
			{
				description: 'close button is visible and triggers callback when confirmed',
				config: { scenario: ScenarioConfig.CONFIRMED },
				expected: { isButtonDisabled: false }
			},
			{
				description: 'close button is visible and triggers callback on create error',
				config: { scenario: ScenarioConfig.CREATE_ERROR },
				expected: { isButtonDisabled: false }
			},
			{
				description: 'close button is visible and triggers callback on sign error',
				config: { scenario: ScenarioConfig.SIGN_ERROR },
				expected: { isButtonDisabled: false }
			},
			{
				description: 'close button is visible and triggers callback on announce error',
				config: { scenario: ScenarioConfig.ANNOUNCE_ERROR },
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
				const screenTester = new ScreenTester(TransactionStatusDialog, props);

				// Assert:
				if (expected.errorMessage)
					screenTester.expectText([expected.errorMessage]);
			});
		};

		const activityLogErrorTests = [
			{
				description: 'shows error message in activity log when creation fails',
				config: { scenario: ScenarioConfig.CREATE_ERROR },
				expected: { errorMessage: 'Create error' }
			},
			{
				description: 'shows error message in activity log when signing fails',
				config: { scenario: ScenarioConfig.SIGN_ERROR },
				expected: { errorMessage: 'Sign error' }
			},
			{
				description: 'shows error message in activity log when announcement fails',
				config: { scenario: ScenarioConfig.ANNOUNCE_ERROR },
				expected: { errorMessage: 'Announce error' }
			}
		];

		activityLogErrorTests.forEach(test => {
			runActivityLogErrorTest(test.description, test.config, test.expected);
		});
	});
});

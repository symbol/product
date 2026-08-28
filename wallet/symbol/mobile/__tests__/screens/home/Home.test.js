import { Home } from '@/app/screens/home/Home';
import { AccountInfoFixtureBuilder } from '__fixtures__/local/AccountInfoFixtureBuilder';
import { ScreenTester } from '__tests__/ScreenTester';
import { runRenderComponentTest } from '__tests__/component-tests';
import { mockLocalization, mockWalletController } from '__tests__/mock-helpers';

// Constants

const CHAIN_NAME = 'symbol';
const NETWORK_IDENTIFIER = 'testnet';

// Screen Text

const SCREEN_TEXT = {
	// Multisig Warning
	textMultisigWarningTitle: 'warning_multisig_title',
	textMultisigWarningBody: 'warning_multisig_body',

	// Account Card Buttons
	buttonAccountDetails: 'c_accountCard_button_accountDetails',
	buttonSend: 'c_accountCard_button_send',
	buttonSwap: 'c_accountCard_button_swap'
};

// Account Info Fixtures

const regularAccountInfo = AccountInfoFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.setMultisigStatusByIndexes(false)
	.build();

const multisigAccountInfo = AccountInfoFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.setMultisigStatusByIndexes(true, [1, 2])
	.build();

// Account Scenarios

const AccountScenario = {
	REGULAR: { currentAccountInfo: regularAccountInfo },
	INFO_NOT_LOADED: { currentAccountInfo: null },
	MULTISIG: { currentAccountInfo: multisigAccountInfo }
};

// Wallet Controller Mock

const mockWalletControllerConfigured = (overrides = {}) => {
	return mockWalletController({
		currentAccountInfo: overrides.currentAccountInfo ?? regularAccountInfo,
		fetchAccountInfo: jest.fn().mockResolvedValue(),
		fetchAccountTransactions: jest.fn().mockResolvedValue([]),
		modules: {
			multisig: {
				multisigAccounts: [],
				fetchData: jest.fn().mockResolvedValue([])
			},
			addressBook: {
				whiteList: [],
				contacts: [],
				blackList: [],
				getContactByAddress: jest.fn().mockReturnValue(null)
			},
			market: {
				price: null
			},
			harvesting: {
				fetchSummary: jest.fn().mockResolvedValue(null),
				fetchStatus: jest.fn().mockResolvedValue(null),
				getStatus: jest.fn().mockReturnValue(null),
				getSummary: jest.fn().mockReturnValue(null)
			}
		}
	});
};

describe('screens/home/Home', () => {
	beforeEach(() => {
		jest.useFakeTimers();
		mockLocalization();
		mockWalletControllerConfigured();
	});

	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
	});

	runRenderComponentTest(Home);

	describe('multisig account', () => {
		const runMultisigAccountTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				mockWalletControllerConfigured({
					currentAccountInfo: config.scenario.currentAccountInfo
				});
				const warningTexts = [SCREEN_TEXT.textMultisigWarningTitle, SCREEN_TEXT.textMultisigWarningBody];

				// Act:
				const screenTester = new ScreenTester(Home);
				await screenTester.waitForTimer(); // widgets refresh

				// Assert:
				if (expected.isWarningVisible)
					screenTester.expectText(warningTexts);
				else
					screenTester.notExpectText(warningTexts);
				expected.disabledButtons.forEach(text => screenTester.expectButtonDisabled(text));
				expected.enabledButtons.forEach(text => screenTester.expectButtonEnabled(text));
			});
		};

		const multisigAccountTests = [
			{
				description: 'hides warning and enables all buttons for regular account',
				config: { scenario: AccountScenario.REGULAR },
				expected: {
					isWarningVisible: false,
					disabledButtons: [],
					enabledButtons: [SCREEN_TEXT.buttonAccountDetails, SCREEN_TEXT.buttonSend, SCREEN_TEXT.buttonSwap]
				}
			},
			{
				description: 'hides warning and enables all buttons when account info is not loaded',
				config: { scenario: AccountScenario.INFO_NOT_LOADED },
				expected: {
					isWarningVisible: false,
					disabledButtons: [],
					enabledButtons: [SCREEN_TEXT.buttonAccountDetails, SCREEN_TEXT.buttonSend, SCREEN_TEXT.buttonSwap]
				}
			},
			{
				description: 'shows warning and disables send and swap buttons for multisig account',
				config: { scenario: AccountScenario.MULTISIG },
				expected: {
					isWarningVisible: true,
					disabledButtons: [SCREEN_TEXT.buttonSend, SCREEN_TEXT.buttonSwap],
					enabledButtons: [SCREEN_TEXT.buttonAccountDetails]
				}
			}
		];

		multisigAccountTests.forEach(test => {
			runMultisigAccountTest(test.description, test.config, test.expected);
		});

		it('renders cosignatories in the multisig warning', async () => {
			// Arrange:
			mockWalletControllerConfigured({
				currentAccountInfo: AccountScenario.MULTISIG.currentAccountInfo
			});
			const expectedTexts = multisigAccountInfo.cosignatories;

			// Act:
			const screenTester = new ScreenTester(Home);
			await screenTester.waitForTimer(); // widgets refresh

			// Assert:
			screenTester.expectText(expectedTexts);
		});
	});
});

import { CreateMultisigAccount } from '@/app/screens/multisig/CreateMultisigAccount';
import * as accountUtils from '@/app/utils/account';
import { AccountFixtureBuilder } from '__fixtures__/local/AccountFixtureBuilder';
import { TransactionFeeFixtureBuilder } from '__fixtures__/local/TransactionFeeFixtureBuilder';
import { ScreenTester } from '__tests__/ScreenTester';
import { createAddressBookMock, mockLocalization, mockPasscode, mockRouter, mockWalletController } from '__tests__/mock-helpers';
import { ACTION_TYPE, addCosignatory, applyCounterAction } from '__tests__/screens/multisig/multisig-test-helper';

// Mocks

jest.mock('@react-navigation/native', () => ({
	...jest.requireActual('@react-navigation/native'),
	useIsFocused: () => true
}));

// Constants

const CHAIN_NAME = 'symbol';
const NETWORK_IDENTIFIER = 'testnet';
const TICKER = 'XYM';

const GENERATED_ACCOUNT_ADDRESS = 'TGENERATED-ACCO-UNTX-ADDR-ESSX-XXXXX-XXXX';
const REGENERATED_ACCOUNT_ADDRESS = 'TREGENERA-TEDA-CCOU-NTAD-DRXX-XXXXX-XXXX';

// Screen Text

const SCREEN_TEXT = {
	// Screen titles
	textScreenTitle: 's_multisig_create_title',
	textScreenDescription: 's_multisig_create_description',

	// Cosignatory section
	textCosignatoryTitle: 's_multisig_cosignatory_title',
	textCosignatoryDescription: 's_multisig_cosignatory_description',
	textCosignatoryWarning: 's_multisig_cosignatoryAlert_currentAccount_text',

	// Approvals section
	textApprovalsTitle: 's_multisig_approvals_title',
	textApprovalsDescription: 's_multisig_approvals_description',
	textMinApprovals: 'fieldTitle_minApprovals',
	textMinRemovals: 'fieldTitle_minRemovals',

	// Buttons (text)
	buttonSend: 'button_send',
	buttonRegenerate: 'button_regenerateAddress',
	buttonAdd: 'button_add',
	buttonConfirm: 'button_confirm',

	// Button labels (accessibility)
	labelButtonDelete: 'delete',
	labelButtonPlus: 'plus',
	labelButtonMinus: 'minus',

	// Input labels
	labelInputAddress: 'input_address',

	// Dialog
	textDialogAddCosignatoryTitle: 's_multisig_create_dialog_addCosignatory_title',
	textDialogConfirmTitle: 's_multisig_create_dialog_confirm_title',

	// Default name
	textDefaultAccountName: 's_multisig_defaultAccountName'
};

// Account Fixtures

const currentAccount = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.build();

const cosignerAccount1 = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 1)
	.setName('Cosigner 1')
	.build();

const cosignerAccount2 = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 2)
	.setName('Cosigner 2')
	.build();

const cosignerAccount3 = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 3)
	.setName('Cosigner 3')
	.build();

// Generated Account Fixtures

const generatedAccount = {
	address: GENERATED_ACCOUNT_ADDRESS,
	publicKey: 'GENERATED_PUBLIC_KEY_1234567890ABCDEF1234567890ABCDEF12345678',
	privateKey: 'GENERATED_PRIVATE_KEY'
};

const regeneratedAccount = {
	address: REGENERATED_ACCOUNT_ADDRESS,
	publicKey: 'REGENERATED_PUBLIC_KEY_ABCDEF1234567890ABCDEF1234567890ABCD',
	privateKey: 'REGENERATED_PRIVATE_KEY'
};

// Transaction Fee Fixtures

const transactionFees = TransactionFeeFixtureBuilder
	.createWithAmounts('0.1', '0.2', '0.3', CHAIN_NAME, NETWORK_IDENTIFIER)
	.build();

// Mock Transaction Bundle

const mockInnerTransaction = {
	type: 'multisigAccountModification',
	signerAddress: GENERATED_ACCOUNT_ADDRESS,
	minApprovalDelta: 1,
	minRemovalDelta: 1,
	addressAdditions: [currentAccount.address],
	addressDeletions: []
};

const mockAggregateTransaction = {
	type: 'aggregateBonded',
	signerAddress: currentAccount.address,
	innerTransactions: [mockInnerTransaction],
	fee: { token: { amount: '0.1' } }
};

const mockTransactionBundle = {
	transactions: [mockAggregateTransaction],
	applyFeeTier: jest.fn()
};

// Route Props

const routeProps = {
	route: {
		params: {
			chainName: CHAIN_NAME
		}
	}
};

// Multisig Module Mock Factory

const createMultisigModuleMock = () => ({
	calculateDeltas: jest.fn().mockReturnValue({
		minApprovalDelta: 1,
		minRemovalDelta: 1,
		addressAdditions: [currentAccount.address],
		addressDeletions: []
	}),
	createTransaction: jest.fn().mockReturnValue(mockTransactionBundle)
});

// Transfer Module Mock Factory

const createTransferModuleMock = () => ({
	calculateTransactionFees: jest.fn().mockResolvedValue(transactionFees)
});

// Setup

const setupMocks = (config = {}) => {
	const {
		walletAccounts = [currentAccount, cosignerAccount1, cosignerAccount2, cosignerAccount3],
		contacts = [],
		generateAccountSequence = [generatedAccount]
	} = config;

	mockLocalization();

	// Mock generateAccount to return different accounts on subsequent calls
	let callCount = 0;
	jest.spyOn(accountUtils, 'generateAccount').mockImplementation(() => {
		const account = generateAccountSequence[callCount] || generateAccountSequence[generateAccountSequence.length - 1];
		callCount++;
		return account;
	});

	const walletControllerMock = mockWalletController({
		chainName: CHAIN_NAME,
		networkIdentifier: NETWORK_IDENTIFIER,
		ticker: TICKER,
		currentAccount,
		accounts: {
			[NETWORK_IDENTIFIER]: walletAccounts
		},
		signTransactionBundle: jest.fn().mockResolvedValue({
			transactions: [{ hash: 'SIGNED_TX_HASH' }]
		}),
		announceSignedTransactionBundle: jest.fn().mockResolvedValue({}),
		modules: {
			addressBook: createAddressBookMock(contacts),
			multisig: createMultisigModuleMock(),
			transfer: createTransferModuleMock()
		}
	});

	return { walletControllerMock };
};

describe('screens/multisig/CreateMultisigAccount', () => {
	beforeEach(() => {
		jest.useFakeTimers();
		jest.clearAllMocks();
	});

	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
	});

	describe('render', () => {
		it('renders screen text with titles, descriptions and send button', async () => {
			// Arrange:
			setupMocks();
			const expectedTexts = [
				SCREEN_TEXT.textScreenTitle,
				SCREEN_TEXT.textScreenDescription,
				SCREEN_TEXT.textCosignatoryTitle,
				SCREEN_TEXT.textCosignatoryDescription,
				SCREEN_TEXT.textApprovalsTitle,
				SCREEN_TEXT.textApprovalsDescription,
				SCREEN_TEXT.textMinApprovals,
				SCREEN_TEXT.textMinRemovals,
				SCREEN_TEXT.buttonSend
			];

			// Act:
			const screenTester = new ScreenTester(CreateMultisigAccount, routeProps);
			await screenTester.waitForTimer(); // account generation

			// Assert:
			screenTester.expectText(expectedTexts);
		});
	});

	describe('multisig account info', () => {
		it('renders generated account with address and zero balance', async () => {
			// Arrange:
			setupMocks();

			// Act:
			const screenTester = new ScreenTester(CreateMultisigAccount, routeProps);
			await screenTester.waitForTimer(); // account generation

			// Assert:
			screenTester.expectText([
				GENERATED_ACCOUNT_ADDRESS,
				SCREEN_TEXT.textDefaultAccountName
			]);
			screenTester.expectText(['0'], true); // zero balance
		});
	});

	describe('account generation', () => {
		it('generates account on mount', async () => {
			// Arrange:
			setupMocks();

			// Act:
			new ScreenTester(CreateMultisigAccount, routeProps);
			await jest.runAllTimersAsync();

			// Assert:
			expect(accountUtils.generateAccount).toHaveBeenCalledWith(CHAIN_NAME, NETWORK_IDENTIFIER);
			expect(accountUtils.generateAccount).toHaveBeenCalledTimes(1);
		});

		it('regenerates account when regenerate button is pressed', async () => {
			// Arrange:
			setupMocks({
				generateAccountSequence: [generatedAccount, regeneratedAccount]
			});

			// Act:
			const screenTester = new ScreenTester(CreateMultisigAccount, routeProps);
			await screenTester.waitForTimer(); // initial generation
			screenTester.expectText([GENERATED_ACCOUNT_ADDRESS]);

			screenTester.pressButton(SCREEN_TEXT.buttonRegenerate);
			await screenTester.waitForTimer(); // regeneration

			// Assert:
			screenTester.expectText([REGENERATED_ACCOUNT_ADDRESS]);
			screenTester.notExpectText([GENERATED_ACCOUNT_ADDRESS]);
			expect(accountUtils.generateAccount).toHaveBeenCalledTimes(2);
		});
	});

	describe('cosignatory section', () => {
		it('renders current account as default cosigner', async () => {
			// Arrange:
			setupMocks();

			// Act:
			const screenTester = new ScreenTester(CreateMultisigAccount, routeProps);
			await screenTester.waitForTimer(); // account generation

			// Assert:
			screenTester.expectText([currentAccount.address]);
		});

		describe('modifying cosignatory list', () => {
			const runCosignatoryModificationTest = (description, config, expected) => {
				it(description, async () => {
					// Arrange:
					setupMocks();
					const screenTester = new ScreenTester(CreateMultisigAccount, routeProps);
					await screenTester.waitForTimer(); // account generation

					// Act:
					for (const action of config.actions) {
						if (action.type === ACTION_TYPE.ADD_COSIGNATORY) 
							await addCosignatory(screenTester, SCREEN_TEXT, action.address);
						 else if (action.type === ACTION_TYPE.REMOVE_COSIGNATORY) 
							screenTester.presButtonByLabel(SCREEN_TEXT.labelButtonDelete, action.index);
						
					}

					// Assert:
					screenTester.expectText(expected.visibleAddresses);
					if (expected.notVisibleAddresses?.length)
						screenTester.notExpectText(expected.notVisibleAddresses);
					
					if (expected.warningVisible)
						screenTester.expectText([SCREEN_TEXT.textCosignatoryWarning]);
					else
						screenTester.notExpectText([SCREEN_TEXT.textCosignatoryWarning]);
				});
			};

			const cosignatoryModificationTests = [
				{
					description: 'adds new cosigner when pressing add and inserting address',
					config: {
						actions: [
							{ type: ACTION_TYPE.ADD_COSIGNATORY, address: cosignerAccount1.address }
						]
					},
					expected: {
						visibleAddresses: [currentAccount.address, cosignerAccount1.address],
						warningVisible: false
					}
				},
				{
					description: 'removes cosigner when pressing delete button',
					config: {
						actions: [
							{ type: ACTION_TYPE.ADD_COSIGNATORY, address: cosignerAccount1.address },
							{ type: ACTION_TYPE.REMOVE_COSIGNATORY, index: 1 } // remove cosignerAccount1
						]
					},
					expected: {
						visibleAddresses: [currentAccount.address],
						notVisibleAddresses: [cosignerAccount1.address],
						warningVisible: false
					}
				},
				{
					description: 'shows warning when current account is removed from list',
					config: {
						actions: [
							{ type: ACTION_TYPE.ADD_COSIGNATORY, address: cosignerAccount1.address },
							{ type: ACTION_TYPE.REMOVE_COSIGNATORY, index: 0 } // remove current account
						]
					},
					expected: {
						visibleAddresses: [cosignerAccount1.address],
						notVisibleAddresses: [currentAccount.address],
						warningVisible: true
					}
				}
			];

			cosignatoryModificationTests.forEach(test => {
				runCosignatoryModificationTest(test.description, test.config, test.expected);
			});
		});
	});

	describe('approvals section', () => {
		const runApprovalsTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				setupMocks();
				const screenTester = new ScreenTester(CreateMultisigAccount, routeProps);
				await screenTester.waitForTimer(); // account generation

				// Add cosigners to have multiple options
				for (const address of config.cosignersToAdd || [])
					await addCosignatory(screenTester, SCREEN_TEXT, address);

				// Act:
				for (const action of config.actions)
					applyCounterAction(screenTester, SCREEN_TEXT, action);

				// Assert:
				screenTester.expectText([expected.approvalsText], true);
				screenTester.expectText([expected.removalsText], true);
			});
		};

		const approvalsTests = [
			{
				description: 'starts with 1 of 1 for approvals and removals with single cosigner',
				config: {
					cosignersToAdd: [],
					actions: []
				},
				expected: {
					approvalsText: '1 of 1',
					removalsText: '1 of 1'
				}
			},
			{
				description: 'increments approval when pressing plus for approvals',
				config: {
					cosignersToAdd: [cosignerAccount1.address, cosignerAccount2.address, cosignerAccount3.address],
					actions: [
						{ type: ACTION_TYPE.INCREMENT_APPROVAL }
					]
				},
				expected: {
					approvalsText: '2 of 4',
					removalsText: '1 of 4'
				}
			},
			{
				description: 'increments removal when pressing plus for removals',
				config: {
					cosignersToAdd: [cosignerAccount1.address, cosignerAccount2.address, cosignerAccount3.address],
					actions: [
						{ type: ACTION_TYPE.INCREMENT_REMOVAL }
					]
				},
				expected: {
					approvalsText: '1 of 4',
					removalsText: '2 of 4'
				}
			},
			{
				description: 'decrements approval when pressing minus for approvals',
				config: {
					cosignersToAdd: [cosignerAccount1.address, cosignerAccount2.address, cosignerAccount3.address],
					actions: [
						{ type: ACTION_TYPE.INCREMENT_APPROVAL },
						{ type: ACTION_TYPE.INCREMENT_APPROVAL },
						{ type: ACTION_TYPE.DECREMENT_APPROVAL }
					]
				},
				expected: {
					approvalsText: '2 of 4',
					removalsText: '1 of 4'
				}
			},
			{
				description: 'decrements removal when pressing minus for removals',
				config: {
					cosignersToAdd: [cosignerAccount1.address, cosignerAccount2.address, cosignerAccount3.address],
					actions: [
						{ type: ACTION_TYPE.INCREMENT_REMOVAL },
						{ type: ACTION_TYPE.INCREMENT_REMOVAL },
						{ type: ACTION_TYPE.DECREMENT_REMOVAL }
					]
				},
				expected: {
					approvalsText: '1 of 4',
					removalsText: '2 of 4'
				}
			}
		];

		approvalsTests.forEach(test => {
			runApprovalsTest(test.description, test.config, test.expected);
		});
	});

	describe('send button availability', () => {
		const runSendButtonTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				setupMocks();
				const screenTester = new ScreenTester(CreateMultisigAccount, routeProps);
				await screenTester.waitForTimer(); // account generation
				await screenTester.waitForTimer(); // fee calculation

				// Act:
				for (const action of config.actions) {
					if (action.type === ACTION_TYPE.REMOVE_COSIGNATORY)
						screenTester.presButtonByLabel(SCREEN_TEXT.labelButtonDelete, action.index);
					else if (action.type === ACTION_TYPE.ADD_COSIGNATORY)
						await addCosignatory(screenTester, SCREEN_TEXT, action.address);
				}
				await screenTester.waitForTimer(); // fee recalculation

				// Assert:
				if (expected.isDisabled)
					screenTester.expectButtonDisabled(SCREEN_TEXT.buttonSend);
				else
					screenTester.expectButtonEnabled(SCREEN_TEXT.buttonSend);
			});
		};

		const sendButtonTests = [
			{
				description: 'send button is enabled when cosigners are present',
				config: {
					actions: []
				},
				expected: {
					isDisabled: false
				}
			},
			{
				description: 'send button is disabled when no cosigners on the list',
				config: {
					actions: [
						{ type: ACTION_TYPE.REMOVE_COSIGNATORY, index: 0 } // remove current account (only cosigner)
					]
				},
				expected: {
					isDisabled: true
				}
			}
		];

		sendButtonTests.forEach(test => {
			runSendButtonTest(test.description, test.config, test.expected);
		});
	});

	describe('send transaction flow', () => {
		it('sends transaction when send button is pressed and confirmed', async () => {
			// Arrange:
			const { walletControllerMock } = setupMocks();
			mockPasscode();
			mockRouter({ goToHome: jest.fn() });
			const screenTester = new ScreenTester(CreateMultisigAccount, routeProps);
			await screenTester.waitForTimer(); // account generation
			await screenTester.waitForTimer(); // fee calculation

			// Act:
			screenTester.pressButton(SCREEN_TEXT.buttonSend);
			await screenTester.waitForTimer(); // dialog
			screenTester.pressButton(SCREEN_TEXT.buttonConfirm);
			await screenTester.waitForTimer(); // passcode
			await screenTester.waitForTimer(); // sign
			await screenTester.waitForTimer(); // announce

			// Assert:
			expect(walletControllerMock.signTransactionBundle).toHaveBeenCalled();
			expect(walletControllerMock.announceSignedTransactionBundle).toHaveBeenCalled();
		});
	});
});

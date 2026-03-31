import { ModifyMultisigAccount } from '@/app/screens/multisig/ModifyMultisigAccount';
import { AccountFixtureBuilder } from '__fixtures__/local/AccountFixtureBuilder';
import { AccountInfoFixtureBuilder } from '__fixtures__/local/AccountInfoFixtureBuilder';
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
const MULTISIG_ACCOUNT_BALANCE = '1500';

// Screen Text

const SCREEN_TEXT = {
	// Screen titles
	textScreenTitle: 's_multisig_modify_title',
	textScreenDescription: 's_multisig_modify_description',

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

const cosignerAccount4 = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 4)
	.setName('Cosigner 4')
	.build();

// Multisig Account Address

const MULTISIG_ACCOUNT_ADDRESS = 'TMULTISIG-ACCO-UNTA-DDRE-SSFI-XTURE-XXX';

// Multisig Account Info Fixtures

const multisigAccountInfo = AccountInfoFixtureBuilder
	.createEmpty(CHAIN_NAME, NETWORK_IDENTIFIER)
	.override({
		address: MULTISIG_ACCOUNT_ADDRESS,
		publicKey: 'MULTISIG_ACCOUNT_PUBLIC_KEY_1234567890ABCDEF1234567890ABCDEF',
		cosignatories: [currentAccount.address, cosignerAccount1.address, cosignerAccount2.address]
	})
	.setBalance(MULTISIG_ACCOUNT_BALANCE)
	.setMinApproval(2)
	.setMinRemoval(2)
	.build();

// Transaction Fee Fixtures

const transactionFees = TransactionFeeFixtureBuilder
	.createWithAmounts('0.1', '0.2', '0.3', CHAIN_NAME, NETWORK_IDENTIFIER)
	.build();

// Mock Transaction Bundle

const mockInnerTransaction = {
	type: 'multisigAccountModification',
	signerAddress: multisigAccountInfo.address,
	minApprovalDelta: 0,
	minRemovalDelta: 0,
	addressAdditions: [],
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

// Route Props Factory

const createRouteProps = (accountAddress, preloadedData = null) => ({
	route: {
		params: {
			chainName: CHAIN_NAME,
			accountAddress,
			preloadedData
		}
	}
});

// Multisig Module Mock Factory

const createMultisigModuleMock = (accountInfo = multisigAccountInfo) => ({
	fetchAccountInfo: jest.fn().mockResolvedValue(accountInfo),
	calculateDeltas: jest.fn().mockReturnValue({
		minApprovalDelta: 0,
		minRemovalDelta: 0,
		addressAdditions: [],
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
		walletAccounts = [currentAccount, cosignerAccount1, cosignerAccount2, cosignerAccount3, cosignerAccount4],
		contacts = [],
		multisigAccountInfoOverride = multisigAccountInfo
	} = config;

	mockLocalization();

	const multisigModuleMock = createMultisigModuleMock(multisigAccountInfoOverride);

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
			multisig: multisigModuleMock,
			transfer: createTransferModuleMock()
		}
	});

	return { walletControllerMock, multisigModuleMock };
};

describe('screens/multisig/ModifyMultisigAccount', () => {
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
			const props = createRouteProps(multisigAccountInfo.address);
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
			const screenTester = new ScreenTester(ModifyMultisigAccount, props);
			await screenTester.waitForTimer(); // fetch account info

			// Assert:
			screenTester.expectText(expectedTexts);
		});
	});

	describe('multisig account info', () => {
		it('renders account from route params with address and balance', async () => {
			// Arrange:
			setupMocks();
			const props = createRouteProps(multisigAccountInfo.address);

			// Act:
			const screenTester = new ScreenTester(ModifyMultisigAccount, props);
			await screenTester.waitForTimer(); // fetch account info

			// Assert:
			screenTester.expectText([
				multisigAccountInfo.address,
				MULTISIG_ACCOUNT_BALANCE
			]);
		});

		it('uses preloaded data when provided in route params', async () => {
			// Arrange:
			setupMocks();
			const props = createRouteProps(multisigAccountInfo.address, multisigAccountInfo);

			// Act:
			const screenTester = new ScreenTester(ModifyMultisigAccount, props);

			// Assert:
			screenTester.expectText([
				multisigAccountInfo.address,
				MULTISIG_ACCOUNT_BALANCE
			]);
		});
	});

	describe('account info fetching', () => {
		it('fetches account info by address on mount', async () => {
			// Arrange:
			const { multisigModuleMock } = setupMocks();
			const props = createRouteProps(multisigAccountInfo.address);

			// Act:
			new ScreenTester(ModifyMultisigAccount, props);
			await jest.runAllTimersAsync();

			// Assert:
			expect(multisigModuleMock.fetchAccountInfo).toHaveBeenCalledWith(multisigAccountInfo.address);
			expect(multisigModuleMock.fetchAccountInfo).toHaveBeenCalledTimes(1);
		});
	});

	describe('cosignatory section', () => {
		it('renders cosigner list from account info', async () => {
			// Arrange:
			setupMocks();
			const props = createRouteProps(multisigAccountInfo.address);

			// Act:
			const screenTester = new ScreenTester(ModifyMultisigAccount, props);
			await screenTester.waitForTimer(); // fetch account info

			// Assert:
			// Account info has cosignatories: [currentAccount, cosigner1, cosigner2]
			screenTester.expectText([
				currentAccount.address,
				cosignerAccount1.address,
				cosignerAccount2.address
			]);
		});

		describe('modifying cosignatory list', () => {
			const runCosignatoryModificationTest = (description, config, expected) => {
				it(description, async () => {
					// Arrange:
					setupMocks();
					const props = createRouteProps(multisigAccountInfo.address);
					const screenTester = new ScreenTester(ModifyMultisigAccount, props);
					await screenTester.waitForTimer(); // fetch account info

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
							{ type: ACTION_TYPE.ADD_COSIGNATORY, address: cosignerAccount3.address }
						]
					},
					expected: {
						visibleAddresses: [
							currentAccount.address,
							cosignerAccount1.address,
							cosignerAccount2.address,
							cosignerAccount3.address
						],
						warningVisible: false
					}
				},
				{
					description: 'removes cosigner when pressing delete button',
					config: {
						actions: [
							{ type: ACTION_TYPE.REMOVE_COSIGNATORY, index: 2 } // remove cosignerAccount2
						]
					},
					expected: {
						visibleAddresses: [currentAccount.address, cosignerAccount1.address],
						notVisibleAddresses: [cosignerAccount2.address],
						warningVisible: false
					}
				},
				{
					description: 'shows warning when current account is removed from list',
					config: {
						actions: [
							{ type: ACTION_TYPE.REMOVE_COSIGNATORY, index: 0 } // remove current account
						]
					},
					expected: {
						visibleAddresses: [cosignerAccount1.address, cosignerAccount2.address],
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
				const props = createRouteProps(multisigAccountInfo.address);
				const screenTester = new ScreenTester(ModifyMultisigAccount, props);
				await screenTester.waitForTimer(); // fetch account info

				// Add cosigners if needed
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
				description: 'shows initial approval and removal values from account info (2 of 3)',
				config: {
					cosignersToAdd: [],
					actions: []
				},
				expected: {
					approvalsText: '2 of 3',
					removalsText: '2 of 3'
				}
			},
			{
				description: 'increments approval when pressing plus for approvals',
				config: {
					cosignersToAdd: [cosignerAccount3.address],
					actions: [
						{ type: ACTION_TYPE.INCREMENT_APPROVAL }
					]
				},
				expected: {
					approvalsText: '3 of 4',
					removalsText: '2 of 4'
				}
			},
			{
				description: 'increments removal when pressing plus for removals',
				config: {
					cosignersToAdd: [cosignerAccount3.address],
					actions: [
						{ type: ACTION_TYPE.INCREMENT_REMOVAL }
					]
				},
				expected: {
					approvalsText: '2 of 4',
					removalsText: '3 of 4'
				}
			},
			{
				description: 'decrements approval when pressing minus for approvals',
				config: {
					cosignersToAdd: [],
					actions: [
						{ type: ACTION_TYPE.DECREMENT_APPROVAL }
					]
				},
				expected: {
					approvalsText: '1 of 3',
					removalsText: '2 of 3'
				}
			},
			{
				description: 'decrements removal when pressing minus for removals',
				config: {
					cosignersToAdd: [],
					actions: [
						{ type: ACTION_TYPE.DECREMENT_REMOVAL }
					]
				},
				expected: {
					approvalsText: '2 of 3',
					removalsText: '1 of 3'
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
				const props = createRouteProps(multisigAccountInfo.address);
				const screenTester = new ScreenTester(ModifyMultisigAccount, props);
				await screenTester.waitForTimer(); // fetch account info
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
						{ type: ACTION_TYPE.REMOVE_COSIGNATORY, index: 0 },
						{ type: ACTION_TYPE.REMOVE_COSIGNATORY, index: 0 },
						{ type: ACTION_TYPE.REMOVE_COSIGNATORY, index: 0 }
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
			const props = createRouteProps(multisigAccountInfo.address);
			const screenTester = new ScreenTester(ModifyMultisigAccount, props);
			await screenTester.waitForTimer(); // fetch account info
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

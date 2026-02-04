import { TransactionScreenTemplate } from '@/app/components/templates/TransactionScreenTemplate/TransactionScreenTemplate';
import { AccountFixtureBuilder } from '__fixtures__/local/AccountFixtureBuilder';
import { TokenFixtureBuilder } from '__fixtures__/local/TokenFixtureBuilder';
import { ScreenTester } from '__tests__/ScreenTester';
import { mockLocalization, mockPasscode, mockWalletController } from '__tests__/mock-helpers';
import React from 'react';
import { Text } from 'react-native';

// Constants

const SCREEN_TEXT = {
	// Buttons
	buttonSend: 'button_send',
	buttonConfirm: 'button_confirm',
	buttonCancel: 'button_cancel',
	// Dialog
	textConfirmDialogTitle: 'form_transfer_confirm_title',
	textCustomConfirmTitle: 'Custom Confirm Title',
	textCustomConfirmText: 'Custom confirm text message',
	// Multisig warning
	textMultisigWarningTitle: 'warning_multisig_title',
	textMultisigWarningBody: 'warning_multisig_body',
	// Children content
	textChildrenContent: 'Test Form Content'
};

// Account Fixtures

const RECIPIENT_ACCOUNT = AccountFixtureBuilder
	.createWithAccount('symbol', 'testnet', 0)
	.build();

const COSIGNATORY_ACCOUNT_1 = AccountFixtureBuilder
	.createWithAccount('symbol', 'testnet', 1)
	.build();

const COSIGNATORY_ACCOUNT_2 = AccountFixtureBuilder
	.createWithAccount('symbol', 'testnet', 2)
	.build();

const COSIGNATORIES = [COSIGNATORY_ACCOUNT_1.address, COSIGNATORY_ACCOUNT_2.address];

// Token Fixtures

const TRANSACTION_FEE_TOKEN = TokenFixtureBuilder
	.createWithToken('symbol', 'testnet', 0)
	.setAmount(100000)
	.build();

// Transaction Fixtures

const MOCK_TRANSACTION = {
	type: 'transfer',
	recipientAddress: RECIPIENT_ACCOUNT.address,
	mosaics: [],
	message: 'test message'
};

const MOCK_TRANSACTION_BUNDLE = {
	transactions: [MOCK_TRANSACTION],
	isComposite: false,
	applyFeeTier: jest.fn()
};

const MOCK_SIGNED_BUNDLE = {
	transactions: [{ hash: 'ABC123DEF456' }]
};

const TRANSACTION_FEE_TIERS = [{
	slow: { token: TRANSACTION_FEE_TOKEN },
	medium: { token: { ...TRANSACTION_FEE_TOKEN, amount: 200000 } },
	fast: { token: { ...TRANSACTION_FEE_TOKEN, amount: 300000 } }
}];

// Confirmation Preview

const CONFIRMATION_PREVIEW_ROWS = [
	{ title: 'Recipient', value: RECIPIENT_ACCOUNT.address },
	{ title: 'Amount', value: '100 XYM' }
];

// Mock Helpers

const createMockWalletController = (overrides = {}) => {
	return mockWalletController({
		signTransactionBundle: jest.fn().mockResolvedValue(MOCK_SIGNED_BUNDLE),
		announceSignedTransactionBundle: jest.fn().mockResolvedValue({}),
		modules: {
			addressBook: {
				getByAddress: jest.fn().mockReturnValue(null),
				getContactByAddress: jest.fn().mockReturnValue(null)
			}
		},
		...overrides
	});
};

const createDefaultProps = (overrides = {}) => ({
	isLoading: false,
	isSendButtonDisabled: false,
	isMultisigAccount: false,
	accountCosignatories: [],
	children: <Text>{SCREEN_TEXT.textChildrenContent}</Text>,
	createTransaction: jest.fn().mockResolvedValue(MOCK_TRANSACTION_BUNDLE),
	getConfirmationPreview: jest.fn().mockReturnValue(CONFIRMATION_PREVIEW_ROWS),
	onCreateTransactionError: jest.fn(),
	onSendSuccess: jest.fn(),
	onSendError: jest.fn(),
	onComplete: jest.fn(),
	walletController: createMockWalletController(),
	transactionFeeTiers: TRANSACTION_FEE_TIERS,
	transactionFeeTierLevel: 'medium',
	isCustomSendButtonUsed: false,
	...overrides
});

describe('components/templates/TransactionScreenTemplate', () => {
	beforeEach(() => {
		mockLocalization();
		jest.clearAllMocks();
	});

	describe('render', () => {
		it('renders children content and send button', () => {
			// Arrange:
			const props = createDefaultProps();

			// Act:
			const screenTester = new ScreenTester(TransactionScreenTemplate, props);

			// Assert:
			screenTester.expectText([
				SCREEN_TEXT.textChildrenContent,
				SCREEN_TEXT.buttonSend
			]);
		});

		it('hides send button when isCustomSendButtonUsed is true', () => {
			// Arrange:
			const props = createDefaultProps({ isCustomSendButtonUsed: true });

			// Act:
			const screenTester = new ScreenTester(TransactionScreenTemplate, props);

			// Assert:
			screenTester.expectText([SCREEN_TEXT.textChildrenContent]);
			screenTester.notExpectText([SCREEN_TEXT.buttonSend]);
		});

		describe('send button state', () => {
			const runSendButtonStateTest = (description, config, expected) => {
				it(description, () => {
					// Arrange:
					const props = createDefaultProps({
						isSendButtonDisabled: config.isSendButtonDisabled
					});

					// Act:
					const screenTester = new ScreenTester(TransactionScreenTemplate, props);

					// Assert:
					if (expected.isDisabled)
						screenTester.expectButtonDisabled(SCREEN_TEXT.buttonSend);
					else
						screenTester.expectButtonEnabled(SCREEN_TEXT.buttonSend);
				});
			};

			const sendButtonStateTests = [
				{
					description: 'disables send button when isSendButtonDisabled is true',
					config: { isSendButtonDisabled: true },
					expected: { isDisabled: true }
				},
				{
					description: 'enables send button when isSendButtonDisabled is false',
					config: { isSendButtonDisabled: false },
					expected: { isDisabled: false }
				}
			];

			sendButtonStateTests.forEach(test => {
				runSendButtonStateTest(test.description, test.config, test.expected);
			});
		});
	});

	describe('multisig account', () => {
		it('shows multisig warning when isMultisigAccount is true', () => {
			// Arrange:
			const props = createDefaultProps({
				isMultisigAccount: true,
				accountCosignatories: COSIGNATORIES
			});

			// Act:
			const screenTester = new ScreenTester(TransactionScreenTemplate, props);

			// Assert:
			screenTester.expectText([SCREEN_TEXT.textMultisigWarningTitle]);
			screenTester.notExpectText([SCREEN_TEXT.textChildrenContent]);
		});

		it('hides multisig warning when isMultisigAccount is false', () => {
			// Arrange:
			const props = createDefaultProps({
				isMultisigAccount: false,
				accountCosignatories: []
			});

			// Act:
			const screenTester = new ScreenTester(TransactionScreenTemplate, props);

			// Assert:
			screenTester.notExpectText([SCREEN_TEXT.textMultisigWarningTitle]);
			screenTester.expectText([SCREEN_TEXT.textChildrenContent]);
		});
	});

	describe('confirmation dialog', () => {
		it('shows confirmation dialog when send button is pressed', async () => {
			// Arrange:
			const props = createDefaultProps();
			const screenTester = new ScreenTester(TransactionScreenTemplate, props);

			// Act:
			screenTester.pressButton(SCREEN_TEXT.buttonSend);
			await screenTester.waitForTimer();

			// Assert:
			screenTester.expectText([SCREEN_TEXT.textConfirmDialogTitle]);
		});

		it('shows custom dialog title when provided', async () => {
			// Arrange:
			const props = createDefaultProps({
				confirmDialogTitle: SCREEN_TEXT.textCustomConfirmTitle,
				confirmDialogText: SCREEN_TEXT.textCustomConfirmText
			});
			const screenTester = new ScreenTester(TransactionScreenTemplate, props);

			// Act:
			screenTester.pressButton(SCREEN_TEXT.buttonSend);
			await screenTester.waitForTimer();

			// Assert:
			screenTester.expectText([
				SCREEN_TEXT.textCustomConfirmTitle,
				SCREEN_TEXT.textCustomConfirmText
			]);
		});

		it('calls createTransaction when send button is pressed', async () => {
			// Arrange:
			const createTransactionMock = jest.fn().mockResolvedValue(MOCK_TRANSACTION_BUNDLE);
			const props = createDefaultProps({ createTransaction: createTransactionMock });
			const screenTester = new ScreenTester(TransactionScreenTemplate, props);

			// Act:
			screenTester.pressButton(SCREEN_TEXT.buttonSend);
			await screenTester.waitForTimer();

			// Assert:
			expect(createTransactionMock).toHaveBeenCalledTimes(1);
		});

		it('hides confirmation dialog when cancel is pressed', async () => {
			// Arrange:
			const props = createDefaultProps();
			const screenTester = new ScreenTester(TransactionScreenTemplate, props);

			// Act:
			screenTester.pressButton(SCREEN_TEXT.buttonSend);
			await screenTester.waitForTimer();
			screenTester.pressButton(SCREEN_TEXT.buttonCancel);

			// Assert:
			screenTester.notExpectText([SCREEN_TEXT.textConfirmDialogTitle]);
		});
	});

	describe('transaction send workflow', () => {
		it('signs and announces transaction after confirmation', async () => {
			// Arrange:
			const signMock = jest.fn().mockResolvedValue(MOCK_SIGNED_BUNDLE);
			const announceMock = jest.fn().mockResolvedValue({});
			const walletController = createMockWalletController({
				signTransactionBundle: signMock,
				announceSignedTransactionBundle: announceMock
			});
			const props = createDefaultProps({ walletController });
			mockPasscode();
			const screenTester = new ScreenTester(TransactionScreenTemplate, props);

			// Act:
			screenTester.pressButton(SCREEN_TEXT.buttonSend);
			await screenTester.waitForTimer(); // create transaction
			screenTester.pressButton(SCREEN_TEXT.buttonConfirm);
			await screenTester.waitForTimer(); // passcode + delay
			await screenTester.waitForTimer(); // sign
			await screenTester.waitForTimer(); // announce

			// Assert:
			expect(signMock).toHaveBeenCalledWith(MOCK_TRANSACTION_BUNDLE);
			expect(announceMock).toHaveBeenCalledWith(MOCK_SIGNED_BUNDLE);
		});

		it('calls onSendSuccess after successful transaction send', async () => {
			// Arrange:
			const onSendSuccessMock = jest.fn();
			const walletController = createMockWalletController();
			const props = createDefaultProps({
				walletController,
				onSendSuccess: onSendSuccessMock
			});
			mockPasscode();
			const screenTester = new ScreenTester(TransactionScreenTemplate, props);

			// Act:
			screenTester.pressButton(SCREEN_TEXT.buttonSend);
			await screenTester.waitForTimer(); // create transaction
			screenTester.pressButton(SCREEN_TEXT.buttonConfirm);
			await screenTester.waitForTimer(); // passcode + delay
			await screenTester.waitForTimer(); // sign
			await screenTester.waitForTimer(); // announce

			// Assert:
			expect(onSendSuccessMock).toHaveBeenCalledTimes(1);
		});
	});

	describe('render function children', () => {
		it('passes button props to children when children is a function', () => {
			// Arrange:
			const childrenFn = jest.fn().mockReturnValue(<Text>Custom Button Content</Text>);
			const props = createDefaultProps({
				children: childrenFn,
				isCustomSendButtonUsed: true
			});

			// Act:
			new ScreenTester(TransactionScreenTemplate, props);

			// Assert:
			expect(childrenFn).toHaveBeenCalledWith(expect.objectContaining({
				text: SCREEN_TEXT.buttonSend,
				isDisabled: false,
				onPress: expect.any(Function)
			}));
		});
	});
});

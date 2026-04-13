import { SymbolTransactionType, TransactionGroup } from '@/app/constants';
import { TransactionDetails } from '@/app/screens/history/TransactionDetails';
import { formatDate } from '@/app/utils';
import { AccountFixtureBuilder } from '__fixtures__/local/AccountFixtureBuilder';
import { AggregateTransactionFixtureBuilder } from '__fixtures__/local/AggregateTransactionFixtureBuilde';
import { ContactFixtureBuilder } from '__fixtures__/local/ContactFixtureBuilder';
import { NetworkPropertiesFixtureBuilder } from '__fixtures__/local/NetworkPropertiesFixtureBuilder';
import { TokenFixtureBuilder } from '__fixtures__/local/TokenFixtureBuilder';
import { TransferTransactionFixtureBuilder } from '__fixtures__/local/TransferTransactionFixtureBuilder';
import { ScreenTester } from '__tests__/ScreenTester';
import { 
	createAddressBookMock, 
	mockLink, 
	mockLocalization, 
	mockPasscode, 
	mockWalletController 
} from '__tests__/mock-helpers';

// Mocks

jest.mock('@react-navigation/native', () => ({
	...jest.requireActual('@react-navigation/native'),
	useIsFocused: () => true,
	useNavigation: () => ({
		navigate: jest.fn(),
		goBack: jest.fn()
	})
}));

// Constants

const CHAIN_NAME = 'symbol';
const NETWORK_IDENTIFIER = 'testnet';
const TICKER = 'XYM';

const TRANSACTION_HASH = '0C905EB065E6A42029CD1A10E710422761495A63D433535BA6EAA9BCF36AB8B6';
const TRANSACTION_TIMESTAMP = 1684265310994;
const TRANSFER_XYM_AMOUNT = '1234';
const TRANSFER_CUSTOM_TOKEN_AMOUNT = '56.78';
const TRANSFER_MESSAGE_TEXT = 'Test transfer message';

// Screen Text

const SCREEN_TEXT = {
	// Field titles
	textFieldAmount: 's_transactionDetails_amount',
	textFieldStatus: 's_transactionDetails_status',
	textFieldDate: 's_transactionDetails_date',

	// Transaction breakdown
	textAmountBreakdownTitle: 's_transactionDetails_amountBreakdown_title',

	// Transaction statuses
	textStatusConfirmed: 'transactionStatus_confirmed',
	textStatusPartial: 'transactionStatus_partial',
	textStatusUnconfirmed: 'transactionStatus_unconfirmed',

	// Transaction types
	textTransactionTransferOutgoing: 'transactionDescriptor_16724_outgoing',
	textTransactionAggregateBonded: 'transactionDescriptor_16961',
	textTransactionMultisigAccountModification: 'transactionDescriptor_16725',

	// Cosign alerts
	textAlertSigned: 's_transactionDetails_cosignAlert_signed',
	textAlertAwaitingSignature: 's_transactionDetails_cosignAlert_trustedAccount',

	// Safety warning
	textSafetyWarning: 's_transactionDetails_safetyWarning_description',

	// Dialog titles and text
	textDialogConfirmTitle: 's_transactionDetails_cosignDialog_confirm_title',
	textDialogConfirmText: 's_transactionDetails_cosignDialog_confirm_text',
	textDialogSuccessTitle: 's_transactionDetails_cosignDialog_success_title',
	textDialogSuccessText: 's_transactionDetails_cosignDialog_success_text',

	// Buttons
	buttonSignAndApprove: 'button_signAndApprove',
	buttonOpenExplorer: 'button_openTransactionInExplorer',

	// Dialog buttons
	buttonDialogConfirm: 'button_confirm',
	buttonDialogOk: 'button_ok'
};

// Account Fixtures

const currentAccount = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.build();

const recipientAccount = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 1)
	.build();

const otherSignerAccount = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 2)
	.build();

const walletAccounts = [currentAccount, recipientAccount];

// Network Properties Fixtures

const networkProperties = NetworkPropertiesFixtureBuilder
	.createWithType(CHAIN_NAME, NETWORK_IDENTIFIER)
	.build();

// Token Fixtures

const tokenXym = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.setAmount(TRANSFER_XYM_AMOUNT)
	.build();

const tokenCustom = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME, NETWORK_IDENTIFIER, 1)
	.setAmount(TRANSFER_CUSTOM_TOKEN_AMOUNT)
	.build();

// Contact Fixtures

const recipientContact = ContactFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 1)
	.setName('Recipient Contact')
	.build();

const otherSignerContact = ContactFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 2)
	.setName('Other Signer Contact')
	.build();

// Transfer Transaction Fixtures

const transferTransaction = TransferTransactionFixtureBuilder
	.createDefault(CHAIN_NAME, NETWORK_IDENTIFIER)
	.setHash(TRANSACTION_HASH)
	.setTimestamp(TRANSACTION_TIMESTAMP)
	.setSigner(currentAccount)
	.setRecipientAddress(recipientAccount.address)
	.setMosaics([tokenXym, tokenCustom])
	.setPlainMessage(TRANSFER_MESSAGE_TEXT)
	.setAmount(`-${TRANSFER_XYM_AMOUNT}`)
	.build();

// Inner Transaction Fixtures

const innerTransferFromCurrentAccount = TransferTransactionFixtureBuilder
	.createDefault(CHAIN_NAME, NETWORK_IDENTIFIER)
	.setSigner(currentAccount)
	.setRecipientAddress(recipientAccount.address)
	.setMosaics([tokenXym])
	.setAmount(`-${TRANSFER_XYM_AMOUNT}`)
	.build();

const innerTransferFromOtherAccount = TransferTransactionFixtureBuilder
	.createDefault(CHAIN_NAME, NETWORK_IDENTIFIER)
	.setSigner(otherSignerAccount)
	.setRecipientAddress(currentAccount.address)
	.setMosaics([tokenXym])
	.setAmount(TRANSFER_XYM_AMOUNT)
	.build();

const innerMultisigAccountModification = {
	type: SymbolTransactionType.MULTISIG_ACCOUNT_MODIFICATION,
	signerAddress: otherSignerAccount.address,
	signerPublicKey: otherSignerAccount.publicKey,
	minApprovalDelta: 1,
	minRemovalDelta: 1,
	addressAdditions: [currentAccount.address],
	addressDeletions: []
};

// Aggregate Transaction Fixtures

const aggregateBondedSignedByCurrentAccount = AggregateTransactionFixtureBuilder
	.createDefaultBonded(CHAIN_NAME, NETWORK_IDENTIFIER)
	.setHash(TRANSACTION_HASH)
	.setTimestamp(TRANSACTION_TIMESTAMP)
	.setSigner(currentAccount)
	.setInnerTransactions([innerTransferFromCurrentAccount])
	.build();

const aggregateBondedSignedByOtherAccount = AggregateTransactionFixtureBuilder
	.createDefaultBonded(CHAIN_NAME, NETWORK_IDENTIFIER)
	.setHash(TRANSACTION_HASH)
	.setTimestamp(TRANSACTION_TIMESTAMP)
	.setSigner(otherSignerAccount)
	.setInnerTransactions([innerTransferFromOtherAccount])
	.build();

const aggregateBondedWithMultisigModification = AggregateTransactionFixtureBuilder
	.createDefaultBonded(CHAIN_NAME, NETWORK_IDENTIFIER)
	.setHash(TRANSACTION_HASH)
	.setTimestamp(TRANSACTION_TIMESTAMP)
	.setSigner(otherSignerAccount)
	.setInnerTransactions([innerMultisigAccountModification])
	.build();

// Address Book Configurations

const addressBookWithContacts = createAddressBookMock([recipientContact, otherSignerContact]);

// Wallet Controller Configuration

const createWalletControllerConfig = (overrides = {}) => ({
	chainName: CHAIN_NAME,
	ticker: TICKER,
	networkIdentifier: NETWORK_IDENTIFIER,
	networkProperties,
	currentAccount,
	isWalletReady: true,
	accounts: {
		[NETWORK_IDENTIFIER]: walletAccounts
	},
	modules: {
		addressBook: addressBookWithContacts
	},
	fetchTransactionStatus: jest.fn().mockResolvedValue({ group: TransactionGroup.CONFIRMED }),
	fetchAccountTransaction: jest.fn().mockImplementation(hash => 
		Promise.resolve({ ...transferTransaction, hash })),
	cosignTransaction: jest.fn().mockResolvedValue({}),
	announceSignedTransaction: jest.fn().mockResolvedValue({}),
	...overrides
});

// Route Props Factory

const createRouteProps = (transaction, group = TransactionGroup.CONFIRMED) => ({
	route: {
		params: {
			chainName: CHAIN_NAME,
			transaction,
			group
		}
	}
});

// Setup

const setupMocks = (walletControllerConfig = {}) => {
	jest.useFakeTimers();
	mockLocalization();
	mockPasscode();
	return mockWalletController(createWalletControllerConfig(walletControllerConfig));
};

describe('screens/history/TransactionDetails', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
	});

	describe('render', () => {
		it('renders screen text with field titles, button and amount breakdown title', () => {
			// Arrange:
			setupMocks();
			const props = createRouteProps(transferTransaction);
			const expectedTexts = [
				SCREEN_TEXT.textFieldAmount,
				SCREEN_TEXT.textFieldStatus,
				SCREEN_TEXT.textFieldDate,
				SCREEN_TEXT.textAmountBreakdownTitle,
				SCREEN_TEXT.buttonOpenExplorer
			];

			// Act:
			const screenTester = new ScreenTester(TransactionDetails, props);

			// Assert:
			screenTester.expectText(expectedTexts);
		});
	});

	describe('data fetching', () => {
		it('fetches transaction status after refresh interval', async () => {
			// Arrange:
			const walletControllerMock = setupMocks();
			const props = createRouteProps(transferTransaction);

			// Act:
			const screenTester = new ScreenTester(TransactionDetails, props);
			// Wait for the refresh interval (10000ms) to trigger data fetch
			await screenTester.waitForTimer(10000);
			// Additional wait for async callback completion
			await screenTester.waitForTimer();

			// Assert:
			expect(walletControllerMock.fetchTransactionStatus).toHaveBeenCalledWith(TRANSACTION_HASH);
		});
	});

	describe('transaction info', () => {
		it('renders transfer transaction details with amounts, timestamp, hash, addresses and message', () => {
			// Arrange:
			setupMocks();
			const props = createRouteProps(transferTransaction);
			const dateText = formatDate(TRANSACTION_TIMESTAMP, t => t, true);
			const expectedTexts = [
				SCREEN_TEXT.textTransactionTransferOutgoing,
				SCREEN_TEXT.textStatusConfirmed,
				dateText,
				TRANSACTION_HASH,
				`-${TRANSFER_XYM_AMOUNT}`,
				TICKER,
				`${TRANSFER_XYM_AMOUNT} ${TICKER}`,
				TRANSFER_MESSAGE_TEXT,
				currentAccount.address,
				recipientAccount.address
			];

			// Act:
			const screenTester = new ScreenTester(TransactionDetails, props);

			// Assert:
			screenTester.expectText(expectedTexts, true);
		});
	});

	describe('multisig transactions', () => {
		const runMultisigTransactionTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				setupMocks(config.walletControllerOverrides);
				const props = createRouteProps(config.transaction, config.group);

				// Act:
				const screenTester = new ScreenTester(TransactionDetails, props);

				// Assert:
				screenTester.expectText(expected.visibleTexts, true);

				if (expected.notVisibleTexts?.length)
					screenTester.notExpectText(expected.notVisibleTexts);
			});
		};

		const multisigTransactionTests = [
			{
				description: 'renders signed alert and no sign button when signed by current account',
				config: {
					transaction: aggregateBondedSignedByCurrentAccount,
					group: TransactionGroup.PARTIAL,
					walletControllerOverrides: {
						fetchTransactionStatus: jest.fn().mockResolvedValue({ group: TransactionGroup.PARTIAL })
					}
				},
				expected: {
					visibleTexts: [
						SCREEN_TEXT.textAlertSigned,
						SCREEN_TEXT.textStatusPartial
					],
					notVisibleTexts: [
						SCREEN_TEXT.buttonSignAndApprove
					]
				}
			},
			{
				description: 'renders awaiting signature alert and sign button when awaiting current account signature',
				config: {
					transaction: aggregateBondedSignedByOtherAccount,
					group: TransactionGroup.PARTIAL,
					walletControllerOverrides: {
						fetchTransactionStatus: jest.fn().mockResolvedValue({ group: TransactionGroup.PARTIAL }),
						modules: {
							addressBook: addressBookWithContacts
						}
					}
				},
				expected: {
					visibleTexts: [
						SCREEN_TEXT.textAlertAwaitingSignature,
						SCREEN_TEXT.buttonSignAndApprove
					],
					notVisibleTexts: []
				}
			},
			{
				description: 'renders safety warning and awaiting signature alerts for dangerous transaction',
				config: {
					transaction: aggregateBondedWithMultisigModification,
					group: TransactionGroup.PARTIAL,
					walletControllerOverrides: {
						fetchTransactionStatus: jest.fn().mockResolvedValue({ group: TransactionGroup.PARTIAL }),
						modules: {
							addressBook: addressBookWithContacts
						}
					}
				},
				expected: {
					visibleTexts: [
						SCREEN_TEXT.textSafetyWarning,
						SCREEN_TEXT.textAlertAwaitingSignature,
						SCREEN_TEXT.buttonSignAndApprove
					],
					notVisibleTexts: []
				}
			}
		];

		multisigTransactionTests.forEach(test => {
			runMultisigTransactionTest(test.description, test.config, test.expected);
		});
	});

	describe('cosign flow', () => {
		it('completes cosign transaction flow with confirmation and success dialogs', async () => {
			// Arrange:
			const walletControllerMock = setupMocks({
				fetchTransactionStatus: jest.fn().mockResolvedValue({ group: TransactionGroup.PARTIAL }),
				modules: {
					addressBook: addressBookWithContacts
				}
			});
			const props = createRouteProps(aggregateBondedSignedByOtherAccount, TransactionGroup.PARTIAL);
			const screenTester = new ScreenTester(TransactionDetails, props);

			// Act - Step 1: Press sign button
			screenTester.pressButton(SCREEN_TEXT.buttonSignAndApprove);

			// Assert - Confirmation dialog appears
			screenTester.expectText([
				SCREEN_TEXT.textDialogConfirmTitle,
				SCREEN_TEXT.textDialogConfirmText
			]);

			// Act - Step 2: Confirm dialog
			screenTester.pressButton(SCREEN_TEXT.buttonDialogConfirm);
			await screenTester.waitForTimer();

			// Assert - Cosign was called
			expect(walletControllerMock.cosignTransaction).toHaveBeenCalledWith(aggregateBondedSignedByOtherAccount);

			// Assert - Success dialog appears
			screenTester.expectText([
				SCREEN_TEXT.textDialogSuccessTitle,
				SCREEN_TEXT.textDialogSuccessText
			]);

			// Act - Step 3: Acknowledge success
			screenTester.pressButton(SCREEN_TEXT.buttonDialogOk);
			await screenTester.waitForTimer();

			// Assert - Transaction status was refreshed
			expect(walletControllerMock.fetchTransactionStatus).toHaveBeenCalled();
		});
	});

	describe('navigation', () => {
		const runNavigationTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				setupMocks();
				const openLinkMock = mockLink();
				const props = createRouteProps(config.transaction, config.group);
				const screenTester = new ScreenTester(TransactionDetails, props);

				// Act:
				screenTester.pressButton(config.buttonText);

				// Assert:
				expect(openLinkMock).toHaveBeenCalledWith(expected.url);
			});
		};

		const navigationTests = [
			{
				description: 'opens block explorer with proper URL when button is pressed',
				config: {
					transaction: transferTransaction,
					group: TransactionGroup.CONFIRMED,
					buttonText: SCREEN_TEXT.buttonOpenExplorer
				},
				expected: {
					url: `https://testnet.symbol.fyi/transactions/${TRANSACTION_HASH}`
				}
			}
		];

		navigationTests.forEach(test => {
			runNavigationTest(test.description, test.config, test.expected);
		});
	});
});

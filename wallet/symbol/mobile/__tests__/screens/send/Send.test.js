import * as hooks from '@/app/hooks';
import { Send } from '@/app/screens/send/Send';
import { AccountFixtureBuilder } from '__fixtures__/local/AccountFixtureBuilder';
import { AccountInfoFixtureBuilder } from '__fixtures__/local/AccountInfoFixtureBuilder';
import { NetworkPropertiesFixtureBuilder } from '__fixtures__/local/NetworkPropertiesFixtureBuilder';
import { TokenFixtureBuilder } from '__fixtures__/local/TokenFixtureBuilder';
import { ScreenTester } from '__tests__/ScreenTester';
import { mockLocalization, mockPasscode, mockRouter, mockWalletController } from '__tests__/mock-helpers';

// Constants

const CHAIN_NAME = 'symbol';
const NETWORK_IDENTIFIER = 'testnet';
const TICKER = 'XYM';
const CHAIN_HEIGHT = 1319595;
const PRICE = 0.05;

// Screen Text

const SCREEN_TEXT = {
	// Screen content
	textTitle: 'form_transfer_title',
	textDescription: 's_send_description',
	textMultisigDescription: 's_send_multisig_description',

	// Input labels
	inputRecipientLabel: 'form_transfer_input_recipient',
	inputMosaicLabel: 'form_transfer_input_mosaic',
	inputAmountLabel: 'form_transfer_input_amount',
	inputMessageLabel: 'form_transfer_input_message',
	inputSenderLabel: 'input_sender',

	// Checkbox
	checkboxEncrypted: 'form_transfer_input_encrypted',

	// Buttons
	buttonSend: 'button_send'
};

// Account Fixtures

const currentAccount = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.data;

const recipientAccount = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 2)
	.data;

const multisigAccount = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 3)
	.data;

// Token Fixtures

const nativeToken = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.setAmount('1000000000')
	.override({ duration: 0 })
	.data;

const customToken = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME, NETWORK_IDENTIFIER, 1)
	.setAmount('500000')
	.override({ duration: 0 })
	.data;

const TOKEN_LIST = [nativeToken, customToken];

// Network Properties Fixtures

const NETWORK_PROPERTIES = NetworkPropertiesFixtureBuilder
	.createWithType(CHAIN_NAME, NETWORK_IDENTIFIER)
	.setNetworkCurrency({ ...nativeToken })
	.data;


// Account Info Fixtures

const regularAccountInfo = AccountInfoFixtureBuilder
	.createEmpty(CHAIN_NAME, NETWORK_IDENTIFIER)
	.override({
		address: currentAccount.address,
		publicKey: currentAccount.publicKey,
		mosaics: TOKEN_LIST,
		tokens: TOKEN_LIST,
		isMultisig: false,
		cosignatories: [],
		multisigAddresses: []
	})
	.data;

const cosignatoryAccountInfo = AccountInfoFixtureBuilder
	.createEmpty(CHAIN_NAME, NETWORK_IDENTIFIER)
	.override({
		address: currentAccount.address,
		publicKey: currentAccount.publicKey,
		mosaics: TOKEN_LIST,
		tokens: TOKEN_LIST,
		isMultisig: false,
		cosignatories: [],
		multisigAddresses: [multisigAccount.address]
	})
	.data;

// Transaction Fees Fixtures

const TRANSACTION_FEE_TIER = {
	slow: { 
		fee: '100000', 
		feeFormatted: '0.1',
		token: { amount: '0.1', divisibility: 6 }
	},
	medium: { 
		fee: '200000', 
		feeFormatted: '0.2',
		token: { amount: '0.2', divisibility: 6 }
	},
	fast: { 
		fee: '300000', 
		feeFormatted: '0.3',
		token: { amount: '0.3', divisibility: 6 }
	}
};

const TRANSACTION_FEES = [TRANSACTION_FEE_TIER];

// Mock Modules

const createMockAddressBook = (overrides = {}) => ({
	getAddressName: jest.fn(),
	getContactByAddress: jest.fn(),
	...overrides
});

const createMockTransactionBundle = (transactions = [{ type: 16724 }]) => ({
	transactions,
	isComposite: false,
	applyFeeTier: jest.fn()
});

const createMockTransferModule = (overrides = {}) => ({
	createTransaction: jest.fn().mockResolvedValue(createMockTransactionBundle()),
	...overrides
});

const createMockNetworkApi = (overrides = {}) => ({
	account: {
		fetchAccountInfo: jest.fn().mockResolvedValue({
			mosaics: TOKEN_LIST,
			tokens: TOKEN_LIST,
			publicKey: currentAccount.publicKey
		}),
		...overrides.account
	},
	...overrides
});

// Wallet Controller Mock

const mockWalletControllerConfigured = (overrides = {}) => {
	return mockWalletController({
		chainName: overrides.chainName ?? CHAIN_NAME,
		ticker: TICKER,
		networkIdentifier: NETWORK_IDENTIFIER,
		chainHeight: CHAIN_HEIGHT,
		price: PRICE,
		currentAccount: overrides.currentAccount ?? currentAccount,
		currentAccountInfo: overrides.currentAccountInfo ?? regularAccountInfo,
		networkProperties: overrides.networkProperties ?? NETWORK_PROPERTIES,
		isStateReady: overrides.isStateReady ?? true,
		isWalletReady: overrides.isWalletReady ?? true,
		isNetworkConnectionReady: overrides.isNetworkConnectionReady ?? true,
		modules: {
			addressBook: createMockAddressBook(overrides.addressBook),
			transfer: createMockTransferModule(overrides.transfer)
		},
		networkApi: createMockNetworkApi(overrides.networkApi),
		signTransactionBundle: jest.fn().mockResolvedValue({
			transactions: [{ hash: 'mockHash' }]
		}),
		announceSignedTransactionBundle: jest.fn().mockResolvedValue({}),
		...overrides
	});
};

// Route Props

const createRouteProps = (overrides = {}) => ({
	route: {
		params: {
			chainName: CHAIN_NAME,
			...overrides
		}
	}
});

// Transaction Fees Mock

const mockTransactionFees = (data = TRANSACTION_FEES, isLoading = false) => {
	jest.spyOn(hooks, 'useTransactionFees').mockReturnValue({
		data,
		isLoading,
		call: jest.fn()
	});
};

const mockDebounce = () => {
	jest.spyOn(hooks, 'useDebounce').mockImplementation(callback => callback);
};

describe('screens/send/Send', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockLocalization();
		mockTransactionFees(null, false);
		mockDebounce();
	});

	describe('render', () => {
		it('renders send form elements', async () => {
			// Arrange:
			mockWalletControllerConfigured();
			const expectedTexts = [
				SCREEN_TEXT.textTitle,
				SCREEN_TEXT.textDescription,
				SCREEN_TEXT.inputRecipientLabel,
				SCREEN_TEXT.inputMosaicLabel,
				SCREEN_TEXT.inputAmountLabel,
				SCREEN_TEXT.inputMessageLabel,
				SCREEN_TEXT.checkboxEncrypted,
				SCREEN_TEXT.buttonSend
			];
			const props = createRouteProps();

			// Act:
			const screenTester = new ScreenTester(Send, props);
			await screenTester.waitForTimer();

			// Assert:
			screenTester.expectText(expectedTexts);
		});

		it('renders send button as disabled when form is incomplete', async () => {
			// Arrange:
			mockWalletControllerConfigured();
			const props = createRouteProps();

			// Act:
			const screenTester = new ScreenTester(Send, props);
			await screenTester.waitForTimer();

			// Assert:
			screenTester.expectButtonDisabled(SCREEN_TEXT.buttonSend);
		});
	});

	describe('message field visibility', () => {
		const runMessageFieldTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				mockWalletControllerConfigured({ chainName: config.chainName });
				const props = createRouteProps({ chainName: config.chainName });

				// Act:
				const screenTester = new ScreenTester(Send, props);
				await screenTester.waitForTimer();

				// Assert:
				if (expected.hasMessageField) {
					screenTester.expectText([SCREEN_TEXT.inputMessageLabel]);
					screenTester.expectText([SCREEN_TEXT.checkboxEncrypted]);
				} else {
					screenTester.notExpectText([SCREEN_TEXT.inputMessageLabel]);
					screenTester.notExpectText([SCREEN_TEXT.checkboxEncrypted]);
				}
			});
		};

		const messageFieldTests = [
			{
				description: 'shows message field for symbol chain',
				config: { chainName: 'symbol' },
				expected: { hasMessageField: true }
			},
			{
				description: 'hides message field for ethereum chain',
				config: { chainName: 'ethereum' },
				expected: { hasMessageField: false }
			}
		];

		messageFieldTests.forEach(test => {
			runMessageFieldTest(test.description, test.config, test.expected);
		});
	});

	describe('multisig account', () => {
		it('shows sender dropdown when account is cosignatory of multisig', async () => {
			// Arrange:
			mockWalletControllerConfigured({
				currentAccountInfo: cosignatoryAccountInfo
			});
			const props = createRouteProps();

			// Act:
			const screenTester = new ScreenTester(Send, props);
			await screenTester.waitForTimer();

			// Assert:
			screenTester.expectText([SCREEN_TEXT.textMultisigDescription]);
			screenTester.expectText([currentAccount.name]);
		});

		it('does not show sender dropdown for regular account', async () => {
			// Arrange:
			mockWalletControllerConfigured({
				currentAccountInfo: regularAccountInfo
			});
			const props = createRouteProps();

			// Act:
			const screenTester = new ScreenTester(Send, props);
			await screenTester.waitForTimer();

			// Assert:
			screenTester.notExpectText([SCREEN_TEXT.textMultisigDescription]);
			screenTester.notExpectText([SCREEN_TEXT.inputSenderLabel]);
		});
	});

	describe('route params initialization', () => {
		const runRouteParamsTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				mockWalletControllerConfigured();
				const props = createRouteProps(config.routeParams);

				// Act:
				const screenTester = new ScreenTester(Send, props);
				await screenTester.waitForTimer();

				// Assert:
				expected.inputValues.forEach(value => {
					screenTester.expectInputValue(value);
				});
			});
		};

		const routeParamsTests = [
			{
				description: 'initializes with recipient address from route params',
				config: {
					routeParams: { recipientAddress: recipientAccount.address }
				},
				expected: {
					inputValues: [recipientAccount.address]
				}
			},
			{
				description: 'initializes with amount from route params',
				config: {
					routeParams: { amount: '10.5' }
				},
				expected: {
					inputValues: ['10.5']
				}
			},
			{
				description: 'initializes with message from route params',
				config: {
					routeParams: { message: { text: 'Hello World' } }
				},
				expected: {
					inputValues: ['Hello World']
				}
			}
		];

		routeParamsTests.forEach(test => {
			runRouteParamsTest(test.description, test.config, test.expected);
		});
	});

	describe('loading state', () => {
		const runLoadingStateTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				mockWalletControllerConfigured({
					isWalletReady: config.isWalletReady
				});
				const props = createRouteProps();

				// Act:
				const screenTester = new ScreenTester(Send, props);

				// Assert:
				if (expected.isLoading)
					screenTester.expectElement('loading-indicator');
				else
					screenTester.notExpectElement('loading-indicator');
			});
		};

		const loadingStateTests = [
			{
				description: 'shows loading indicator when wallet is not ready',
				config: { isWalletReady: false },
				expected: { isLoading: true }
			},
			{
				description: 'hides loading indicator when wallet is ready',
				config: { isWalletReady: true },
				expected: { isLoading: false }
			}
		];

		loadingStateTests.forEach(test => {
			runLoadingStateTest(test.description, test.config, test.expected);
		});
	});

	describe('send button state', () => {
		const runSendButtonStateTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				mockWalletControllerConfigured({
					isNetworkConnectionReady: config.isNetworkConnectionReady ?? true
				});
				if (config.transactionFees)
					mockTransactionFees(config.transactionFees, false);

				const props = createRouteProps(config.routeParams ?? {});

				// Act:
				const screenTester = new ScreenTester(Send, props);
				await screenTester.waitForTimer();

				// Assert:
				if (expected.isDisabled)
					screenTester.expectButtonDisabled(SCREEN_TEXT.buttonSend);
				else
					screenTester.expectButtonEnabled(SCREEN_TEXT.buttonSend);
			});
		};

		const sendButtonStateTests = [
			{
				description: 'send button is disabled when network is not connected',
				config: {
					isNetworkConnectionReady: false,
					transactionFees: TRANSACTION_FEES,
					routeParams: { recipientAddress: recipientAccount.address, amount: '1' }
				},
				expected: { isDisabled: true }
			},
			{
				description: 'send button is disabled when transaction fees are not loaded',
				config: {
					isNetworkConnectionReady: true,
					transactionFees: null,
					routeParams: { recipientAddress: recipientAccount.address, amount: '1' }
				},
				expected: { isDisabled: true }
			},
			{
				description: 'send button is disabled when recipient is empty',
				config: {
					isNetworkConnectionReady: true,
					transactionFees: TRANSACTION_FEES,
					routeParams: { recipientAddress: '', amount: '1' }
				},
				expected: { isDisabled: true }
			}
		];

		sendButtonStateTests.forEach(test => {
			runSendButtonStateTest(test.description, test.config, test.expected);
		});
	});

	describe('send transaction flow', () => {
		it('initiates transaction when send button is pressed with valid data', async () => {
			// Arrange:
			const transactionBundle = createMockTransactionBundle([{ type: 16724, hash: 'testHash' }]);
			const createTransactionMock = jest.fn().mockResolvedValue(transactionBundle);
			mockWalletControllerConfigured({
				modules: {
					transfer: createMockTransferModule({
						createTransaction: createTransactionMock
					})
				}
			});
			mockTransactionFees(TRANSACTION_FEES, false);
			mockPasscode();
			mockRouter();

			const props = createRouteProps({
				recipientAddress: recipientAccount.address,
				amount: '1'
			});

			// Act:
			const screenTester = new ScreenTester(Send, props);
			await screenTester.waitForTimer();
			screenTester.pressButton(SCREEN_TEXT.buttonSend);
			await screenTester.waitForTimer();

			// Assert:
			expect(createTransactionMock).toHaveBeenCalled();
		});

		it('fills form and submits transaction successfully', async () => {
			// Arrange:
			const transactionBundle = createMockTransactionBundle([{ type: 16724, hash: 'testHash' }]);
			const createTransactionMock = jest.fn().mockResolvedValue(transactionBundle);
			mockWalletControllerConfigured({
				modules: {
					transfer: createMockTransferModule({
						createTransaction: createTransactionMock
					})
				}
			});
			mockTransactionFees(TRANSACTION_FEES, false);
			mockPasscode();
			mockRouter();

			const props = createRouteProps();

			// Act:
			const screenTester = new ScreenTester(Send, props);
			await screenTester.waitForTimer();

			// Fill recipient address
			screenTester.inputText(SCREEN_TEXT.inputRecipientLabel, recipientAccount.address);
			await screenTester.waitForTimer();

			// Fill amount
			screenTester.inputText(SCREEN_TEXT.inputAmountLabel, '10');
			await screenTester.waitForTimer();

			// Fill message
			screenTester.inputText(SCREEN_TEXT.inputMessageLabel, 'Test transaction message');
			await screenTester.waitForTimer();

			// Press send button
			screenTester.pressButton(SCREEN_TEXT.buttonSend);
			await screenTester.waitForTimer();

			// Assert:
			expect(createTransactionMock).toHaveBeenCalledWith(expect.objectContaining({
				recipientAddress: recipientAccount.address,
				messageText: 'Test transaction message'
			}));
		});
	});
});

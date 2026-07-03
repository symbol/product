import { CreateMosaic } from '@/app/screens/mosaic/CreateMosaic';
import { AccountFixtureBuilder } from '__fixtures__/local/AccountFixtureBuilder';
import { AccountInfoFixtureBuilder } from '__fixtures__/local/AccountInfoFixtureBuilder';
import { NetworkPropertiesFixtureBuilder } from '__fixtures__/local/NetworkPropertiesFixtureBuilder';
import { TransactionFeeFixtureBuilder } from '__fixtures__/local/TransactionFeeFixtureBuilder';
import { ScreenTester } from '__tests__/ScreenTester';
import { createAddressBookMock, mockLocalization, mockPasscode, mockRouter, mockWalletController } from '__tests__/mock-helpers';

// Constants

const CHAIN_NAME = 'symbol';
const NETWORK_IDENTIFIER = 'testnet';
const TICKER = 'XYM';

const MOSAIC_ID = '78C3CDF0896248DB';

const VALID_DIVISIBILITY = '2';
const VALID_SUPPLY = '1000';
const VALID_DURATION = '2880';

// Screen Text

const SCREEN_TEXT = {
	// Screen titles
	textScreenTitle: 's_mosaicCreation_mosaic_title',
	textScreenDescription: 's_mosaicCreation_mosaic_description',

	// Sender section
	textSenderTitle: 's_mosaicCreation_sender_title',
	senderTabCurrentAccount: 'c_selectTransactionSender_currentAccount',
	senderTabMultisigAccount: 'c_selectTransactionSender_multisigAccount',

	// Input sections
	textDivisibilityTitle: 's_mosaicCreation_divisibility_title',
	textDivisibilityDescription: 's_mosaicCreation_divisibility_description',
	textSupplyTitle: 's_mosaicCreation_supply_title',
	textSupplyDescription: 's_mosaicCreation_supply_description',
	textDurationTitle: 's_mosaicCreation_duration_title',
	textDurationDescription: 's_mosaicCreation_duration_description',
	textDurationDaysHint: 's_mosaicCreation_durationDays',

	// Flag sections
	textSupplyMutableTitle: 's_mosaicCreation_supplyMutable_title',
	textSupplyMutableDescription: 's_mosaicCreation_supplyMutable_description',
	textTransferableTitle: 's_mosaicCreation_transferable_title',
	textTransferableDescription: 's_mosaicCreation_transferable_description',
	textRestrictableTitle: 's_mosaicCreation_restrictable_title',
	textRestrictableDescription: 's_mosaicCreation_restrictable_description',
	textRevokableTitle: 's_mosaicCreation_revokable_title',
	textRevokableDescription: 's_mosaicCreation_revokable_description',

	// Checkboxes
	checkboxNeverExpire: 's_mosaicCreation_duration_checkbox',
	checkboxSupplyMutable: 's_mosaicCreation_supplyMutable_checkbox',
	checkboxTransferable: 's_mosaicCreation_transferable_checkbox',
	checkboxRestrictable: 's_mosaicCreation_restrictable_checkbox',
	checkboxRevokable: 's_mosaicCreation_revokable_checkbox',

	// Input labels
	inputDivisibility: 'input_divisibility',
	inputSupply: 'input_supply',
	inputDuration: 'input_duration',

	// Buttons
	buttonSend: 'button_send',
	buttonConfirm: 'button_confirm',

	// Dialog
	textDialogConfirmTitle: 's_mosaicCreation_confirm_title',
	textDialogConfirmText: 's_mosaicCreation_confirm_text',

	// Validation errors
	errorRequired: 'validation_error_field_required',
	errorDivisibility: 'validation_error_mosaic_divisibility',
	errorSupply: 'validation_error_mosaic_supply',
	errorDuration: 'validation_error_mosaic_duration'
};

const ALL_VALIDATION_ERRORS = [
	SCREEN_TEXT.errorRequired,
	SCREEN_TEXT.errorDivisibility,
	SCREEN_TEXT.errorSupply,
	SCREEN_TEXT.errorDuration
];

// Account Fixtures

const currentAccount = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.build();

const multisigAccount = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 3)
	.build();

const multisigAccountInfo = AccountInfoFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 3)
	.setBalance('5000000')
	.override({
		address: multisigAccount.address,
		publicKey: multisigAccount.publicKey,
		isMultisig: true
	})
	.build();

// Network Properties Fixtures

const networkProperties = NetworkPropertiesFixtureBuilder
	.createWithType(CHAIN_NAME, NETWORK_IDENTIFIER)
	.build();

// Transaction Fee Fixtures

const transactionFees = TransactionFeeFixtureBuilder
	.createWithAmounts('0.1', '0.2', '0.3', CHAIN_NAME, NETWORK_IDENTIFIER)
	.build();

// Mock Transaction Bundle

const mosaicDefinitionTransaction = {
	type: 'mosaicDefinition',
	signerAddress: currentAccount.address,
	mosaicId: MOSAIC_ID,
	divisibility: 2,
	duration: 0,
	isSupplyMutable: true,
	isTransferable: true,
	isRestrictable: false,
	isRevokable: false
};

const mosaicSupplyChangeTransaction = {
	type: 'mosaicSupplyChange',
	signerAddress: currentAccount.address,
	mosaicId: MOSAIC_ID,
	action: 'Increase',
	delta: '100000'
};

const mockAggregateTransaction = {
	type: 'aggregateComplete',
	signerAddress: currentAccount.address,
	innerTransactions: [mosaicDefinitionTransaction, mosaicSupplyChangeTransaction],
	fee: { token: { amount: '0.1' } }
};

const mockTransactionBundle = {
	transactions: [mockAggregateTransaction],
	applyFeeTier: jest.fn()
};

const signedTransactionBundle = {
	transactions: [{ hash: 'SIGNED_TX_HASH' }]
};

// Expected Transaction Options

const expectedDefaultTransactionOptions = {
	senderPublicKey: undefined,
	initialSupply: VALID_SUPPLY,
	divisibility: 2,
	duration: 0,
	isSupplyMutable: true,
	isTransferable: true,
	isRestrictable: false,
	isRevokable: false
};

// Token Module Mock Factory

const createTokenModuleMock = () => ({
	createTransaction: jest.fn().mockReturnValue(mockTransactionBundle)
});

// Transfer Module Mock Factory

const createTransferModuleMock = () => ({
	calculateTransactionFees: jest.fn().mockResolvedValue(transactionFees)
});

// Multisig Module Mock Factory

const createMultisigModuleMock = (multisigAccounts = []) => ({
	multisigAccounts,
	fetchData: jest.fn().mockResolvedValue(multisigAccounts)
});

// Setup

const setupMocks = (config = {}) => {
	const { multisigAccounts = [] } = config;

	const walletControllerMock = mockWalletController({
		chainName: CHAIN_NAME,
		networkIdentifier: NETWORK_IDENTIFIER,
		networkProperties,
		ticker: TICKER,
		currentAccount,
		signTransactionBundle: jest.fn().mockResolvedValue(signedTransactionBundle),
		announceSignedTransactionBundle: jest.fn().mockResolvedValue({}),
		modules: {
			token: createTokenModuleMock(),
			transfer: createTransferModuleMock(),
			multisig: createMultisigModuleMock(multisigAccounts),
			addressBook: createAddressBookMock()
		}
	});

	mockLocalization();

	return { walletControllerMock };
};

// Helpers

const fillValidForm = screenTester => {
	screenTester.inputText(SCREEN_TEXT.inputDivisibility, VALID_DIVISIBILITY);
	screenTester.inputText(SCREEN_TEXT.inputSupply, VALID_SUPPLY);
};

const selectMultisigSender = async screenTester => {
	screenTester.pressButton(SCREEN_TEXT.senderTabMultisigAccount); // opens the dropdown
	await screenTester.waitForTimer();
	screenTester.pressButton(multisigAccountInfo.address); // selects the multisig account
	await screenTester.waitForTimer();
};

describe('screens/mosaic/CreateMosaic', () => {
	beforeEach(() => {
		jest.useFakeTimers();
		jest.clearAllMocks();
	});

	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
	});

	describe('render', () => {
		it('renders screen text with titles, descriptions, inputs and send button', async () => {
			// Arrange:
			setupMocks();
			const expectedTexts = [
				SCREEN_TEXT.textScreenTitle,
				SCREEN_TEXT.textScreenDescription,
				SCREEN_TEXT.textSenderTitle,
				SCREEN_TEXT.textDivisibilityTitle,
				SCREEN_TEXT.textDivisibilityDescription,
				SCREEN_TEXT.inputDivisibility,
				SCREEN_TEXT.textSupplyTitle,
				SCREEN_TEXT.textSupplyDescription,
				SCREEN_TEXT.inputSupply,
				SCREEN_TEXT.textDurationTitle,
				SCREEN_TEXT.textDurationDescription,
				SCREEN_TEXT.inputDuration,
				SCREEN_TEXT.checkboxNeverExpire,
				SCREEN_TEXT.textSupplyMutableTitle,
				SCREEN_TEXT.textSupplyMutableDescription,
				SCREEN_TEXT.checkboxSupplyMutable,
				SCREEN_TEXT.textTransferableTitle,
				SCREEN_TEXT.textTransferableDescription,
				SCREEN_TEXT.checkboxTransferable,
				SCREEN_TEXT.textRestrictableTitle,
				SCREEN_TEXT.textRestrictableDescription,
				SCREEN_TEXT.checkboxRestrictable,
				SCREEN_TEXT.textRevokableTitle,
				SCREEN_TEXT.textRevokableDescription,
				SCREEN_TEXT.checkboxRevokable,
				SCREEN_TEXT.buttonSend
			];

			// Act:
			const screenTester = new ScreenTester(CreateMosaic);
			await screenTester.waitForTimer(); // initial sender options load

			// Assert:
			screenTester.expectText(expectedTexts);
		});

		it('renders the default divisibility value', async () => {
			// Arrange:
			setupMocks();

			// Act:
			const screenTester = new ScreenTester(CreateMosaic);
			await screenTester.waitForTimer(); // initial sender options load

			// Assert:
			screenTester.expectInputValue('0');
		});
	});

	describe('sender selector', () => {
		const runSenderSelectorTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				setupMocks({ multisigAccounts: config.multisigAccounts });

				// Act:
				const screenTester = new ScreenTester(CreateMosaic);
				await screenTester.waitForTimer(); // initial sender options load

				// Assert:
				if (expected.hasMultisigTabs)
					screenTester.expectText([SCREEN_TEXT.senderTabCurrentAccount, SCREEN_TEXT.senderTabMultisigAccount]);
				else
					screenTester.notExpectText([SCREEN_TEXT.senderTabCurrentAccount, SCREEN_TEXT.senderTabMultisigAccount]);
			});
		};

		const senderSelectorTests = [
			{
				description: 'shows sender tab selector when account is cosignatory of multisig accounts',
				config: { multisigAccounts: [multisigAccountInfo] },
				expected: { hasMultisigTabs: true }
			},
			{
				description: 'shows only the current account when there are no multisig accounts',
				config: { multisigAccounts: [] },
				expected: { hasMultisigTabs: false }
			}
		];

		senderSelectorTests.forEach(test => {
			runSenderSelectorTest(test.description, test.config, test.expected);
		});
	});

	describe('validation', () => {
		const runValidationTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				setupMocks();
				const screenTester = new ScreenTester(CreateMosaic);
				await screenTester.waitForTimer(); // initial sender options load
				fillValidForm(screenTester);

				// Act:
				if (config.isNeverExpireUnchecked)
					screenTester.pressButton(SCREEN_TEXT.checkboxNeverExpire);
				screenTester.inputText(config.inputLabel, config.value);

				// Assert:
				if (expected.errorText)
					screenTester.expectText([expected.errorText]);
				else
					screenTester.notExpectText(ALL_VALIDATION_ERRORS);

				if (expected.inputValue)
					screenTester.expectInputValue(expected.inputValue);
			});
		};

		const validationTests = [
			{
				description: 'shows divisibility error when divisibility is above the maximum',
				config: { inputLabel: SCREEN_TEXT.inputDivisibility, value: '7' },
				expected: { errorText: SCREEN_TEXT.errorDivisibility }
			},
			{
				description: 'shows required error when divisibility is cleared',
				config: { inputLabel: SCREEN_TEXT.inputDivisibility, value: '' },
				expected: { errorText: SCREEN_TEXT.errorRequired }
			},
			{
				description: 'shows no error when divisibility is at the maximum',
				config: { inputLabel: SCREEN_TEXT.inputDivisibility, value: '6' },
				expected: { errorText: null }
			},
			{
				description: 'shows supply error when supply is below the minimum',
				config: { inputLabel: SCREEN_TEXT.inputSupply, value: '0' },
				expected: { errorText: SCREEN_TEXT.errorSupply }
			},
			{
				description: 'shows supply error when supply is above the maximum',
				config: { inputLabel: SCREEN_TEXT.inputSupply, value: '10000000000' },
				expected: { errorText: SCREEN_TEXT.errorSupply }
			},
			{
				description: 'shows no error when supply is at the maximum',
				config: { inputLabel: SCREEN_TEXT.inputSupply, value: '9999999999' },
				expected: { errorText: null }
			},
			{
				description: 'keeps only digits in a numeric input and shows no error',
				config: { inputLabel: SCREEN_TEXT.inputSupply, value: '12a3' },
				expected: { errorText: null, inputValue: '123' }
			},
			{
				description: 'shows required error when duration is empty and never expire is unchecked',
				config: { inputLabel: SCREEN_TEXT.inputDuration, value: '', isNeverExpireUnchecked: true },
				expected: { errorText: SCREEN_TEXT.errorRequired }
			},
			{
				description: 'shows duration error when duration is above the maximum',
				config: { inputLabel: SCREEN_TEXT.inputDuration, value: '10512001', isNeverExpireUnchecked: true },
				expected: { errorText: SCREEN_TEXT.errorDuration }
			},
			{
				description: 'shows no error when duration is valid and never expire is unchecked',
				config: { inputLabel: SCREEN_TEXT.inputDuration, value: VALID_DURATION, isNeverExpireUnchecked: true },
				expected: { errorText: null }
			}
		];

		validationTests.forEach(test => {
			runValidationTest(test.description, test.config, test.expected);
		});
	});

	describe('duration', () => {
		it('shows the approximate duration in days when a valid duration is entered', async () => {
			// Arrange:
			setupMocks();
			const screenTester = new ScreenTester(CreateMosaic);
			await screenTester.waitForTimer(); // initial sender options load

			// Act:
			screenTester.pressButton(SCREEN_TEXT.checkboxNeverExpire);
			screenTester.inputText(SCREEN_TEXT.inputDuration, VALID_DURATION);

			// Assert:
			screenTester.expectText([SCREEN_TEXT.textDurationDaysHint]);
		});

		it('hides the days hint when never expire is checked', async () => {
			// Arrange:
			setupMocks();

			// Act:
			const screenTester = new ScreenTester(CreateMosaic);
			await screenTester.waitForTimer(); // initial sender options load

			// Assert:
			screenTester.notExpectText([SCREEN_TEXT.textDurationDaysHint]);
		});

		it('creates the transaction with the entered duration when never expire is unchecked', async () => {
			// Arrange:
			const { walletControllerMock } = setupMocks();
			const screenTester = new ScreenTester(CreateMosaic);
			await screenTester.waitForTimer(); // initial sender options load

			// Act:
			screenTester.pressButton(SCREEN_TEXT.checkboxNeverExpire);
			screenTester.inputText(SCREEN_TEXT.inputDuration, VALID_DURATION);
			fillValidForm(screenTester);
			await screenTester.waitForTimer(); // fee calculation

			// Assert:
			expect(walletControllerMock.modules.token.createTransaction).toHaveBeenCalledWith(expect.objectContaining({ duration: 2880 }));
		});
	});

	describe('fee calculation', () => {
		it('calculates fees with the entered mosaic parameters when the form is valid', async () => {
			// Arrange:
			const { walletControllerMock } = setupMocks();
			const screenTester = new ScreenTester(CreateMosaic);
			await screenTester.waitForTimer(); // initial sender options load

			// Act:
			fillValidForm(screenTester);
			await screenTester.waitForTimer(); // fee calculation

			// Assert:
			expect(walletControllerMock.modules.token.createTransaction).toHaveBeenCalledWith(expectedDefaultTransactionOptions);
			expect(walletControllerMock.modules.transfer.calculateTransactionFees).toHaveBeenCalledWith(mockTransactionBundle);
		});

		it('does not calculate fees when the form is invalid', async () => {
			// Arrange:
			const { walletControllerMock } = setupMocks();

			// Act:
			const screenTester = new ScreenTester(CreateMosaic);
			await screenTester.waitForTimer(); // initial sender options load
			await screenTester.waitForTimer(); // would-be fee calculation

			// Assert:
			expect(walletControllerMock.modules.token.createTransaction).not.toHaveBeenCalled();
			expect(walletControllerMock.modules.transfer.calculateTransactionFees).not.toHaveBeenCalled();
		});
	});

	describe('flags', () => {
		const runFlagToggleTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				const { walletControllerMock } = setupMocks();
				const screenTester = new ScreenTester(CreateMosaic);
				await screenTester.waitForTimer(); // initial sender options load

				// Act:
				screenTester.pressButton(config.checkboxText);
				fillValidForm(screenTester);
				await screenTester.waitForTimer(); // fee calculation

				// Assert:
				const { createTransaction } = walletControllerMock.modules.token;
				expect(createTransaction).toHaveBeenCalledWith(expect.objectContaining(expected.transactionOptions));
			});
		};

		const flagToggleTests = [
			{
				description: 'creates the transaction with supply mutable disabled when its checkbox is unchecked',
				config: { checkboxText: SCREEN_TEXT.checkboxSupplyMutable },
				expected: { transactionOptions: { isSupplyMutable: false } }
			},
			{
				description: 'creates the transaction with transferable disabled when its checkbox is unchecked',
				config: { checkboxText: SCREEN_TEXT.checkboxTransferable },
				expected: { transactionOptions: { isTransferable: false } }
			},
			{
				description: 'creates the transaction with restrictable enabled when its checkbox is checked',
				config: { checkboxText: SCREEN_TEXT.checkboxRestrictable },
				expected: { transactionOptions: { isRestrictable: true } }
			},
			{
				description: 'creates the transaction with revokable enabled when its checkbox is checked',
				config: { checkboxText: SCREEN_TEXT.checkboxRevokable },
				expected: { transactionOptions: { isRevokable: true } }
			}
		];

		flagToggleTests.forEach(test => {
			runFlagToggleTest(test.description, test.config, test.expected);
		});
	});

	describe('send button availability', () => {
		const runSendButtonTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				setupMocks();
				const screenTester = new ScreenTester(CreateMosaic);
				await screenTester.waitForTimer(); // initial sender options load

				// Act:
				config.actions(screenTester);
				await screenTester.waitForTimer(); // fee calculation

				// Assert:
				if (expected.isDisabled)
					screenTester.expectButtonDisabled(SCREEN_TEXT.buttonSend);
				else
					screenTester.expectButtonEnabled(SCREEN_TEXT.buttonSend);
			});
		};

		const sendButtonTests = [
			{
				description: 'send button is disabled when the form is empty',
				config: {
					actions: () => {}
				},
				expected: {
					isDisabled: true
				}
			},
			{
				description: 'send button is enabled when the form is valid and fees are loaded',
				config: {
					actions: screenTester => fillValidForm(screenTester)
				},
				expected: {
					isDisabled: false
				}
			},
			{
				description: 'send button is disabled when a field is invalid',
				config: {
					actions: screenTester => {
						fillValidForm(screenTester);
						screenTester.inputText(SCREEN_TEXT.inputDivisibility, '9');
					}
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
			const screenTester = new ScreenTester(CreateMosaic);
			await screenTester.waitForTimer(); // initial sender options load
			fillValidForm(screenTester);
			await screenTester.waitForTimer(); // fee calculation

			// Act:
			screenTester.pressButton(SCREEN_TEXT.buttonSend);
			await screenTester.waitForTimer(); // dialog
			screenTester.expectText([SCREEN_TEXT.textDialogConfirmTitle, SCREEN_TEXT.textDialogConfirmText]);
			screenTester.pressButton(SCREEN_TEXT.buttonConfirm);
			await screenTester.waitForTimer(); // passcode
			await screenTester.waitForTimer(); // sign
			await screenTester.waitForTimer(); // announce

			// Assert:
			expect(walletControllerMock.modules.token.createTransaction).toHaveBeenCalledWith(expectedDefaultTransactionOptions);
			expect(walletControllerMock.signTransactionBundle).toHaveBeenCalledWith(mockTransactionBundle);
			expect(walletControllerMock.announceSignedTransactionBundle).toHaveBeenCalledWith(signedTransactionBundle);
		});
	});

	describe('multisig sender integration', () => {
		it('creates the mosaic with the selected multisig account as creator', async () => {
			// Arrange:
			const { walletControllerMock } = setupMocks({ multisigAccounts: [multisigAccountInfo] });
			const screenTester = new ScreenTester(CreateMosaic);
			await screenTester.waitForTimer(); // initial sender options load

			// Act:
			await selectMultisigSender(screenTester);
			fillValidForm(screenTester);
			await screenTester.waitForTimer(); // fee calculation

			// Assert:
			const { createTransaction } = walletControllerMock.modules.token;
			const expectedOptions = expect.objectContaining({ senderPublicKey: multisigAccountInfo.publicKey });
			expect(createTransaction).toHaveBeenCalledWith(expectedOptions);
		});
	});
});

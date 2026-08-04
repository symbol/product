import { CreateMosaic } from '@/app/screens/mosaic/CreateMosaic';
import { DEFAULT_MOSAIC_DIVISIBILITY, MOSAIC_NEVER_EXPIRING_DURATION } from '@/app/screens/mosaic/constants';
import { AccountFixtureBuilder } from '__fixtures__/local/AccountFixtureBuilder';
import { NetworkPropertiesFixtureBuilder } from '__fixtures__/local/NetworkPropertiesFixtureBuilder';
import { TransactionFeeFixtureBuilder } from '__fixtures__/local/TransactionFeeFixtureBuilder';
import { ScreenTester } from '__tests__/ScreenTester';
import { createAddressBookMock, mockLocalization, mockPasscode, mockRouter, mockWalletController } from '__tests__/mock-helpers';

// Constants

const CHAIN_NAME = 'symbol';
const NETWORK_IDENTIFIER = 'testnet';
const TICKER = 'XYM';

const MOSAIC_ID = '78C3CDF0896248DB';
const VALID_SUPPLY = '100';

// Screen Text

const SCREEN_TEXT = {
	// Section titles and descriptions
	textMosaicTitle: 's_mosaicCreation_mosaic_title',
	textMosaicDescription: 's_mosaicCreation_mosaic_description',
	textCreatorTitle: 's_mosaicCreation_sender_title',
	textQuantityTitle: 's_mosaicCreation_quantity_title',
	textQuantityDescription: 's_mosaicCreation_quantity_description',
	textDurationTitle: 's_mosaicCreation_duration_title',
	textDurationDescription: 's_mosaicCreation_duration_description',
	textFlagsTitle: 's_mosaicCreation_flags_title',

	// Flag section titles and descriptions
	textSupplyMutableTitle: 's_mosaicCreation_supplyMutable_title',
	textSupplyMutableDescription: 's_mosaicCreation_supplyMutable_description',
	textTransferableTitle: 's_mosaicCreation_transferable_title',
	textTransferableDescription: 's_mosaicCreation_transferable_description',
	textRestrictableTitle: 's_mosaicCreation_restrictable_title',
	textRestrictableDescription: 's_mosaicCreation_restrictable_description',
	textRevokableTitle: 's_mosaicCreation_revokable_title',
	textRevokableDescription: 's_mosaicCreation_revokable_description',

	// Duration / expiration summary
	textExpirationPermanent: 's_mosaicCreation_expiration_permanent',
	textDurationBlocksChip: 's_mosaicCreation_durationUnit_blocksChip',
	textSmallestSendWhole: 's_mosaicCreation_smallestSend_whole',

	// Buttons
	buttonSend: 'button_send',
	buttonConfirm: 'button_confirm',

	// Checkboxes
	checkboxExpires: 's_mosaicCreation_duration_expiresCheckbox',
	checkboxSupplyMutable: 's_mosaicCreation_supplyMutable_checkbox',
	checkboxTransferable: 's_mosaicCreation_transferable_checkbox',
	checkboxRestrictable: 's_mosaicCreation_restrictable_checkbox',
	checkboxRevokable: 's_mosaicCreation_revokable_checkbox',

	// Input labels (accessibility)
	inputTotalSupplyLabel: 's_mosaicCreation_totalSupply_label',
	inputDurationBlocksLabel: 's_mosaicCreation_duration_blocksInputLabel',

	// Confirmation dialog
	textConfirmDialogTitle: 's_mosaicCreation_confirm_title',

	// Validation errors
	errorFieldRequired: 'validation_error_field_required',
	errorSupplyLow: 'validation_error_mosaic_supply_low',
	errorSupplyHigh: 'validation_error_mosaic_supply_high',
	errorSupplyWhole: 'validation_error_mosaic_supply_whole',
	errorSupplyDecimals: 'validation_error_mosaic_supply_decimals',
	errorDurationLow: 'validation_error_mosaic_duration_low',
	errorDurationHigh: 'validation_error_mosaic_duration_high'
};

// Grouped error texts used to assert the absence of validation errors on valid input

const SUPPLY_ERROR_TEXTS = [
	SCREEN_TEXT.errorFieldRequired,
	SCREEN_TEXT.errorSupplyLow,
	SCREEN_TEXT.errorSupplyHigh,
	SCREEN_TEXT.errorSupplyWhole,
	SCREEN_TEXT.errorSupplyDecimals
];

const DURATION_ERROR_TEXTS = [
	SCREEN_TEXT.errorFieldRequired,
	SCREEN_TEXT.errorDurationLow,
	SCREEN_TEXT.errorDurationHigh
];

// The mosaic flag checkbox each flag is toggled with

const flagCheckboxLabels = {
	isSupplyMutable: SCREEN_TEXT.checkboxSupplyMutable,
	isTransferable: SCREEN_TEXT.checkboxTransferable,
	isRestrictable: SCREEN_TEXT.checkboxRestrictable,
	isRevokable: SCREEN_TEXT.checkboxRevokable
};

// Account Fixtures

const currentAccount = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.build();

const walletAccounts = [currentAccount];

// Network Properties Fixtures

const symbolNetworkProperties = NetworkPropertiesFixtureBuilder
	.createWithType(CHAIN_NAME, NETWORK_IDENTIFIER)
	.build();

// Transaction Fee Fixtures

const transactionFees = TransactionFeeFixtureBuilder
	.createWithAmounts('0.1', '0.2', '0.3', CHAIN_NAME, NETWORK_IDENTIFIER)
	.build();

// Mock Mosaic Creation Transaction Bundle (returned by the token module)

const mosaicDefinitionTransaction = {
	type: 'mosaicDefinition',
	signerAddress: currentAccount.address,
	mosaicId: MOSAIC_ID,
	divisibility: 0,
	duration: MOSAIC_NEVER_EXPIRING_DURATION,
	isSupplyMutable: true,
	isTransferable: true,
	isRestrictable: false,
	isRevokable: false
};

const mosaicSupplyChangeTransaction = {
	type: 'mosaicSupplyChange',
	delta: '100'
};

const mosaicAggregateTransaction = {
	type: 'aggregateComplete',
	innerTransactions: [mosaicDefinitionTransaction, mosaicSupplyChangeTransaction],
	fee: { token: { amount: '0.1' } }
};

const mosaicTransactionBundle = {
	transactions: [mosaicAggregateTransaction],
	applyFeeTier: jest.fn()
};

// Signed Transaction Bundle Fixtures

const signedTransactionBundle = {
	transactions: [{ hash: 'SIGNED_TX_HASH' }]
};

// Module Mock Factories

const createTokenModuleMock = () => ({
	createTransaction: jest.fn().mockReturnValue(mosaicTransactionBundle)
});

const createTransferModuleMock = () => ({
	calculateTransactionFees: jest.fn().mockResolvedValue(transactionFees)
});

// Setup

const setupMocks = () => {
	mockLocalization();

	const walletControllerMock = mockWalletController({
		chainName: CHAIN_NAME,
		networkIdentifier: NETWORK_IDENTIFIER,
		ticker: TICKER,
		networkProperties: symbolNetworkProperties,
		currentAccount,
		accounts: {
			[NETWORK_IDENTIFIER]: walletAccounts
		},
		signTransactionBundle: jest.fn().mockResolvedValue(signedTransactionBundle),
		announceSignedTransactionBundle: jest.fn().mockResolvedValue({}),
		modules: {
			token: createTokenModuleMock(),
			transfer: createTransferModuleMock(),
			addressBook: createAddressBookMock([])
		}
	});

	return { walletControllerMock };
};

// Renders the screen and waits for the initial sender options to load

const renderCreateMosaicScreen = async () => {
	const screenTester = new ScreenTester(CreateMosaic);
	await screenTester.waitForTimer(); // sender options load

	return screenTester;
};

// Fills the mosaic form (divisibility, supply, duration and flags) from a form config

const fillMosaicForm = (screenTester, config) => {
	if (config.divisibility !== DEFAULT_MOSAIC_DIVISIBILITY)
		screenTester.pressButton(config.divisibility);

	screenTester.inputText(SCREEN_TEXT.inputTotalSupplyLabel, config.supply);

	if (config.isExpiring) {
		screenTester.pressButton(SCREEN_TEXT.checkboxExpires);
		screenTester.inputText(SCREEN_TEXT.inputDurationBlocksLabel, config.duration);
	}

	(config.flagsToToggle ?? []).forEach(flagName => screenTester.pressButton(flagCheckboxLabels[flagName]));
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
		it('renders section titles and descriptions with the send button', async () => {
			// Arrange:
			setupMocks();
			const expectedTexts = [
				SCREEN_TEXT.textMosaicTitle,
				SCREEN_TEXT.textMosaicDescription,
				SCREEN_TEXT.textCreatorTitle,
				SCREEN_TEXT.textQuantityTitle,
				SCREEN_TEXT.textQuantityDescription,
				SCREEN_TEXT.textDurationTitle,
				SCREEN_TEXT.textDurationDescription,
				SCREEN_TEXT.textFlagsTitle,
				SCREEN_TEXT.textSupplyMutableTitle,
				SCREEN_TEXT.textSupplyMutableDescription,
				SCREEN_TEXT.textTransferableTitle,
				SCREEN_TEXT.textTransferableDescription,
				SCREEN_TEXT.textRestrictableTitle,
				SCREEN_TEXT.textRestrictableDescription,
				SCREEN_TEXT.textRevokableTitle,
				SCREEN_TEXT.textRevokableDescription,
				SCREEN_TEXT.buttonSend
			];

			// Act:
			const screenTester = await renderCreateMosaicScreen();

			// Assert:
			screenTester.expectText(expectedTexts);
		});
	});

	describe('quantity', () => {
		const runQuantityTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				setupMocks();
				const screenTester = await renderCreateMosaicScreen();

				// Act:
				if (config.divisibility !== DEFAULT_MOSAIC_DIVISIBILITY)
					screenTester.pressButton(config.divisibility);

				screenTester.inputText(SCREEN_TEXT.inputTotalSupplyLabel, config.supply);
				await screenTester.waitForTimer(); // fee calculation

				// Assert:
				if (expected.errorText)
					screenTester.expectText([expected.errorText]);
				else
					screenTester.notExpectText(SUPPLY_ERROR_TEXTS);

				if (expected.visibleText)
					screenTester.expectText(expected.visibleText);
			});
		};

		const quantityTests = [
			{
				description: 'renders no error and the whole-token hint for a valid whole supply',
				config: { divisibility: '0', supply: '100' },
				expected: { errorText: null, visibleText: [SCREEN_TEXT.textSmallestSendWhole] }
			},
			{
				description: 'renders the required error for an empty supply',
				config: { divisibility: '0', supply: '' },
				expected: { errorText: SCREEN_TEXT.errorFieldRequired }
			},
			{
				description: 'renders the low error when the supply is below one atomic unit',
				config: { divisibility: '0', supply: '0' },
				expected: { errorText: SCREEN_TEXT.errorSupplyLow }
			},
			{
				description: 'renders the whole-number error when a zero-divisibility supply has decimals',
				config: { divisibility: '0', supply: '1.5' },
				expected: { errorText: SCREEN_TEXT.errorSupplyWhole }
			},
			{
				description: 'renders no error when the supply equals the maximum',
				config: { divisibility: '0', supply: '8999999999000000' },
				expected: { errorText: null }
			},
			{
				description: 'renders the high error when the supply exceeds the maximum',
				config: { divisibility: '0', supply: '8999999999000001' },
				expected: { errorText: SCREEN_TEXT.errorSupplyHigh }
			},
			{
				description: 'renders no error and the smallest-fraction hint for a valid fractional supply',
				config: { divisibility: '3', supply: '1.5' },
				expected: { errorText: null, visibleText: ['0.001'] }
			},
			{
				description: 'renders the decimals error when the supply has more decimals than the divisibility',
				config: { divisibility: '3', supply: '1.2345' },
				expected: { errorText: SCREEN_TEXT.errorSupplyDecimals }
			}
		];

		quantityTests.forEach(test => {
			runQuantityTest(test.description, test.config, test.expected);
		});
	});

	describe('duration', () => {
		describe('expiry checkbox', () => {
			const runExpiryCheckboxTest = (description, config, expected) => {
				it(description, async () => {
					// Arrange:
					setupMocks();
					const screenTester = await renderCreateMosaicScreen();

					// Act:
					for (let press = 0; press < config.pressCount; press++)
						screenTester.pressButton(SCREEN_TEXT.checkboxExpires);

					// Assert:
					screenTester.expectText(expected.visibleText);
					screenTester.notExpectText(expected.hiddenText);
					screenTester.expectAccessibilityValue(SCREEN_TEXT.checkboxExpires, { text: expected.checkboxState });
				});
			};

			const expiryCheckboxTests = [
				{
					description: 'shows the permanent note and hides the duration input by default',
					config: { pressCount: 0 },
					expected: {
						visibleText: [SCREEN_TEXT.textExpirationPermanent],
						hiddenText: [SCREEN_TEXT.textDurationBlocksChip, SCREEN_TEXT.inputDurationBlocksLabel],
						checkboxState: 'unchecked'
					}
				},
				{
					description: 'reveals the duration input and hides the permanent note when expiring is enabled',
					config: { pressCount: 1 },
					expected: {
						visibleText: [SCREEN_TEXT.textDurationBlocksChip, SCREEN_TEXT.inputDurationBlocksLabel],
						hiddenText: [SCREEN_TEXT.textExpirationPermanent],
						checkboxState: 'checked'
					}
				},
				{
					description: 'restores the permanent note when expiring is toggled off again',
					config: { pressCount: 2 },
					expected: {
						visibleText: [SCREEN_TEXT.textExpirationPermanent],
						hiddenText: [SCREEN_TEXT.textDurationBlocksChip, SCREEN_TEXT.inputDurationBlocksLabel],
						checkboxState: 'unchecked'
					}
				}
			];

			expiryCheckboxTests.forEach(test => {
				runExpiryCheckboxTest(test.description, test.config, test.expected);
			});
		});

		describe('duration input', () => {
			const runDurationInputTest = (description, config, expected) => {
				it(description, async () => {
					// Arrange:
					setupMocks();
					const screenTester = await renderCreateMosaicScreen();
					screenTester.inputText(SCREEN_TEXT.inputTotalSupplyLabel, VALID_SUPPLY); // isolate the duration validation
					screenTester.pressButton(SCREEN_TEXT.checkboxExpires); // reveal the duration input (prefills one year)

					// Act:
					screenTester.inputText(SCREEN_TEXT.inputDurationBlocksLabel, config.duration);
					await screenTester.waitForTimer(); // fee calculation

					// Assert:
					if (expected.errorText)
						screenTester.expectText([expected.errorText]);
					else
						screenTester.notExpectText(DURATION_ERROR_TEXTS);
				});
			};

			const durationInputTests = [
				{
					description: 'renders no error for a valid duration',
					config: { duration: '1000' },
					expected: { errorText: null }
				},
				{
					description: 'renders the required error for an empty duration',
					config: { duration: '' },
					expected: { errorText: SCREEN_TEXT.errorFieldRequired }
				},
				{
					description: 'renders the low error for a duration below the minimum',
					config: { duration: '0' },
					expected: { errorText: SCREEN_TEXT.errorDurationLow }
				},
				{
					description: 'renders the high error for a duration above the maximum',
					config: { duration: '99999999' },
					expected: { errorText: SCREEN_TEXT.errorDurationHigh }
				}
			];

			durationInputTests.forEach(test => {
				runDurationInputTest(test.description, test.config, test.expected);
			});
		});
	});

	describe('send transaction flow', () => {
		const runSendTransactionTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				const { walletControllerMock } = setupMocks();
				mockPasscode();
				mockRouter({ goToHome: jest.fn() });
				const screenTester = await renderCreateMosaicScreen();

				// Act:
				fillMosaicForm(screenTester, config);
				await screenTester.waitForTimer(); // fee calculation

				screenTester.pressButton(SCREEN_TEXT.buttonSend);
				await screenTester.waitForTimer(); // create transaction, open confirmation dialog
				screenTester.expectText([SCREEN_TEXT.textConfirmDialogTitle]);

				screenTester.pressButton(SCREEN_TEXT.buttonConfirm);
				await screenTester.waitForTimer(); // passcode success, send execution delay
				await screenTester.waitForTimer(); // sign transaction
				await screenTester.waitForTimer(); // announce transaction

				// Assert:
				expect(walletControllerMock.modules.token.createTransaction)
					.toHaveBeenCalledWith(expect.objectContaining(expected.transactionOptions));
				expect(walletControllerMock.signTransactionBundle).toHaveBeenCalledWith(mosaicTransactionBundle);
				expect(walletControllerMock.announceSignedTransactionBundle).toHaveBeenCalledWith(signedTransactionBundle);
			});
		};

		const sendTransactionTests = [
			{
				description: 'creates and sends an unlimited-duration mosaic with the default flags',
				config: {
					divisibility: '0',
					supply: '100',
					isExpiring: false,
					flagsToToggle: []
				},
				expected: {
					transactionOptions: {
						initialSupply: '100',
						divisibility: 0,
						duration: MOSAIC_NEVER_EXPIRING_DURATION,
						isSupplyMutable: false,
						isTransferable: true,
						isRestrictable: false,
						isRevokable: false
					}
				}
			},
			{
				description: 'creates and sends a limited-duration mosaic with restrictable and revokable enabled',
				config: {
					divisibility: '3',
					supply: '500',
					isExpiring: true,
					duration: '1000',
					flagsToToggle: ['isRestrictable', 'isRevokable']
				},
				expected: {
					transactionOptions: {
						initialSupply: '500',
						divisibility: 3,
						duration: 1000,
						isSupplyMutable: false,
						isTransferable: true,
						isRestrictable: true,
						isRevokable: true
					}
				}
			},
			{
				description: 'creates and sends a limited-duration mosaic with supply mutable enabled and transferable disabled',
				config: {
					divisibility: '6',
					supply: '1',
					isExpiring: true,
					duration: '5000',
					flagsToToggle: ['isSupplyMutable', 'isTransferable']
				},
				expected: {
					transactionOptions: {
						initialSupply: '1',
						divisibility: 6,
						duration: 5000,
						isSupplyMutable: true,
						isTransferable: false,
						isRestrictable: false,
						isRevokable: false
					}
				}
			}
		];

		sendTransactionTests.forEach(test => {
			runSendTransactionTest(test.description, test.config, test.expected);
		});
	});
});

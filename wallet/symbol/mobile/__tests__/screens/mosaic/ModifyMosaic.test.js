import { MosaicSupplyChangeAction } from '@/app/constants';
import { ModifyMosaic } from '@/app/screens/mosaic/ModifyMosaic';
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
const MOSAIC_NAME = 'my.mutable.mosaic';
const MOSAIC_DIVISIBILITY = 0;
const DIVISIBLE_MOSAIC_DIVISIBILITY = 2;

const CURRENT_SUPPLY = '1000';
const CURRENT_SUPPLY_TEXT = '1 000';
const INCREASED_SUPPLY = '1500';
const INCREASE_DELTA = '500';
const INCREASE_DELTA_TEXT = '+500';
const DECREASED_SUPPLY = '400';
const DECREASE_DELTA = '600';
const DECREASE_DELTA_TEXT = '-600';
const EXCESSIVE_SUPPLY = '9000000000000001';
const FRACTIONAL_SUPPLY = '10.5';
const TOO_MANY_DECIMALS_SUPPLY = '1000.555';
const EMPTY_SUPPLY = '';

// Screen Text

const SCREEN_TEXT = {
	// Section titles and descriptions
	textScreenTitle: 'screen_ModifyMosaic',
	textDescription: 's_modifyMosaic_description',
	textCreatorTitle: 's_mosaicCreation_sender_title',

	// Supply delta summary
	textCurrentSupplyLabel: 's_modifyMosaic_currentSupply_label',
	textDeltaLabel: 's_modifyMosaic_delta_label',

	// Input labels (accessibility)
	inputMosaicLabel: 'input_mosaic',
	inputNewSupplyLabel: 's_modifyMosaic_newSupply_label',

	// Fee selector
	textFeeSpeedTitle: 'input_feeSpeed',

	// Buttons
	buttonSend: 'button_send',
	buttonConfirm: 'button_confirm',

	// Confirmation dialog
	textConfirmDialogTitle: 's_modifyMosaic_confirm_title',

	// Validation errors
	errorSupplyUnchanged: 'validation_error_mosaic_supply_unchanged',
	errorSupplyHigh: 'validation_error_mosaic_supply_high',
	errorSupplyWhole: 'validation_error_mosaic_supply_whole',
	errorSupplyDecimals: 'validation_error_mosaic_supply_decimals',
	errorFieldRequired: 'validation_error_field_required'
};

const validationErrors = [
	SCREEN_TEXT.errorSupplyUnchanged,
	SCREEN_TEXT.errorSupplyHigh,
	SCREEN_TEXT.errorSupplyWhole,
	SCREEN_TEXT.errorSupplyDecimals,
	SCREEN_TEXT.errorFieldRequired
];

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

// Mosaic Info Fixtures

const mosaicInfo = {
	id: MOSAIC_ID,
	names: [MOSAIC_NAME],
	divisibility: MOSAIC_DIVISIBILITY,
	supply: CURRENT_SUPPLY
};

const divisibleMosaicInfo = {
	...mosaicInfo,
	divisibility: DIVISIBLE_MOSAIC_DIVISIBILITY
};

// Mock Supply Change Transaction Bundle (returned by the token module)

const supplyChangeTransaction = {
	type: 'mosaicSupplyChange',
	signerAddress: currentAccount.address,
	mosaicId: MOSAIC_ID,
	action: 'Increase',
	delta: INCREASE_DELTA,
	fee: { token: { amount: '0.1' } }
};

const supplyChangeTransactionBundle = {
	transactions: [supplyChangeTransaction],
	applyFeeTier: jest.fn()
};

// Signed Transaction Bundle Fixtures

const signedTransactionBundle = {
	transactions: [{ hash: 'SIGNED_TX_HASH' }]
};

// Setup

const setupMocks = (overrides = {}) => {
	mockLocalization();

	const walletControllerMock = mockWalletController({
		chainName: CHAIN_NAME,
		networkIdentifier: NETWORK_IDENTIFIER,
		ticker: TICKER,
		networkProperties: symbolNetworkProperties,
		isWalletReady: overrides.isWalletReady ?? true,
		isNetworkConnectionReady: overrides.isNetworkConnectionReady ?? true,
		currentAccount,
		accounts: {
			[NETWORK_IDENTIFIER]: walletAccounts
		},
		networkApi: {
			mosaic: {
				fetchMosaicInfo: jest.fn().mockResolvedValue(overrides.mosaic ?? mosaicInfo)
			}
		},
		signTransactionBundle: jest.fn().mockResolvedValue(signedTransactionBundle),
		announceSignedTransactionBundle: jest.fn().mockResolvedValue({}),
		modules: {
			token: {
				createSupplyChangeTransaction: jest.fn().mockReturnValue(supplyChangeTransactionBundle)
			},
			transfer: {
				calculateTransactionFees: jest.fn().mockResolvedValue(transactionFees)
			},
			multisig: {
				multisigAccounts: [],
				fetchData: jest.fn().mockResolvedValue([])
			},
			addressBook: createAddressBookMock([])
		}
	});

	return { walletControllerMock };
};

// Renders the screen and waits for the initial loads (sender options, mosaic info)

const renderModifyMosaicScreen = async (routeParams = {}) => {
	const props = {
		route: {
			params: {
				chainName: CHAIN_NAME,
				tokenId: MOSAIC_ID,
				...routeParams
			}
		}
	};
	const screenTester = new ScreenTester(ModifyMosaic, props);
	await screenTester.waitForTimer(); // sender options and mosaic info load

	return screenTester;
};

// Enters a new total supply and waits for the debounced fee calculation

const enterNewSupply = async (screenTester, supply) => {
	screenTester.inputText(SCREEN_TEXT.inputNewSupplyLabel, supply);
	await screenTester.waitForTimer(); // fee calculation
};

describe('screens/mosaic/ModifyMosaic', () => {
	beforeEach(() => {
		jest.useFakeTimers();
		jest.clearAllMocks();
	});

	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
	});

	describe('render', () => {
		it('renders the title, description, section title and the send button', async () => {
			// Arrange:
			setupMocks();
			const expectedTexts = [
				SCREEN_TEXT.textScreenTitle,
				SCREEN_TEXT.textDescription,
				SCREEN_TEXT.textCreatorTitle,
				SCREEN_TEXT.textCurrentSupplyLabel,
				SCREEN_TEXT.textDeltaLabel,
				SCREEN_TEXT.buttonSend
			];

			// Act:
			const screenTester = await renderModifyMosaicScreen();

			// Assert:
			screenTester.expectText(expectedTexts);
		});

		it('shows the fixed mosaic name in the disabled token selector', async () => {
			// Arrange:
			setupMocks();

			// Act:
			const screenTester = await renderModifyMosaicScreen();

			// Assert:
			screenTester.expectText([MOSAIC_NAME]);
		});

		it('shows a loading indicator until the wallet and mosaic are ready', async () => {
			// Arrange:
			setupMocks({ isWalletReady: false });

			// Act:
			const screenTester = new ScreenTester(ModifyMosaic, {
				route: { params: { chainName: CHAIN_NAME, tokenId: MOSAIC_ID } }
			});

			// Assert:
			screenTester.expectLoadingIndicator();
		});
	});

	describe('current supply', () => {
		it('pre-fills the new supply input with the current mosaic supply', async () => {
			// Arrange:
			setupMocks();

			// Act:
			const screenTester = await renderModifyMosaicScreen();

			// Assert:
			screenTester.expectInputValue(CURRENT_SUPPLY);
		});

		it('shows the grouped current supply in the delta summary', async () => {
			// Arrange:
			setupMocks();

			// Act:
			const screenTester = await renderModifyMosaicScreen();

			// Assert: both the current and the new supply row show the untouched supply
			screenTester.expectText([CURRENT_SUPPLY_TEXT], true);
		});
	});

	describe('supply delta', () => {
		const runSupplyDeltaTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				setupMocks();
				const screenTester = await renderModifyMosaicScreen();

				// Act:
				await enterNewSupply(screenTester, config.newSupply);

				// Assert:
				screenTester.expectText([expected.deltaText]);
			});
		};

		const supplyDeltaTests = [
			{
				description: 'shows a positive delta when the supply is increased',
				config: { newSupply: INCREASED_SUPPLY },
				expected: { deltaText: INCREASE_DELTA_TEXT }
			},
			{
				description: 'shows a negative delta when the supply is decreased',
				config: { newSupply: DECREASED_SUPPLY },
				expected: { deltaText: DECREASE_DELTA_TEXT }
			}
		];

		supplyDeltaTests.forEach(test => {
			runSupplyDeltaTest(test.description, test.config, test.expected);
		});
	});

	describe('supply validation', () => {
		const runSupplyValidationTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				setupMocks({ mosaic: config.mosaic });
				const screenTester = await renderModifyMosaicScreen();

				// Act:
				if (config.newSupply !== undefined)
					await enterNewSupply(screenTester, config.newSupply);

				// Assert:
				if (expected.errorText)
					screenTester.expectText([expected.errorText]);
				else
					screenTester.notExpectText(validationErrors);
			});
		};

		const supplyValidationTests = [
			{
				description: 'renders the unchanged error when the supply is left at its current value',
				config: {},
				expected: { errorText: SCREEN_TEXT.errorSupplyUnchanged }
			},
			{
				description: 'renders the required error when the supply is cleared',
				config: { newSupply: EMPTY_SUPPLY },
				expected: { errorText: SCREEN_TEXT.errorFieldRequired }
			},
			{
				description: 'renders the whole-number error when a fraction is entered for an indivisible mosaic',
				config: { newSupply: FRACTIONAL_SUPPLY },
				expected: { errorText: SCREEN_TEXT.errorSupplyWhole }
			},
			{
				description: 'renders the decimals error when more decimals than the divisibility are entered',
				config: { mosaic: divisibleMosaicInfo, newSupply: TOO_MANY_DECIMALS_SUPPLY },
				expected: { errorText: SCREEN_TEXT.errorSupplyDecimals }
			},
			{
				description: 'renders the supply-too-high error when the supply exceeds the network maximum',
				config: { newSupply: EXCESSIVE_SUPPLY },
				expected: { errorText: SCREEN_TEXT.errorSupplyHigh }
			},
			{
				description: 'renders no error for a valid supply change',
				config: { newSupply: INCREASED_SUPPLY },
				expected: { errorText: null }
			}
		];

		supplyValidationTests.forEach(test => {
			runSupplyValidationTest(test.description, test.config, test.expected);
		});
	});

	describe('fee selector', () => {
		it('hides the fee selector while the supply is unchanged', async () => {
			// Arrange:
			setupMocks();

			// Act:
			const screenTester = await renderModifyMosaicScreen();

			// Assert:
			screenTester.notExpectText([SCREEN_TEXT.textFeeSpeedTitle]);
		});

		it('shows the fee selector once a supply change triggers fee calculation', async () => {
			// Arrange:
			setupMocks();
			const screenTester = await renderModifyMosaicScreen();

			// Act:
			await enterNewSupply(screenTester, INCREASED_SUPPLY);

			// Assert:
			screenTester.expectText([SCREEN_TEXT.textFeeSpeedTitle]);
		});
	});

	describe('send button', () => {
		const runSendButtonStateTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				setupMocks({ isNetworkConnectionReady: config.isNetworkConnectionReady });
				const screenTester = await renderModifyMosaicScreen();

				// Act:
				if (config.newSupply)
					await enterNewSupply(screenTester, config.newSupply);

				// Assert:
				if (expected.isDisabled)
					screenTester.expectButtonDisabled(SCREEN_TEXT.buttonSend);
				else
					screenTester.expectButtonEnabled(SCREEN_TEXT.buttonSend);
			});
		};

		const sendButtonTests = [
			{
				description: 'disables the send button while the supply is unchanged',
				config: { isNetworkConnectionReady: true },
				expected: { isDisabled: true }
			},
			{
				description: 'disables the send button when the network connection is not ready',
				config: { isNetworkConnectionReady: false, newSupply: INCREASED_SUPPLY },
				expected: { isDisabled: true }
			},
			{
				description: 'enables the send button once a valid supply change and fees are ready',
				config: { isNetworkConnectionReady: true, newSupply: INCREASED_SUPPLY },
				expected: { isDisabled: false }
			}
		];

		sendButtonTests.forEach(test => {
			runSendButtonStateTest(test.description, test.config, test.expected);
		});
	});

	describe('send transaction flow', () => {
		const runSendTransactionTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				const { walletControllerMock } = setupMocks();
				mockPasscode();
				mockRouter({ goBack: jest.fn() });
				const screenTester = await renderModifyMosaicScreen();

				// Act:
				await enterNewSupply(screenTester, config.newSupply);

				screenTester.pressButton(SCREEN_TEXT.buttonSend);
				await screenTester.waitForTimer(); // create transaction, open confirmation dialog
				screenTester.expectText([SCREEN_TEXT.textConfirmDialogTitle]);

				screenTester.pressButton(SCREEN_TEXT.buttonConfirm);
				await screenTester.waitForTimer(); // passcode success, send execution delay
				await screenTester.waitForTimer(); // sign transaction
				await screenTester.waitForTimer(); // announce transaction

				// Assert:
				expect(walletControllerMock.modules.token.createSupplyChangeTransaction)
					.toHaveBeenCalledWith(expect.objectContaining(expected.transactionOptions));
				expect(walletControllerMock.signTransactionBundle).toHaveBeenCalledWith(supplyChangeTransactionBundle);
				expect(walletControllerMock.announceSignedTransactionBundle).toHaveBeenCalledWith(signedTransactionBundle);
			});
		};

		const sendTransactionTests = [
			{
				description: 'increases the supply on behalf of the current account',
				config: { newSupply: INCREASED_SUPPLY },
				expected: {
					transactionOptions: {
						mosaicId: MOSAIC_ID,
						divisibility: MOSAIC_DIVISIBILITY,
						delta: INCREASE_DELTA,
						action: MosaicSupplyChangeAction.Increase
					}
				}
			},
			{
				description: 'decreases the supply on behalf of the current account',
				config: { newSupply: DECREASED_SUPPLY },
				expected: {
					transactionOptions: {
						mosaicId: MOSAIC_ID,
						divisibility: MOSAIC_DIVISIBILITY,
						delta: DECREASE_DELTA,
						action: MosaicSupplyChangeAction.Decrease
					}
				}
			}
		];

		sendTransactionTests.forEach(test => {
			runSendTransactionTest(test.description, test.config, test.expected);
		});
	});
});

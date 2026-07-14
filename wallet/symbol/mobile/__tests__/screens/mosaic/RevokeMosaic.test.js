import { RevokeMosaic } from '@/app/screens/mosaic/RevokeMosaic';
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
const MOSAIC_NAME = 'my.revokable.mosaic';
const MOSAIC_DIVISIBILITY = 0;

const HOLDER_A_BALANCE = '1000';
const HOLDER_B_BALANCE = '500';
const VALID_AMOUNT = '5';
const EXCESSIVE_AMOUNT = '5000';

// Screen Text

const SCREEN_TEXT = {
	// Section titles and descriptions
	textScreenTitle: 'screen_RevokeMosaic',
	textDescription: 's_revoke_description',
	textCreatorTitle: 's_mosaicCreation_sender_title',
	textFromTitle: 's_send_from_title',
	textTokenTitle: 's_send_token_title',

	// Input labels (accessibility)
	inputMosaicLabel: 'input_mosaic',
	inputAmountLabel: 'input_amount',
	inputAccountLabel: 'fieldTitle_account',

	// Fee selector
	textFeeSpeedTitle: 'input_feeSpeed',

	// Buttons
	buttonSend: 'button_send',
	buttonConfirm: 'button_confirm',

	// Confirmation dialog
	textConfirmDialogTitle: 'form_transfer_confirm_title',

	// Validation errors
	errorBalanceNotEnough: 'validation_error_balance_not_enough'
};

// Account Fixtures

const currentAccount = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.build();

const holderAccountA = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 1)
	.build();

const holderAccountB = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 2)
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

// Mosaic Info and Holders Fixtures

const mosaicInfo = {
	id: MOSAIC_ID,
	names: [MOSAIC_NAME],
	divisibility: MOSAIC_DIVISIBILITY
};

const holders = [
	{ address: holderAccountA.address, amount: HOLDER_A_BALANCE },
	{ address: holderAccountB.address, amount: HOLDER_B_BALANCE }
];

// Mock Revocation Transaction Bundle (returned by the token module)

const revocationTransaction = {
	type: 'mosaicSupplyRevocation',
	signerAddress: currentAccount.address,
	sourceAddress: holderAccountA.address,
	mosaic: { id: MOSAIC_ID, amount: VALID_AMOUNT },
	fee: { token: { amount: '0.1' } }
};

const revokeTransactionBundle = {
	transactions: [revocationTransaction],
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
				fetchMosaicOwners: jest.fn().mockResolvedValue(overrides.owners ?? holders),
				createRevocationTransaction: jest.fn().mockReturnValue(revokeTransactionBundle)
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

// Renders the screen and waits for the initial loads (sender options, mosaic info, holders)

const renderRevokeMosaicScreen = async (routeParams = {}) => {
	const props = {
		route: {
			params: {
				chainName: CHAIN_NAME,
				tokenId: MOSAIC_ID,
				...routeParams
			}
		}
	};
	const screenTester = new ScreenTester(RevokeMosaic, props);
	await screenTester.waitForTimer(); // sender options, mosaic info and holders load

	return screenTester;
};

// Opens the source account dropdown and selects the holder with the given address

const selectSourceHolder = (screenTester, address) => {
	screenTester.presButtonByLabel(SCREEN_TEXT.inputAccountLabel);
	screenTester.pressButton(address);
};

describe('screens/mosaic/RevokeMosaic', () => {
	beforeEach(() => {
		jest.useFakeTimers();
		jest.clearAllMocks();
	});

	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
	});

	describe('render', () => {
		it('renders the title, description, section titles and the send button', async () => {
			// Arrange:
			setupMocks();
			const expectedTexts = [
				SCREEN_TEXT.textScreenTitle,
				SCREEN_TEXT.textDescription,
				SCREEN_TEXT.textCreatorTitle,
				SCREEN_TEXT.textFromTitle,
				SCREEN_TEXT.textTokenTitle,
				SCREEN_TEXT.buttonSend
			];

			// Act:
			const screenTester = await renderRevokeMosaicScreen();

			// Assert:
			screenTester.expectText(expectedTexts);
		});

		it('shows the fixed mosaic name in the disabled token selector', async () => {
			// Arrange:
			setupMocks();

			// Act:
			const screenTester = await renderRevokeMosaicScreen();

			// Assert:
			screenTester.expectText([MOSAIC_NAME]);
		});

		it('shows a loading indicator until the wallet, mosaic and holders are ready', async () => {
			// Arrange:
			setupMocks({ isWalletReady: false });

			// Act:
			const screenTester = new ScreenTester(RevokeMosaic, {
				route: { params: { chainName: CHAIN_NAME, tokenId: MOSAIC_ID } }
			});

			// Assert:
			screenTester.expectLoadingIndicator();
		});
	});

	describe('source account', () => {
		const runSourceAccountTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				setupMocks({ owners: config.owners });
				const screenTester = await renderRevokeMosaicScreen({ senderAddress: config.senderAddress });

				// Act:
				screenTester.presButtonByLabel(SCREEN_TEXT.inputAccountLabel);

				// Assert:
				screenTester.expectText(expected.presentAddresses);
				screenTester.notExpectText(expected.absentAddresses);
			});
		};

		const sourceAccountTests = [
			{
				description: 'lists all mosaic holders as selectable options',
				config: { owners: holders, senderAddress: currentAccount.address },
				expected: {
					presentAddresses: [holderAccountA.address, holderAccountB.address],
					absentAddresses: []
				}
			},
			{
				description: 'excludes the creator from the holder options when the creator also holds the mosaic',
				config: { owners: holders, senderAddress: holderAccountA.address },
				expected: {
					presentAddresses: [holderAccountB.address],
					absentAddresses: [holderAccountA.address]
				}
			}
		];

		sourceAccountTests.forEach(test => {
			runSourceAccountTest(test.description, test.config, test.expected);
		});
	});

	describe('amount validation', () => {
		const runAmountValidationTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				setupMocks();
				const screenTester = await renderRevokeMosaicScreen();
				selectSourceHolder(screenTester, holderAccountA.address); // available balance becomes the holder balance

				// Act:
				screenTester.inputText(SCREEN_TEXT.inputAmountLabel, config.amount);
				await screenTester.waitForTimer(); // fee calculation

				// Assert:
				if (expected.errorText)
					screenTester.expectText([expected.errorText]);
				else
					screenTester.notExpectText([SCREEN_TEXT.errorBalanceNotEnough]);
			});
		};

		const amountValidationTests = [
			{
				description: 'renders no error for an amount within the holder balance',
				config: { amount: VALID_AMOUNT },
				expected: { errorText: null }
			},
			{
				description: 'renders the balance-not-enough error when the amount exceeds the holder balance',
				config: { amount: EXCESSIVE_AMOUNT },
				expected: { errorText: SCREEN_TEXT.errorBalanceNotEnough }
			}
		];

		amountValidationTests.forEach(test => {
			runAmountValidationTest(test.description, test.config, test.expected);
		});
	});

	describe('fee selector', () => {
		it('hides the fee selector until a holder and an amount are provided', async () => {
			// Arrange:
			setupMocks();

			// Act:
			const screenTester = await renderRevokeMosaicScreen();

			// Assert:
			screenTester.notExpectText([SCREEN_TEXT.textFeeSpeedTitle]);
		});

		it('shows the fee selector after a holder and an amount trigger fee calculation', async () => {
			// Arrange:
			setupMocks();
			const screenTester = await renderRevokeMosaicScreen();

			// Act:
			selectSourceHolder(screenTester, holderAccountA.address);
			screenTester.inputText(SCREEN_TEXT.inputAmountLabel, VALID_AMOUNT);
			await screenTester.waitForTimer(); // fee calculation

			// Assert:
			screenTester.expectText([SCREEN_TEXT.textFeeSpeedTitle]);
		});
	});

	describe('send button', () => {
		const runSendButtonStateTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				setupMocks({ isNetworkConnectionReady: config.isNetworkConnectionReady });
				const screenTester = await renderRevokeMosaicScreen();

				// Act:
				if (config.selectHolder) {
					selectSourceHolder(screenTester, holderAccountA.address);
					screenTester.inputText(SCREEN_TEXT.inputAmountLabel, VALID_AMOUNT);
					await screenTester.waitForTimer(); // fee calculation
				}

				// Assert:
				if (expected.isDisabled)
					screenTester.expectButtonDisabled(SCREEN_TEXT.buttonSend);
				else
					screenTester.expectButtonEnabled(SCREEN_TEXT.buttonSend);
			});
		};

		const sendButtonTests = [
			{
				description: 'disables the send button when no holder is selected',
				config: { isNetworkConnectionReady: true, selectHolder: false },
				expected: { isDisabled: true }
			},
			{
				description: 'disables the send button when the network connection is not ready',
				config: { isNetworkConnectionReady: false, selectHolder: true },
				expected: { isDisabled: true }
			},
			{
				description: 'enables the send button once a holder, a valid amount and fees are ready',
				config: { isNetworkConnectionReady: true, selectHolder: true },
				expected: { isDisabled: false }
			}
		];

		sendButtonTests.forEach(test => {
			runSendButtonStateTest(test.description, test.config, test.expected);
		});
	});

	describe('route params', () => {
		it('pre-fills the amount from the amount route param', async () => {
			// Arrange:
			setupMocks();

			// Act:
			const screenTester = await renderRevokeMosaicScreen({ amount: VALID_AMOUNT });

			// Assert:
			screenTester.expectInputValue(VALID_AMOUNT);
		});

		it('pre-selects the source holder from the sourceAddress route param', async () => {
			// Arrange:
			setupMocks();

			// Act:
			const screenTester = await renderRevokeMosaicScreen({ sourceAddress: holderAccountA.address });

			// Assert:
			screenTester.expectText([holderAccountA.address]);
		});
	});

	describe('send transaction flow', () => {
		const runSendTransactionTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				const { walletControllerMock } = setupMocks();
				mockPasscode();
				mockRouter({ goBack: jest.fn() });
				const screenTester = await renderRevokeMosaicScreen();

				// Act:
				selectSourceHolder(screenTester, config.sourceAddress);
				screenTester.inputText(SCREEN_TEXT.inputAmountLabel, config.amount);
				await screenTester.waitForTimer(); // fee calculation

				screenTester.pressButton(SCREEN_TEXT.buttonSend);
				await screenTester.waitForTimer(); // create transaction, open confirmation dialog
				screenTester.expectText([SCREEN_TEXT.textConfirmDialogTitle]);

				screenTester.pressButton(SCREEN_TEXT.buttonConfirm);
				await screenTester.waitForTimer(); // passcode success, send execution delay
				await screenTester.waitForTimer(); // sign transaction
				await screenTester.waitForTimer(); // announce transaction

				// Assert:
				expect(walletControllerMock.modules.token.createRevocationTransaction)
					.toHaveBeenCalledWith(expect.objectContaining(expected.transactionOptions));
				expect(walletControllerMock.signTransactionBundle).toHaveBeenCalledWith(revokeTransactionBundle);
				expect(walletControllerMock.announceSignedTransactionBundle).toHaveBeenCalledWith(signedTransactionBundle);
			});
		};

		const sendTransactionTests = [
			{
				description: 'revokes the mosaic from the selected holder on behalf of the current account',
				config: { sourceAddress: holderAccountA.address, amount: VALID_AMOUNT },
				expected: {
					transactionOptions: {
						senderPublicKey: currentAccount.publicKey,
						mosaicId: MOSAIC_ID,
						divisibility: MOSAIC_DIVISIBILITY,
						amount: VALID_AMOUNT,
						sourceAddress: holderAccountA.address
					}
				}
			}
		];

		sendTransactionTests.forEach(test => {
			runSendTransactionTest(test.description, test.config, test.expected);
		});
	});
});

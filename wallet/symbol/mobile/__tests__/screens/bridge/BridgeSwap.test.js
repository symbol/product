import { BridgeSwap } from '@/app/screens/bridge/BridgeSwap';
import { BridgeMode, BridgePairsStatus, BridgeRequestStatus } from '@/app/screens/bridge/types/Bridge';
import { AccountFixtureBuilder } from '__fixtures__/local/AccountFixtureBuilder';
import { NetworkPropertiesFixtureBuilder } from '__fixtures__/local/NetworkPropertiesFixtureBuilder';
import { TokenFixtureBuilder } from '__fixtures__/local/TokenFixtureBuilder';
import { TransactionFeeFixtureBuilder } from '__fixtures__/local/TransactionFeeFixtureBuilder';
import { ScreenTester } from '__tests__/ScreenTester';
import { createWalletControllerMock, mockLocalization, mockPasscode, mockRouter, mockWalletController } from '__tests__/mock-helpers';
import { TransactionBundle } from 'wallet-common-core'; // eslint-disable-line import/order

// Mocks

jest.mock('@react-navigation/native', () => ({
	...jest.requireActual('@react-navigation/native'),
	useIsFocused: () => true,
	useFocusEffect: callback => callback()
}));

jest.mock('@/app/screens/bridge/hooks', () => ({
	useBridge: jest.fn(),
	useBridgeAmount: jest.fn(),
	useBridgeDisabledDialog: jest.fn(),
	useBridgeHistory: jest.fn(),
	useBridgeNoPairsDialog: jest.fn(),
	useBridgeTransaction: jest.fn(),
	useBridgeTransactionWorkflow:
		jest.requireActual('@/app/screens/bridge/hooks/useBridgeTransactionWorkflow').useBridgeTransactionWorkflow,
	useEstimation: jest.fn(),
	useSwapSelector: jest.fn()
}));


// Constants

const CHAIN_NAME_SYMBOL = 'symbol';
const CHAIN_NAME_ETHEREUM = 'ethereum';
const NETWORK_IDENTIFIER = 'testnet';
const BRIDGE_ID_XYM_TO_BXYM = 'symbol-xym-ethereum-bxym';
const PAYOUT_AMOUNT = '99';
const HISTORY_ITEM_TRANSACTION_HASH = '0C905EB065E6A42029CD1A10E710422761495A63D433535BA6EAA9BCF36AB8B6';

// Screen Text

const SCREEN_TEXT = {
	// Titles
	textScreenTitle: 's_bridge_title',
	textScreenDescription: 's_bridge_description',
	textHistoryTitle: 's_bridge_history_title',
	textHistoryDescription: 's_bridge_history_description',
	textSummaryTitle: 's_bridge_summary_title',

	// Summary
	textSummaryAmountSend: 's_bridge_summary_amountSend',
	textSummaryBridgeFee: 's_bridge_summary_bridgeFee',
	textSummaryTransactionFee: 's_bridge_summary_transactionFee',
	textSummaryAmountReceive: 's_bridge_summary_amountReceive',

	// Dialog
	textDialogNoPairsTitle: 's_bridge_swap_dialog_noPairs_title',
	textDialogNoPairsText: 's_bridge_swap_dialog_noPairs_text',
	textDialogDisabledTitle: 's_bridge_swap_dialog_disabled_title',
	textDialogDisabledText: 's_bridge_swap_dialog_disabled_text',
	textDialogConfirmTitle: 's_bridge_swap_dialog_confirm_title',
	textDialogConfirmText: 's_bridge_swap_dialog_confirm_text',

	// Buttons
	buttonSend: 'button_send',
	buttonConfirm: 'button_confirm',
	buttonCancel: 'button_cancel',
	buttonOk: 'button_ok',

	// Accessibility Labels
	labelSelectSourceToken: 'Select source token',
	labelSelectTargetToken: 'Select target token',
	inputAmountLabel: 'form_transfer_input_amount',

	// History item
	textSwapAction: 'transactionDescriptor_swap',

	// Validation
	textEstimationUnavailable: 'validation_error_estimation_unavailable',
	textInsufficientLiquidity: 'validation_error_insufficientLiquidity 0.235399 ETH',

	// Price impact
	textSummaryPriceImpact: 's_bridge_summary_priceImpact',
	textSummaryPriceImpactWarningValue: '6.00% · s_bridge_summary_priceImpact_high',
	textSummaryPriceImpactUnknown: 's_bridge_summary_priceImpact_unknown',
	textDialogPriceImpactTitle: 's_bridge_swap_dialog_priceImpact_title',

	// Placeholder shown by a summary row without a value
	textValueMissing: '-',

	// Token Display Names
	displayNameTokenXym: 'Symbol • XYM',
	displayNameTokenBxym: 'Bridged XYM • bXYM',
	displayNameTokenEth: 'Ether • ETH'
};

// Account Fixtures

const symbolAccount = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME_SYMBOL, NETWORK_IDENTIFIER, 0)
	.build();

const ethereumAccount = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME_ETHEREUM, NETWORK_IDENTIFIER, 0)
	.build();

// Network Properties Fixtures

const symbolNetworkProperties = NetworkPropertiesFixtureBuilder
	.createWithType(CHAIN_NAME_SYMBOL, NETWORK_IDENTIFIER)
	.build();

const ethereumNetworkProperties = NetworkPropertiesFixtureBuilder
	.createWithType(CHAIN_NAME_ETHEREUM, NETWORK_IDENTIFIER)
	.build();

// Token Fixtures

const tokenXym = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME_SYMBOL, NETWORK_IDENTIFIER, 0)
	.setAmount('1000')
	.build();

const tokenBxym = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME_ETHEREUM, NETWORK_IDENTIFIER, 1)
	.setAmount('500')
	.build();

const tokenBxymPayout = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME_ETHEREUM, NETWORK_IDENTIFIER, 1)
	.setAmount(PAYOUT_AMOUNT)
	.build();

const tokenEth = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME_ETHEREUM, NETWORK_IDENTIFIER, 0)
	.setAmount('2000')
	.build();

// Transfer Module Mock Factory

const createTransferModuleMock = () => ({
	calculateTransactionFees: jest.fn().mockResolvedValue(transactionFeeTiers)
});

// Wallet Controller Fixtures

const symbolWalletController = createWalletControllerMock({
	chainName: CHAIN_NAME_SYMBOL,
	networkIdentifier: NETWORK_IDENTIFIER,
	networkProperties: symbolNetworkProperties,
	currentAccount: symbolAccount,
	modules: {
		transfer: createTransferModuleMock(),
		bridge: {
			createTransaction: jest.fn().mockResolvedValue({})
		}
	}
});

const ethereumWalletController = createWalletControllerMock({
	chainName: CHAIN_NAME_ETHEREUM,
	networkIdentifier: NETWORK_IDENTIFIER,
	networkProperties: ethereumNetworkProperties,
	currentAccount: ethereumAccount,
	modules: {
		transfer: createTransferModuleMock(),
		bridge: {
			createTransaction: jest.fn().mockResolvedValue({})
		}
	}
});

// Bridge Fixtures

const bridgeStepPair = {
	sourceWalletController: symbolWalletController,
	targetWalletController: ethereumWalletController,
	sourceTokenInfo: tokenXym,
	targetTokenInfo: tokenBxym
};

const bridgeMock = {
	id: BRIDGE_ID_XYM_TO_BXYM,
	steps: 1,
	isReady: true,
	estimateRequest: jest.fn().mockResolvedValue({
		bridgeFee: '1',
		receiveAmount: PAYOUT_AMOUNT
	}),
	getPairForStep: jest.fn().mockReturnValue(bridgeStepPair),
	createTransaction: jest.fn(),
	fetchRecentHistory: jest.fn().mockResolvedValue([])
};

// Swap Side Fixtures

const swapSideSymbolXym = {
	token: tokenXym,
	chainName: CHAIN_NAME_SYMBOL,
	networkIdentifier: NETWORK_IDENTIFIER,
	walletController: symbolWalletController
};

const swapSideEthereumBxym = {
	token: tokenBxym,
	chainName: CHAIN_NAME_ETHEREUM,
	networkIdentifier: NETWORK_IDENTIFIER,
	walletController: ethereumWalletController
};

const swapSideEthereumEth = {
	token: tokenEth,
	chainName: CHAIN_NAME_ETHEREUM,
	networkIdentifier: NETWORK_IDENTIFIER,
	walletController: ethereumWalletController
};

// Swap Pair Fixtures

const swapPairXymToBxym = {
	source: swapSideSymbolXym,
	target: swapSideEthereumBxym,
	bridge: bridgeMock,
	mode: BridgeMode.WRAP
};

const swapPairXymToEth = {
	source: swapSideSymbolXym,
	target: swapSideEthereumEth,
	bridge: bridgeMock,
	mode: BridgeMode.WRAP
};

// Pair Collections

const allPairs = [swapPairXymToBxym, swapPairXymToEth];

// History Fixtures

const historyItem = {
	requestTransaction: {
		hash: HISTORY_ITEM_TRANSACTION_HASH,
		timestamp: 1684265310994
	},
	sourceChainName: CHAIN_NAME_SYMBOL,
	targetChainName: CHAIN_NAME_ETHEREUM,
	sourceTokenInfo: tokenXym,
	targetTokenInfo: tokenBxym,
	payoutTransaction: {
		token: tokenBxymPayout
	},
	requestStatus: BridgeRequestStatus.CONFIRMED,
	payoutStatus: 2
};

// Transaction Fixtures

const transactionBundle = new TransactionBundle([{ hash: 'ABC123', type: 'transfer' }]);

const signedTransactionBundle = new TransactionBundle([{ hash: 'ABC123DEF456' }]);

// Fee Tiers Fixtures

const transactionFeeTiers = [
	TransactionFeeFixtureBuilder
		.createWithAmounts('1', '2', '3')
		.build()
];

// Estimation Fixtures

const estimationResult = {
	bridgeFee: '1',
	receiveAmount: PAYOUT_AMOUNT
};

// Hook Mocks

const {
	useBridge,
	useBridgeAmount,
	useBridgeDisabledDialog,
	useBridgeHistory,
	useBridgeNoPairsDialog,
	useBridgeTransaction,
	useEstimation,
	useSwapSelector
} = require('@/app/screens/bridge/hooks');


// Default Hook Return Values

const createUseBridgeMock = (overrides = {}) => ({
	pairs: allPairs,
	pairsStatus: BridgePairsStatus.OK,
	loadBridges: jest.fn().mockResolvedValue(),
	loadWalletControllers: jest.fn().mockResolvedValue(),
	fetchBalances: jest.fn().mockResolvedValue(),
	...overrides
});

const createUseSwapSelectorMock = (overrides = {}) => ({
	isReady: true,
	bridge: bridgeMock,
	mode: BridgeMode.WRAP,
	source: swapSideSymbolXym,
	target: swapSideEthereumBxym,
	sourceList: [swapSideSymbolXym, swapSideEthereumEth],
	targetList: [swapSideEthereumBxym, swapSideEthereumEth],
	changeSource: jest.fn(),
	changeTarget: jest.fn(),
	reverse: jest.fn(),
	...overrides
});

const createUseBridgeAmountMock = (overrides = {}) => ({
	amount: '0',
	amountInput: '0',
	isAmountValid: true,
	availableBalance: '1000',
	changeAmount: jest.fn(),
	changeAmountValidity: jest.fn(),
	reset: jest.fn(),
	...overrides
});

const createUseBridgeTransactionMock = (overrides = {}) => ({
	createTransaction: jest.fn().mockResolvedValue(transactionBundle),
	getConfirmationPreview: jest.fn().mockReturnValue([]),
	...overrides
});

const createUseEstimationMock = (overrides = {}) => ({
	estimations: null,
	estimate: jest.fn().mockResolvedValue(null),
	clearEstimation: jest.fn(),
	isLoading: false,
	hasFailed: false,
	...overrides
});

const createUseBridgeHistoryMock = (overrides = {}) => ({
	history: [],
	isHistoryLoading: false,
	refreshHistory: jest.fn(),
	clearHistory: jest.fn(),
	...overrides
});

const createUseBridgeNoPairsDialogMock = (overrides = {}) => ({
	isVisible: false,
	onSuccess: jest.fn(),
	onCancel: jest.fn(),
	onScreenFocus: jest.fn(),
	...overrides
});

const createUseBridgeDisabledDialogMock = (overrides = {}) => ({
	isVisible: false,
	onClose: jest.fn(),
	onScreenFocus: jest.fn(),
	...overrides
});

// Default Props

const createDefaultProps = (overrides = {}) => ({
	route: {
		params: {
			chainName: CHAIN_NAME_SYMBOL
		}
	},
	...overrides
});

// Mock Setup Helpers

const setupMocks = (config = {}) => {
	const walletController = config.walletController ?? symbolWalletController;
	
	useBridge.mockReturnValue(createUseBridgeMock(config.useBridge));
	useSwapSelector.mockReturnValue(createUseSwapSelectorMock(config.useSwapSelector));
	useBridgeAmount.mockReturnValue(createUseBridgeAmountMock(config.useBridgeAmount));
	useBridgeTransaction.mockReturnValue(createUseBridgeTransactionMock(config.useBridgeTransaction));
	useEstimation.mockReturnValue(createUseEstimationMock(config.useEstimation));
	useBridgeHistory.mockReturnValue(createUseBridgeHistoryMock(config.useBridgeHistory));
	useBridgeNoPairsDialog.mockReturnValue(createUseBridgeNoPairsDialogMock(config.useBridgeNoPairsDialog));
	useBridgeDisabledDialog.mockReturnValue(createUseBridgeDisabledDialogMock(config.useBridgeDisabledDialog));
	
	mockWalletController(walletController);
	
	return walletController;
};

describe('screens/bridge/BridgeSwap', () => {
	beforeEach(() => {
		mockLocalization();
		mockRouter({
			goBack: jest.fn(),
			goToBridgeAccountList: jest.fn(),
			goToBridgeSwapDetails: jest.fn()
		});
		jest.clearAllMocks();
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
	});

	describe('swap token selection and transaction flow', () => {
		it('selects tokens, enters amount, shows estimation summary, and sends transaction', async () => {
			// Arrange:
			const changeSourceMock = jest.fn();
			const changeTargetMock = jest.fn();
			const createTransactionMock = jest.fn().mockResolvedValue(transactionBundle);
			const signTransactionBundleMock = jest.fn().mockResolvedValue(signedTransactionBundle);
			const announceSignedTransactionBundleMock = jest.fn().mockResolvedValue({});
			
			const walletController = createWalletControllerMock({
				...symbolWalletController,
				signTransactionBundle: signTransactionBundleMock,
				announceSignedTransactionBundle: announceSignedTransactionBundleMock
			});

			// The transaction workflow signs and announces through the step pair's source wallet controller
			const bridge = {
				...bridgeMock,
				getPairForStep: jest.fn().mockReturnValue({
					...bridgeStepPair,
					sourceWalletController: walletController
				})
			};

			setupMocks({
				walletController,
				useSwapSelector: {
					isReady: true,
					bridge,
					source: swapSideSymbolXym,
					target: swapSideEthereumBxym,
					sourceList: [swapSideSymbolXym, swapSideEthereumEth],
					targetList: [swapSideEthereumBxym, swapSideEthereumEth],
					changeSource: changeSourceMock,
					changeTarget: changeTargetMock
				},
				useBridgeAmount: {
					amount: '100',
					amountInput: '100',
					isAmountValid: true,
					availableBalance: '1000'
				},
				useBridgeTransaction: {
					createTransaction: createTransactionMock
				},
				useEstimation: {
					estimations: [estimationResult],
					isLoading: false
				},
				useTransactionFees: {
					data: transactionFeeTiers,
					isLoading: false
				}
			});
			mockPasscode();

			const screenTester = new ScreenTester(BridgeSwap, createDefaultProps());
			await screenTester.waitForTimer(); // initial fee calculation + estimation

			// Change source token

			// Act:
			screenTester.presButtonByLabel(SCREEN_TEXT.labelSelectSourceToken);
			screenTester.pressButton(SCREEN_TEXT.displayNameTokenEth);
			
			// Assert:
			expect(changeSourceMock).toHaveBeenCalledWith(swapSideEthereumEth);

			// Change target token

			// Act:
			screenTester.presButtonByLabel(SCREEN_TEXT.labelSelectTargetToken);
			screenTester.pressButton(SCREEN_TEXT.displayNameTokenEth);
			
			// Assert:
			expect(changeTargetMock).toHaveBeenCalledWith(swapSideEthereumEth);

			// Check estimation summary is rendered

			// Assert:
			screenTester.expectText([
				SCREEN_TEXT.textSummaryTitle,
				SCREEN_TEXT.textSummaryAmountSend,
				SCREEN_TEXT.textSummaryBridgeFee,
				SCREEN_TEXT.textSummaryAmountReceive
			]);

			// Send swap transaction

			// Act:
			screenTester.pressButton(SCREEN_TEXT.buttonSend);
			await screenTester.waitForTimer();

			// Assert:
			screenTester.expectText([SCREEN_TEXT.textDialogConfirmTitle]);

			// Act:
			screenTester.pressButton(SCREEN_TEXT.buttonConfirm);
			await screenTester.waitForTimer(); // show passcode
			await screenTester.waitForTimer(); // delay due to issue with modals on iOS. 
			// Cannot open a status dialog immediately after a passcode success
			await screenTester.waitForTimer(); // sign transaction 
			await screenTester.waitForTimer(); // announce transaction

			// Assert:
			expect(createTransactionMock).toHaveBeenCalled();
			expect(signTransactionBundleMock).toHaveBeenCalledWith(transactionBundle);
			expect(announceSignedTransactionBundleMock).toHaveBeenCalledWith(signedTransactionBundle);
		});
	});

	describe('loading state', () => {
		it('shows loading indicator and disables send button when isReady is false', () => {
			// Arrange:
			setupMocks({
				useSwapSelector: {
					isReady: false,
					source: null,
					target: null,
					bridge: null,
					mode: null,
					sourceList: [],
					targetList: []
				}
			});

			// Act:
			const screenTester = new ScreenTester(BridgeSwap, createDefaultProps());

			// Assert:
			screenTester.expectLoadingIndicator();
			screenTester.expectButtonDisabled(SCREEN_TEXT.buttonSend);
		});
	});

	describe('estimation errors', () => {
		it('warns that the estimation is unavailable when the request failed', () => {
			// Arrange:
			setupMocks({
				useEstimation: {
					hasFailed: true
				}
			});

			// Act:
			const screenTester = new ScreenTester(BridgeSwap, createDefaultProps());

			// Assert:
			screenTester.expectText([SCREEN_TEXT.textEstimationUnavailable]);
		});

		it('shows the insufficient liquidity error with the max swappable amount', () => {
			// Arrange: the localization mock appends message parameters so the interpolation is observable.
			mockLocalization((key, params) => (params ? `${key} ${Object.values(params).join(' ')}` : key));
			const insufficientLiquidityEstimation = {
				receiveAmount: null,
				bridgeFee: null,
				error: {
					code: 'insufficient_liquidity',
					params: { maxAmount: '0.235399146392349099', ticker: 'ETH' }
				}
			};
			const changeAmountValidityMock = jest.fn();
			setupMocks({
				useBridgeAmount: {
					amount: '1',
					amountInput: '1',
					changeAmountValidity: changeAmountValidityMock
				},
				useEstimation: {
					estimations: [insufficientLiquidityEstimation]
				}
			});

			// Act:
			const screenTester = new ScreenTester(BridgeSwap, createDefaultProps());

			// Assert:
			screenTester.expectText([SCREEN_TEXT.textInsufficientLiquidity]);
			expect(changeAmountValidityMock).toHaveBeenCalledWith(false);
		});

		it('does not request an estimation and disables send for a zero amount input', async () => {
			// Arrange: '0.0000' is numerically zero but not the literal '0' string.
			const estimateMock = jest.fn().mockResolvedValue(null);
			const clearEstimationMock = jest.fn();
			setupMocks({
				useBridgeAmount: {
					amount: '0.0000',
					amountInput: '0.0000'
				},
				useEstimation: {
					estimate: estimateMock,
					clearEstimation: clearEstimationMock
				}
			});

			// Act:
			const screenTester = new ScreenTester(BridgeSwap, createDefaultProps());
			await screenTester.waitForTimer();

			// Assert:
			expect(estimateMock).not.toHaveBeenCalled();
			expect(clearEstimationMock).toHaveBeenCalled();
			screenTester.expectButtonDisabled(SCREEN_TEXT.buttonSend);
		});

		it('requests an estimation for a positive amount', async () => {
			// Arrange:
			const estimateMock = jest.fn().mockResolvedValue(null);
			setupMocks({
				useBridgeAmount: {
					amount: '1',
					amountInput: '1'
				},
				useEstimation: {
					estimate: estimateMock
				}
			});

			// Act:
			const screenTester = new ScreenTester(BridgeSwap, createDefaultProps());
			await screenTester.waitForTimer();

			// Assert:
			expect(estimateMock).toHaveBeenCalled();
		});

		it('disables send button when the amount fails validation', () => {
			// Arrange:
			setupMocks({
				useBridgeAmount: {
					amount: '100',
					amountInput: '100',
					isAmountValid: false
				}
			});

			// Act:
			const screenTester = new ScreenTester(BridgeSwap, createDefaultProps());

			// Assert:
			screenTester.expectButtonDisabled(SCREEN_TEXT.buttonSend);
		});
	});

	describe('price impact', () => {
		const warningImpactEstimation = { ...estimationResult, priceImpact: 0.06 };
		const criticalImpactEstimation = { ...estimationResult, priceImpact: 0.20331 };
		const unknownImpactEstimation = { ...estimationResult, priceImpact: null };
		const failedEstimation = {
			bridgeFee: null,
			receiveAmount: null,
			priceImpact: null,
			error: { code: 'insufficient_liquidity' }
		};

		it('shows the price difference row with the level wording at the warning tier', () => {
			// Arrange:
			setupMocks({
				useEstimation: {
					estimations: [warningImpactEstimation]
				}
			});

			// Act:
			const screenTester = new ScreenTester(BridgeSwap, createDefaultProps());

			// Assert:
			screenTester.expectText([
				SCREEN_TEXT.textSummaryPriceImpact,
				SCREEN_TEXT.textSummaryPriceImpactWarningValue
			]);
		});

		it('shows the unknown state when the impact could not be computed', () => {
			// Arrange:
			setupMocks({
				useEstimation: {
					estimations: [unknownImpactEstimation]
				}
			});

			// Act:
			const screenTester = new ScreenTester(BridgeSwap, createDefaultProps());

			// Assert:
			screenTester.expectText([SCREEN_TEXT.textSummaryPriceImpactUnknown]);
		});

		it('shows the price difference row with a placeholder when no step involves a swap', () => {
			// Arrange:
			setupMocks({
				useEstimation: {
					estimations: [estimationResult]
				}
			});

			// Act:
			const screenTester = new ScreenTester(BridgeSwap, createDefaultProps());

			// Assert: the price difference is the only row left without a value.
			screenTester.expectText([SCREEN_TEXT.textSummaryPriceImpact]);
			screenTester.notExpectText([SCREEN_TEXT.textSummaryPriceImpactUnknown]);
			screenTester.expectTextCount(SCREEN_TEXT.textValueMissing, 1);
		});

		it('shows placeholders instead of an impact warning when the estimation failed', () => {
			// Arrange:
			setupMocks({
				useEstimation: {
					estimations: [failedEstimation]
				}
			});

			// Act:
			const screenTester = new ScreenTester(BridgeSwap, createDefaultProps());

			// Assert: the bridge fee, price difference and receive rows carry no value.
			screenTester.notExpectText([SCREEN_TEXT.textSummaryPriceImpactUnknown]);
			screenTester.expectTextCount(SCREEN_TEXT.textValueMissing, 3);
		});

		it('gates sending behind a warning dialog at the critical tier', async () => {
			// Arrange:
			setupMocks({
				useBridgeAmount: {
					amount: '1',
					amountInput: '1'
				},
				useEstimation: {
					estimations: [criticalImpactEstimation]
				}
			});
			const screenTester = new ScreenTester(BridgeSwap, createDefaultProps());
			await screenTester.waitForTimer();

			// Act: sending opens the price impact warning instead of the confirmation dialog.
			screenTester.pressButton(SCREEN_TEXT.buttonSend);

			// Assert:
			screenTester.expectText([SCREEN_TEXT.textDialogPriceImpactTitle]);
			screenTester.notExpectText([SCREEN_TEXT.textDialogConfirmTitle]);

			// Act: cancelling returns to the form without sending.
			screenTester.pressButton(SCREEN_TEXT.buttonCancel);

			// Assert:
			screenTester.notExpectText([SCREEN_TEXT.textDialogPriceImpactTitle]);

			// Act: confirming the warning proceeds to the standard confirmation dialog.
			screenTester.pressButton(SCREEN_TEXT.buttonSend);
			screenTester.pressButton(SCREEN_TEXT.buttonConfirm);
			await screenTester.waitForTimer();

			// Assert:
			screenTester.expectText([SCREEN_TEXT.textDialogConfirmTitle]);
		});
	});

	describe('no pairs dialog', () => {
		const runNoPairsDialogTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				const onSuccessMock = jest.fn();
				const onCancelMock = jest.fn();

				setupMocks({
					useBridge: {
						pairsStatus: BridgePairsStatus.NO_PAIRS
					},
					useBridgeNoPairsDialog: {
						isVisible: true,
						onSuccess: onSuccessMock,
						onCancel: onCancelMock
					}
				});

				const screenTester = new ScreenTester(BridgeSwap, createDefaultProps());

				// Assert: dialog is visible
				screenTester.expectText([
					SCREEN_TEXT.textDialogNoPairsTitle,
					SCREEN_TEXT.textDialogNoPairsText
				]);

				// Act:
				screenTester.pressButton(config.buttonToPress);

				// Assert:
				if (expected.shouldCallOnSuccess)
					expect(onSuccessMock).toHaveBeenCalled();

				if (expected.shouldCallOnCancel)
					expect(onCancelMock).toHaveBeenCalled();
			});
		};

		const noPairsDialogTests = [
			{
				description: 'calls onSuccess when confirm is pressed',
				config: {
					buttonToPress: SCREEN_TEXT.buttonConfirm
				},
				expected: {
					shouldCallOnSuccess: true,
					shouldCallOnCancel: false
				}
			},
			{
				description: 'calls onCancel when cancel is pressed',
				config: {
					buttonToPress: SCREEN_TEXT.buttonCancel
				},
				expected: {
					shouldCallOnSuccess: false,
					shouldCallOnCancel: true
				}
			}
		];

		noPairsDialogTests.forEach(test => {
			runNoPairsDialogTest(test.description, test.config, test.expected);
		});
	});

	describe('disabled dialog', () => {
		it('shows the dialog and calls onClose when ok is pressed', async () => {
			// Arrange: every bridge is turned off by its operator, so there is nothing the user can fix.
			const onCloseMock = jest.fn();

			setupMocks({
				useBridge: {
					pairsStatus: BridgePairsStatus.DISABLED
				},
				useBridgeDisabledDialog: {
					isVisible: true,
					onClose: onCloseMock
				}
			});

			const screenTester = new ScreenTester(BridgeSwap, createDefaultProps());

			// Assert: dialog is visible
			screenTester.expectText([
				SCREEN_TEXT.textDialogDisabledTitle,
				SCREEN_TEXT.textDialogDisabledText
			]);

			// Act:
			screenTester.pressButton(SCREEN_TEXT.buttonOk);

			// Assert:
			expect(onCloseMock).toHaveBeenCalled();
		});

		it('does not show the dialog when bridges are available', async () => {
			// Arrange:
			setupMocks();

			const screenTester = new ScreenTester(BridgeSwap, createDefaultProps());

			// Act & Assert:
			screenTester.notExpectText([
				SCREEN_TEXT.textDialogDisabledTitle,
				SCREEN_TEXT.textDialogDisabledText
			]);
		});
	});

	describe('history item press', () => {
		it('navigates to swap details when history item is pressed', async () => {
			// Arrange:
			const { Router } = require('@/app/router/Router');

			setupMocks({
				useBridgeHistory: {
					history: [historyItem]
				}
			});

			const screenTester = new ScreenTester(BridgeSwap, createDefaultProps());

			// Act:
			screenTester.pressButton(SCREEN_TEXT.textSwapAction);

			// Assert:
			expect(Router.goToBridgeSwapDetails).toHaveBeenCalledWith({
				params: {
					bridgeId: BRIDGE_ID_XYM_TO_BXYM,
					requestTransactionHash: HISTORY_ITEM_TRANSACTION_HASH,
					preloadedData: historyItem
				}
			});
		});
	});
});

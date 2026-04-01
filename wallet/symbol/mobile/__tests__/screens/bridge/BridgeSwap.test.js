import { BridgeSwap } from '@/app/screens/bridge/BridgeSwap';
import { BridgeMode, BridgePairsStatus, BridgeRequestStatus } from '@/app/screens/bridge/types/Bridge';
import { AccountFixtureBuilder } from '__fixtures__/local/AccountFixtureBuilder';
import { NetworkPropertiesFixtureBuilder } from '__fixtures__/local/NetworkPropertiesFixtureBuilder';
import { TokenFixtureBuilder } from '__fixtures__/local/TokenFixtureBuilder';
import { TransactionFeeFixtureBuilder } from '__fixtures__/local/TransactionFeeFixtureBuilder';
import { ScreenTester } from '__tests__/ScreenTester';
import { createWalletControllerMock, mockLocalization, mockPasscode, mockRouter } from '__tests__/mock-helpers';
import { TransactionBundle } from 'wallet-common-core'; // eslint-disable-line import/order

// Mocks

jest.mock('@react-navigation/native', () => ({
	...jest.requireActual('@react-navigation/native'),
	useIsFocused: () => true,
	useFocusEffect: callback => {
		callback();
	},
	useNavigation: () => ({
		navigate: jest.fn(),
		goBack: jest.fn()
	})
}));

jest.mock('@/app/screens/bridge/hooks', () => ({
	useBridge: jest.fn(),
	useBridgeAmount: jest.fn(),
	useBridgeHistory: jest.fn(),
	useBridgeNoPairsDialog: jest.fn(),
	useBridgeTransaction: jest.fn(),
	useEstimation: jest.fn(),
	useSwapSelector: jest.fn()
}));

jest.mock('@/app/hooks', () => {
	const original = jest.requireActual('@/app/hooks');
	return {
		...original,
		useTransactionFees: jest.fn(() => ({
			data: null,
			isLoading: false,
			call: jest.fn()
		})),
		useWalletController: jest.fn()
	};
});

// Constants

const CHAIN_NAME_SYMBOL = 'symbol';
const CHAIN_NAME_ETHEREUM = 'ethereum';
const NETWORK_IDENTIFIER = 'testnet';
const BRIDGE_ID_XYM_TO_WXYM = 'symbol-xym-ethereum-wxym';
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
	textDialogConfirmTitle: 's_bridge_swap_dialog_confirm_title',
	textDialogConfirmText: 's_bridge_swap_dialog_confirm_text',

	// Buttons
	buttonSend: 'button_send',
	buttonConfirm: 'button_confirm',
	buttonCancel: 'button_cancel',

	// Accessibility Labels
	labelSelectSourceToken: 'Select source token',
	labelSelectTargetToken: 'Select target token',
	inputAmountLabel: 'form_transfer_input_amount',

	// History item
	textSwapAction: 'transactionDescriptor_swap',

	// Token Display Names
	displayNameTokenXym: 'Symbol • XYM',
	displayNameTokenWxym: 'Wrapped XYM • wXYM',
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

const tokenWxym = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME_ETHEREUM, NETWORK_IDENTIFIER, 1)
	.setAmount('500')
	.build();

const tokenWxymPayout = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME_ETHEREUM, NETWORK_IDENTIFIER, 1)
	.setAmount(PAYOUT_AMOUNT)
	.build();

const tokenEth = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME_ETHEREUM, NETWORK_IDENTIFIER, 0)
	.setAmount('2000')
	.build();

// Wallet Controller Fixtures

const symbolWalletController = createWalletControllerMock({
	chainName: CHAIN_NAME_SYMBOL,
	networkIdentifier: NETWORK_IDENTIFIER,
	networkProperties: symbolNetworkProperties,
	currentAccount: symbolAccount,
	modules: {
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
		bridge: {
			createTransaction: jest.fn().mockResolvedValue({})
		}
	}
});

// Bridge Fixtures

const bridgeMock = {
	id: BRIDGE_ID_XYM_TO_WXYM,
	isReady: true,
	estimateRequest: jest.fn().mockResolvedValue({
		bridgeFee: '1',
		receiveAmount: PAYOUT_AMOUNT
	}),
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

const swapSideEthereumWxym = {
	token: tokenWxym,
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

const swapPairXymToWxym = {
	source: swapSideSymbolXym,
	target: swapSideEthereumWxym,
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

const allPairs = [swapPairXymToWxym, swapPairXymToEth];

// History Fixtures

const historyItem = {
	requestTransaction: {
		hash: HISTORY_ITEM_TRANSACTION_HASH,
		timestamp: 1684265310994
	},
	sourceChainName: CHAIN_NAME_SYMBOL,
	targetChainName: CHAIN_NAME_ETHEREUM,
	sourceTokenInfo: tokenXym,
	targetTokenInfo: tokenWxym,
	payoutTransaction: {
		token: tokenWxymPayout
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

const { useTransactionFees, useWalletController } = require('@/app/hooks');
const {
	useBridge,
	useBridgeAmount,
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
	target: swapSideEthereumWxym,
	sourceList: [swapSideSymbolXym, swapSideEthereumEth],
	targetList: [swapSideEthereumWxym, swapSideEthereumEth],
	changeSource: jest.fn(),
	changeTarget: jest.fn(),
	reverse: jest.fn(),
	...overrides
});

const createUseBridgeAmountMock = (overrides = {}) => ({
	amount: '0',
	isAmountValid: true,
	availableBalance: '1000',
	changeAmount: jest.fn(),
	changeAmountValidity: jest.fn(),
	reset: jest.fn(),
	...overrides
});

const createUseBridgeTransactionMock = (overrides = {}) => ({
	createTransaction: jest.fn().mockResolvedValue(transactionBundle),
	getTransactionPreviewTable: jest.fn().mockReturnValue([]),
	...overrides
});

const createUseEstimationMock = (overrides = {}) => ({
	estimation: null,
	estimate: jest.fn(),
	clearEstimation: jest.fn(),
	isLoading: false,
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

const createUseTransactionFeesMock = (overrides = {}) => ({
	data: null,
	isLoading: false,
	call: jest.fn(),
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
	useTransactionFees.mockReturnValue(createUseTransactionFeesMock(config.useTransactionFees));
	useWalletController.mockReturnValue(walletController);
	
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
			
			setupMocks({
				walletController,
				useSwapSelector: {
					isReady: true,
					source: swapSideSymbolXym,
					target: swapSideEthereumWxym,
					sourceList: [swapSideSymbolXym, swapSideEthereumEth],
					targetList: [swapSideEthereumWxym, swapSideEthereumEth],
					changeSource: changeSourceMock,
					changeTarget: changeTargetMock
				},
				useBridgeAmount: {
					amount: '100',
					isAmountValid: true,
					availableBalance: '1000'
				},
				useBridgeTransaction: {
					createTransaction: createTransactionMock
				},
				useEstimation: {
					estimation: estimationResult,
					isLoading: false
				},
				useTransactionFees: {
					data: transactionFeeTiers,
					isLoading: false
				}
			});
			mockPasscode();

			const screenTester = new ScreenTester(BridgeSwap, createDefaultProps());

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
					bridgeId: BRIDGE_ID_XYM_TO_WXYM,
					requestTransactionHash: HISTORY_ITEM_TRANSACTION_HASH,
					preloadedData: historyItem
				}
			});
		});
	});
});

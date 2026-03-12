import { BridgeSwapDetails } from '@/app/screens/bridge/BridgeSwapDetails';
import { BridgePayoutStatus, BridgeRequestStatus } from '@/app/screens/bridge/types/Bridge';
import { formatDate } from '@/app/utils';
import { AccountFixtureBuilder } from '__fixtures__/local/AccountFixtureBuilder';
import { NetworkPropertiesFixtureBuilder } from '__fixtures__/local/NetworkPropertiesFixtureBuilder';
import { TokenFixtureBuilder } from '__fixtures__/local/TokenFixtureBuilder';
import { ScreenTester } from '__tests__/ScreenTester';
import { createWalletControllerMock, mockLink, mockLocalization, mockWalletController } from '__tests__/mock-helpers';

// Constants

const CHAIN_NAME_SYMBOL = 'symbol';
const CHAIN_NAME_ETHEREUM = 'ethereum';
const NETWORK_IDENTIFIER = 'testnet';
const BRIDGE_ID = 'symbol-xym-ethereum-wxym';

const REQUEST_TRANSACTION_HASH = 'ABC123DEF456789REQUEST';
const PAYOUT_TRANSACTION_HASH = '0xPAYOUT789ABC123DEF';
const REQUEST_TIMESTAMP = 1684265310994;
const PAYOUT_TIMESTAMP = 1684351710994;
const ERROR_MESSAGE = 'Bridge processing error';
const REQUEST_TIMESTAMP_TEXT = formatDate(REQUEST_TIMESTAMP, key => key, true);
const PAYOUT_TIMESTAMP_TEXT = formatDate(PAYOUT_TIMESTAMP, key => key, true);

// Screen Text

const SCREEN_TEXT = {
	// Status
	textStatusCompleted: 's_bridge_history_status_completed',
	textStatusProcessing: 's_bridge_history_status_processing',
	textStatusFailed: 's_bridge_history_status_failed',

	// Titles
	textTokenSendTitle: 's_bridge_swapDetails_tokenSend_title',
	textTokenReceiveTitle: 's_bridge_swapDetails_tokenReceive_title',
	textStatusTrackingTitle: 's_bridge_swapDetails_statusTracking_title',

	// Field titles
	textFieldChainName: 'fieldTitle_chainName',
	textFieldSenderAddress: 'fieldTitle_senderAddress',
	textFieldRecipientAddress: 'fieldTitle_recipientAddress',
	textFieldTransactionHash: 'fieldTitle_transactionHash',

	// N/A placeholder
	textNotAvailable: 'data_v_na',

	// Activity log steps
	textStepRequestSend: 's_bridge_swapStatus_step_requestSend',
	textStepAwaitingBridge: 's_bridge_swapStatus_step_awaitingBridge',
	textStepPayoutSend: 's_bridge_swapStatus_step_payoutSend',
	textStepPayoutConfirmation: 's_bridge_swapStatus_step_payoutConfirmation',

	// Buttons
	buttonOpenExplorer: 'button_openTransactionInExplorer'
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
	.setAmount('100')
	.build();

const tokenWxym = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME_ETHEREUM, NETWORK_IDENTIFIER, 1)
	.setAmount('99')
	.build();

// Wallet Controller Fixtures

const symbolWalletController = createWalletControllerMock({
	chainName: CHAIN_NAME_SYMBOL,
	networkIdentifier: NETWORK_IDENTIFIER,
	networkProperties: symbolNetworkProperties,
	currentAccount: symbolAccount
});

const ethereumWalletController = createWalletControllerMock({
	chainName: CHAIN_NAME_ETHEREUM,
	networkIdentifier: NETWORK_IDENTIFIER,
	networkProperties: ethereumNetworkProperties,
	currentAccount: ethereumAccount
});

// Bridge Request Fixtures

const createBridgeRequestData = (overrides = {}) => ({
	sourceChainName: CHAIN_NAME_SYMBOL,
	targetChainName: CHAIN_NAME_ETHEREUM,
	sourceTokenInfo: tokenXym,
	targetTokenInfo: tokenWxym,
	requestStatus: BridgeRequestStatus.CONFIRMED,
	payoutStatus: BridgePayoutStatus.COMPLETED,
	requestTransaction: {
		hash: REQUEST_TRANSACTION_HASH,
		timestamp: REQUEST_TIMESTAMP,
		signerAddress: symbolAccount.address,
		token: { amount: '100' }
	},
	payoutTransaction: {
		hash: PAYOUT_TRANSACTION_HASH,
		timestamp: PAYOUT_TIMESTAMP,
		recipientAddress: ethereumAccount.address,
		token: { amount: '99' }
	},
	errorMessage: null,
	...overrides
});

const bridgeRequestCompleted = createBridgeRequestData();

const bridgeRequestOnlyRequest = createBridgeRequestData({
	payoutStatus: BridgePayoutStatus.UNPROCESSED,
	payoutTransaction: null
});

const bridgeRequestWithError = createBridgeRequestData({
	requestStatus: BridgeRequestStatus.ERROR,
	payoutStatus: BridgePayoutStatus.FAILED,
	payoutTransaction: null,
	errorMessage: ERROR_MESSAGE
});

// Bridge Mock

const bridgeMock = {
	id: BRIDGE_ID,
	nativeWalletController: symbolWalletController,
	wrappedWalletController: ethereumWalletController
};

// Route Props Factory

const createRouteProps = preloadedData => ({
	route: {
		params: {
			bridgeId: BRIDGE_ID,
			preloadedData
		}
	}
});

// Setup

const setupBridgeMock = () => {
	const controllers = require('@/app/lib/controller');
	controllers.bridges = [bridgeMock];
};

describe('screens/bridge/BridgeSwapDetails', () => {
	beforeEach(() => {
		setupBridgeMock();
		mockWalletController();
		mockLocalization();
		mockLink();
	});

	describe('render', () => {
		it('renders basic screen text with completed status', () => {
			// Arrange:
			const props = createRouteProps(bridgeRequestCompleted);
			const expectedTexts = [
				SCREEN_TEXT.textStatusCompleted,
				SCREEN_TEXT.textTokenSendTitle,
				SCREEN_TEXT.textTokenReceiveTitle,
				SCREEN_TEXT.textStatusTrackingTitle
			];

			// Act:
			const screenTester = new ScreenTester(BridgeSwapDetails, props);

			// Assert:
			screenTester.expectText(expectedTexts);
		});
	});

	describe('swap details', () => {
		const runSwapDetailsTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const props = createRouteProps(config.bridgeRequest);

				// Act:
				const screenTester = new ScreenTester(BridgeSwapDetails, props);

				// Assert:
				screenTester.expectText(expected.visibleTexts, true);

				if (expected.notVisibleTexts?.length)
					screenTester.notExpectText(expected.notVisibleTexts);
			});
		};

		const swapDetailsTests = [
			{
				description: 'renders swap details with request and payout transactions',
				config: {
					bridgeRequest: bridgeRequestCompleted
				},
				expected: {
					visibleTexts: [
						// Source side
						CHAIN_NAME_SYMBOL,
						symbolAccount.address,
						REQUEST_TRANSACTION_HASH,
						// Target side
						CHAIN_NAME_ETHEREUM,
						ethereumAccount.address,
						PAYOUT_TRANSACTION_HASH
					],
					notVisibleTexts: []
				}
			},
			{
				description: 'renders swap details with only request transaction (no payout yet)',
				config: {
					bridgeRequest: bridgeRequestOnlyRequest
				},
				expected: {
					visibleTexts: [
						// Source side
						CHAIN_NAME_SYMBOL,
						symbolAccount.address,
						REQUEST_TRANSACTION_HASH,
						// Target side chain name visible
						CHAIN_NAME_ETHEREUM
					],
					notVisibleTexts: [
						PAYOUT_TRANSACTION_HASH,
						ethereumAccount.address
					]
				}
			}
		];

		swapDetailsTests.forEach(test => {
			runSwapDetailsTest(test.description, test.config, test.expected);
		});
	});

	describe('explorer links', () => {
		const runExplorerLinkTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const openLinkMock = mockLink();
				const props = createRouteProps(bridgeRequestCompleted);
				const screenTester = new ScreenTester(BridgeSwapDetails, props);

				// Act:
				screenTester.pressButton(SCREEN_TEXT.buttonOpenExplorer, config.linkIndex);

				// Assert:
				expect(openLinkMock).toHaveBeenCalledWith(expected.url);
			});
		};

		const explorerLinkTests = [
			{
				description: 'opens request transaction explorer when press first link',
				config: { linkIndex: 0 },
				expected: { url: `https://testnet.symbol.fyi/transactions/${REQUEST_TRANSACTION_HASH}` }
			},
			{
				description: 'opens payout transaction explorer when press second link',
				config: { linkIndex: 1 },
				expected: { url: `http://otterscan.symboltest.net/tx/${PAYOUT_TRANSACTION_HASH}` }
			}
		];

		explorerLinkTests.forEach(test => 
			runExplorerLinkTest(test.description, test.config, test.expected));
	});

	describe('status tracking', () => {
		const runStatusTrackingTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const props = createRouteProps(config.bridgeRequest);

				// Act:
				const screenTester = new ScreenTester(BridgeSwapDetails, props);

				// Assert:
				screenTester.expectText(expected.visibleTexts, true);

				if (expected.notVisibleTexts?.length)
					screenTester.notExpectText(expected.notVisibleTexts);
			});
		};

		const statusTrackingTests = [
			{
				description: 'displays request date in activity log',
				config: {
					bridgeRequest: bridgeRequestOnlyRequest
				},
				expected: {
					visibleTexts: [
						SCREEN_TEXT.textStepRequestSend,
						SCREEN_TEXT.textStepAwaitingBridge,
						SCREEN_TEXT.textStepPayoutSend,
						SCREEN_TEXT.textStepPayoutConfirmation,
						// Request timestamp formatted with time
						REQUEST_TIMESTAMP_TEXT
					],
					notVisibleTexts: []
				}
			},
			{
				description: 'displays error message in activity log when bridge fails',
				config: {
					bridgeRequest: bridgeRequestWithError
				},
				expected: {
					visibleTexts: [
						SCREEN_TEXT.textStepRequestSend,
						SCREEN_TEXT.textStepAwaitingBridge,
						ERROR_MESSAGE
					],
					notVisibleTexts: []
				}
			},
			{
				description: 'displays both request and payout dates when completed',
				config: {
					bridgeRequest: bridgeRequestCompleted
				},
				expected: {
					visibleTexts: [
						SCREEN_TEXT.textStepRequestSend,
						SCREEN_TEXT.textStepAwaitingBridge,
						SCREEN_TEXT.textStepPayoutSend,
						SCREEN_TEXT.textStepPayoutConfirmation,
						// Request timestamp with time
						REQUEST_TIMESTAMP_TEXT,
						// Payout timestamp with time
						PAYOUT_TIMESTAMP_TEXT
					],
					notVisibleTexts: []
				}
			}
		];

		statusTrackingTests.forEach(test => {
			runStatusTrackingTest(test.description, test.config, test.expected);
		});
	});
});

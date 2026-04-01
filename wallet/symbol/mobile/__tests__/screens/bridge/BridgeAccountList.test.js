import { BridgeAccountList } from '@/app/screens/bridge/BridgeAccountList';
import * as bridgeUtils from '@/app/screens/bridge/utils';
import { AccountFixtureBuilder } from '__fixtures__/local/AccountFixtureBuilder';
import { ScreenTester } from '__tests__/ScreenTester';
import { mockLocalization } from '__tests__/mock-helpers';

// Mocks

const mockUseBridgeAccounts = jest.fn();

jest.mock('@/app/screens/bridge/hooks', () => ({
	useBridgeAccounts: () => mockUseBridgeAccounts()
}));

jest.mock('@/app/screens/bridge/utils', () => ({
	generateFromMnemonic: jest.fn()
}));

// Constants

const ChainName = {
	SYMBOL: 'symbol',
	ETHEREUM: 'ethereum'
};

const NetworkIdentifier = {
	TESTNET: 'testnet'
};

const Ticker = {
	SYMBOL: 'XYM',
	ETHEREUM: 'ETH'
};

const BALANCE_SYMBOL = '1000';
const BALANCE_ETHEREUM = '500';
const BALANCE_ZERO = '0';

// Screen Text

const SCREEN_TEXT = {
	// Card titles
	textFieldAccount: 'c_accountCard_title_account',
	textFieldBalance: 'c_accountCard_title_balance',
	textFieldAddress: 'c_accountCard_title_address',

	// Buttons
	buttonActivate: 'button_activateAccount'
};

// Account Fixtures

const symbolAccount = AccountFixtureBuilder
	.createWithAccount(ChainName.SYMBOL, NetworkIdentifier.TESTNET, 0)
	.build();

const ethereumAccount = AccountFixtureBuilder
	.createWithAccount(ChainName.ETHEREUM, NetworkIdentifier.TESTNET, 0)
	.build();

// Bridge Account Data Fixtures

const bridgeAccountSymbolActive = {
	chainName: ChainName.SYMBOL,
	ticker: Ticker.SYMBOL,
	isActive: true,
	account: symbolAccount,
	balance: BALANCE_SYMBOL,
	tokens: [],
	isAccountInfoLoaded: true
};

const bridgeAccountEthereumActive = {
	chainName: ChainName.ETHEREUM,
	ticker: Ticker.ETHEREUM,
	isActive: true,
	account: ethereumAccount,
	balance: BALANCE_ETHEREUM,
	tokens: [],
	isAccountInfoLoaded: true
};

const bridgeAccountEthereumInactive = {
	chainName: ChainName.ETHEREUM,
	ticker: Ticker.ETHEREUM,
	isActive: false,
	account: null,
	balance: BALANCE_ZERO,
	tokens: [],
	isAccountInfoLoaded: false
};

// Test Helpers

const mockBridgeAccounts = (accounts, refresh = jest.fn()) => {
	mockUseBridgeAccounts.mockReturnValue({
		accounts,
		refresh
	});
};

describe('screens/bridge/BridgeAccountList', () => {
	beforeEach(() => {
		mockLocalization();
		jest.clearAllMocks();
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
	});

	describe('render', () => {
		const runRenderAccountsTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				mockBridgeAccounts(config.accounts);

				// Act:
				const screenTester = new ScreenTester(BridgeAccountList);

				// Assert:
				screenTester.expectText(expected.visibleTexts);

				if (expected.hiddenTexts)
					screenTester.notExpectText(expected.hiddenTexts);
			});
		};

		const renderTests = [
			{
				description: 'renders inactive account card with activate button',
				config: {
					accounts: [bridgeAccountEthereumInactive]
				},
				expected: {
					visibleTexts: [
						SCREEN_TEXT.textFieldAccount,
						ChainName.ETHEREUM,
						SCREEN_TEXT.textFieldBalance,
						SCREEN_TEXT.buttonActivate
					],
					hiddenTexts: [
						SCREEN_TEXT.textFieldAddress
					]
				}
			},
			{
				description: 'renders active account card with address and balance',
				config: {
					accounts: [bridgeAccountEthereumActive]
				},
				expected: {
					visibleTexts: [
						SCREEN_TEXT.textFieldAccount,
						ChainName.ETHEREUM,
						SCREEN_TEXT.textFieldBalance,
						BALANCE_ETHEREUM,
						SCREEN_TEXT.textFieldAddress,
						ethereumAccount.address
					],
					hiddenTexts: [
						SCREEN_TEXT.buttonActivate
					]
				}
			},
			{
				description: 'renders multiple account cards',
				config: {
					accounts: [bridgeAccountSymbolActive, bridgeAccountEthereumInactive]
				},
				expected: {
					visibleTexts: [
						// Symbol account (active)
						ChainName.SYMBOL,
						symbolAccount.address,
						BALANCE_SYMBOL,
						// Ethereum account (inactive)
						ChainName.ETHEREUM,
						SCREEN_TEXT.buttonActivate
					]
				}
			}
		];

		renderTests.forEach(test => {
			runRenderAccountsTest(test.description, test.config, test.expected);
		});
	});

	describe('activation', () => {
		it('calls generateFromMnemonic and refresh when activate button is pressed', async () => {
			// Arrange:
			const refreshMock = jest.fn();
			const generateFromMnemonicMock = jest
				.spyOn(bridgeUtils, 'generateFromMnemonic')
				.mockResolvedValue();
			mockBridgeAccounts([bridgeAccountEthereumInactive], refreshMock);
			const screenTester = new ScreenTester(BridgeAccountList);

			// Act:
			screenTester.pressButton(SCREEN_TEXT.buttonActivate);
			await screenTester.waitForTimer();

			// Assert:
			expect(generateFromMnemonicMock).toHaveBeenCalledWith(ChainName.ETHEREUM);
			expect(refreshMock).toHaveBeenCalledTimes(1);
		});
	});
});

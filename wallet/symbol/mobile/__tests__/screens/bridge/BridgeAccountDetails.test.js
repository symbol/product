import { BridgeAccountDetails } from '@/app/screens/bridge/BridgeAccountDetails';
import { AccountFixtureBuilder } from '__fixtures__/local/AccountFixtureBuilder';
import { AccountInfoFixtureBuilder } from '__fixtures__/local/AccountInfoFixtureBuilder';
import { NetworkPropertiesFixtureBuilder } from '__fixtures__/local/NetworkPropertiesFixtureBuilder';
import { TokenFixtureBuilder } from '__fixtures__/local/TokenFixtureBuilder';
import { ScreenTester } from '__tests__/ScreenTester';
import { mockLink, mockLocalization, mockPasscode, mockRouter, mockWalletController } from '__tests__/mock-helpers';

// Mocks
jest.mock('@react-navigation/native', () => ({
	...jest.requireActual('@react-navigation/native'),
	useIsFocused: () => true
}));

// Constants

const CHAIN_NAME = 'ethereum';
const NETWORK_IDENTIFIER = 'testnet';
const MOCK_PRIVATE_KEY = 'mockPrivateKey123456789';
const TOKEN_ETH_AMOUNT = '2.5';
const TOKEN_WXYM_AMOUNT = '1000';

// Screen Text

const SCREEN_TEXT = {
	// Field titles
	textFieldChainName: 'fieldTitle_chainName',
	textFieldAddress: 'fieldTitle_address',

	// Section titles
	textTokensTitle: 's_bridge_tokens_title',

	// Token display names
	displayNameTokenWxym: 'Wrapped XYM • wXYM',
	displayNameTokenEth: 'Ether • ETH',

	// Buttons
	buttonSendTransaction: 'button_send',
	buttonOpenExplorer: 'button_openTransactionInExplorer',
	buttonRevealPrivateKey: 'button_revealPrivateKey',
	buttonRemoveAccount: 'button_removeAccount',
	buttonConfirm: 'button_confirm',

	// Dialogs
	dialogSensitiveTitle: 'dialog_sensitive',
	dialogRemoveAccountTitle: 'dialog_removeAccount_title',
	dialogRemoveAccountBody: 'dialog_removeAccount_body'
};

// Account Fixtures

const ethereumAccount = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.build();

// Network Properties Fixtures

const ethereumNetworkProperties = NetworkPropertiesFixtureBuilder
	.createWithType(CHAIN_NAME, NETWORK_IDENTIFIER)
	.build();

// Token Fixtures

const tokenEth = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.setAmount(TOKEN_ETH_AMOUNT)
	.build();

const tokenWxym = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME, NETWORK_IDENTIFIER, 1)
	.setAmount(TOKEN_WXYM_AMOUNT)
	.build();

// Account Info Fixtures

const accountInfoWithTokens = AccountInfoFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.setTokens([tokenEth, tokenWxym])
	.build();

// Wallet Controller Mock Factory

const mockWalletControllerConfigured = (overrides = {}) => {
	return mockWalletController({
		chainName: CHAIN_NAME,
		networkIdentifier: NETWORK_IDENTIFIER,
		networkProperties: ethereumNetworkProperties,
		currentAccount: ethereumAccount,
		currentAccountInfo: overrides.currentAccountInfo ?? null,
		getCurrentAccountPrivateKey: jest.fn().mockResolvedValue(MOCK_PRIVATE_KEY),
		fetchAccountInfo: jest.fn().mockResolvedValue({}),
		clear: jest.fn(),
		...overrides
	});
};

// Route Props Factory

const createRouteProps = () => ({
	route: {
		params: {
			chainName: CHAIN_NAME
		}
	}
});

describe('screens/bridge/BridgeAccountDetails', () => {
	beforeEach(() => {
		mockLocalization();
		mockLink();
		jest.clearAllMocks();
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
	});

	describe('render', () => {
		it('renders main account info with chain name and address', () => {
			// Arrange:
			mockWalletControllerConfigured();
			const expectedTexts = [
				SCREEN_TEXT.textFieldChainName,
				CHAIN_NAME,
				SCREEN_TEXT.textFieldAddress,
				ethereumAccount.address
			];

			// Act:
			const screenTester = new ScreenTester(BridgeAccountDetails, createRouteProps());

			// Assert:
			screenTester.expectText(expectedTexts);
		});

		it('renders token list when account info has tokens', () => {
			// Arrange:
			mockWalletControllerConfigured({
				currentAccountInfo: accountInfoWithTokens
			});

			// Act:
			const screenTester = new ScreenTester(BridgeAccountDetails, createRouteProps());

			// Assert:
			screenTester.expectText([
				SCREEN_TEXT.textTokensTitle,
				SCREEN_TEXT.displayNameTokenEth,
				SCREEN_TEXT.displayNameTokenWxym,
				TOKEN_WXYM_AMOUNT
			]);
		});

		it('navigates to token details when token is pressed', () => {
			// Arrange:
			mockWalletControllerConfigured({
				currentAccountInfo: accountInfoWithTokens
			});
			const routerMock = mockRouter({
				goToTokenDetails: jest.fn()
			});
			const screenTester = new ScreenTester(BridgeAccountDetails, createRouteProps());

			// Act:
			screenTester.pressButton(SCREEN_TEXT.displayNameTokenEth);

			// Assert:
			expect(routerMock.goToTokenDetails).toHaveBeenCalledWith({
				params: {
					chainName: CHAIN_NAME,
					tokenId: tokenEth.id,
					preloadedData: tokenEth
				}
			});
		});
	});

	describe('buttons', () => {
		it('opens send screen when button is pressed', () => {
			// Arrange:
			mockWalletControllerConfigured();
			const routerMock = mockRouter({
				goToSend: jest.fn()
			});
			const screenTester = new ScreenTester(BridgeAccountDetails, createRouteProps());

			// Act:
			screenTester.pressButton(SCREEN_TEXT.buttonSendTransaction);

			// Assert:
			expect(routerMock.goToSend).toHaveBeenCalledWith({
				params: { chainName: CHAIN_NAME }
			});
		});

		it('opens block explorer when button is pressed', () => {
			// Arrange:
			const openLinkMock = mockLink();
			mockWalletControllerConfigured();
			const screenTester = new ScreenTester(BridgeAccountDetails, createRouteProps());
			const expectedUrl = `http://otterscan.symboltest.net/address/${ethereumAccount.address}`;

			// Act:
			screenTester.pressButton(SCREEN_TEXT.buttonOpenExplorer);

			// Assert:
			expect(openLinkMock).toHaveBeenCalledWith(expectedUrl);
		});

		it('reveals private key when button is pressed', async () => {
			// Arrange:
			const walletControllerMock = mockWalletControllerConfigured();
			mockPasscode();
			const screenTester = new ScreenTester(BridgeAccountDetails, createRouteProps());

			// Act:
			screenTester.pressButton(SCREEN_TEXT.buttonRevealPrivateKey);
			await screenTester.waitForTimer();

			// Assert:
			expect(walletControllerMock.getCurrentAccountPrivateKey).toHaveBeenCalled();
			screenTester.expectText([MOCK_PRIVATE_KEY, SCREEN_TEXT.dialogSensitiveTitle]);
		});

		it('removes account and navigates back when button is pressed', async () => {
			// Arrange:
			const walletControllerMock = mockWalletControllerConfigured();
			const routerMock = mockRouter();
			const screenTester = new ScreenTester(BridgeAccountDetails, createRouteProps());

			// Act:
			screenTester.pressButton(SCREEN_TEXT.buttonRemoveAccount);
			screenTester.expectText([SCREEN_TEXT.dialogRemoveAccountTitle]);
			screenTester.pressButton(SCREEN_TEXT.buttonConfirm);

			// Assert:
			expect(routerMock.goBack).toHaveBeenCalled();
			expect(walletControllerMock.clear).toHaveBeenCalled();
		});
	});
});

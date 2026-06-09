import { walletControllers } from '@/app/lib/controller';
import { Assets } from '@/app/screens/assets/Assets';
import { AccountFixtureBuilder } from '__fixtures__/local/AccountFixtureBuilder';
import { AccountInfoFixtureBuilder } from '__fixtures__/local/AccountInfoFixtureBuilder';
import { NetworkPropertiesFixtureBuilder } from '__fixtures__/local/NetworkPropertiesFixtureBuilder';
import { TokenFixtureBuilder } from '__fixtures__/local/TokenFixtureBuilder';
import { ScreenTester } from '__tests__/ScreenTester';
import { mockLocalization, mockOs } from '__tests__/mock-helpers';
import { act } from '@testing-library/react-native';
import { constants } from 'wallet-common-core';

const { ControllerEventName } = constants;

// Mocks

jest.mock('@react-navigation/native', () => ({
	...jest.requireActual('@react-navigation/native'),
	useIsFocused: () => true,
	useNavigation: () => ({
		navigate: jest.fn(),
		goBack: jest.fn()
	})
}));

jest.mock('@/app/lib/controller', () => ({
	walletControllers: {
		main: {},
		additional: []
	}
}));

// Constants

const CHAIN_NAME_SYMBOL = 'symbol';
const CHAIN_NAME_ETHEREUM = 'ethereum';
const NETWORK_IDENTIFIER = 'testnet';
const CHAIN_HEIGHT = 150_000;

// Screen Text

const SCREEN_TEXT = {
	textFilterExpired: 's_assets_filter_expired',
	textFilterCreated: 's_assets_filter_created',
	buttonClear: 'button_clear',
	textEmptyList: 'message_emptyList',
	textSectionCurrentAccount: 's_assets_section_currentAccount',
	textSectionBridgeAccounts: 's_assets_section_bridgeAccounts',
	textSectionMultisigAccounts: 's_assets_section_multisigAccounts'
};

// Account Fixtures

const symbolMainAccount = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME_SYMBOL, NETWORK_IDENTIFIER, 0)
	.build();

const symbolExternalAccount = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME_SYMBOL, NETWORK_IDENTIFIER, 1)
	.build();

const symbolMultisigAccount = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME_SYMBOL, NETWORK_IDENTIFIER, 2)
	.build();

const ethereumMainAccount = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME_ETHEREUM, NETWORK_IDENTIFIER, 0)
	.build();

// Network Properties Fixtures

const networkPropertiesSymbol = NetworkPropertiesFixtureBuilder
	.createWithType(CHAIN_NAME_SYMBOL, NETWORK_IDENTIFIER)
	.setChainHeight(CHAIN_HEIGHT)
	.build();

const networkPropertiesEthereum = NetworkPropertiesFixtureBuilder
	.createWithData({
		networkIdentifier: NETWORK_IDENTIFIER,
		chainHeight: 50_000,
		blockGenerationTargetTime: 12,
		networkCurrency: { name: 'eth', id: 'ETH', divisibility: 18 }
	})
	.build();

// Token Fixtures

const tokenSymbolCreatedActive = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME_SYMBOL, NETWORK_IDENTIFIER, 1)
	.setId('SYMBOL_TOKEN_ACTIVE_1')
	.setName('Symbol Created Active')
	.setAmount('100')
	.setStartHeight(100_000)
	.setEndHeight(250_000)
	.setIsUnlimitedDuration(false)
	.setCreator(symbolMainAccount.address)
	.build();

const tokenSymbolExternalActive = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME_SYMBOL, NETWORK_IDENTIFIER, 2)
	.setId('SYMBOL_TOKEN_ACTIVE_2')
	.setName('Symbol External Active')
	.setAmount('200')
	.setStartHeight(100_000)
	.setEndHeight(250_000)
	.setIsUnlimitedDuration(false)
	.setCreator(symbolExternalAccount.address)
	.build();

const tokenSymbolCreatedExpired = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME_SYMBOL, NETWORK_IDENTIFIER, 3)
	.setId('SYMBOL_TOKEN_EXPIRED')
	.setName('Symbol Created Expired')
	.setAmount('300')
	.setStartHeight(100_000)
	.setEndHeight(120_000)
	.setIsUnlimitedDuration(false)
	.setCreator(symbolMainAccount.address)
	.build();

const tokenEthereumActive = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME_ETHEREUM, NETWORK_IDENTIFIER, 1)
	.setId('ETH_TOKEN_ACTIVE_1')
	.setName('Ethereum Active')
	.setAmount('400')
	.setStartHeight(10_000)
	.setEndHeight(90_000)
	.setIsUnlimitedDuration(false)
	.setCreator(ethereumMainAccount.address)
	.build();

const tokenSymbolMultisigActive = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME_SYMBOL, NETWORK_IDENTIFIER, 1)
	.setId('SYMBOL_TOKEN_MULTISIG_1')
	.setName('Symbol Multisig Active')
	.setAmount('500')
	.setStartHeight(100_000)
	.setEndHeight(250_000)
	.setIsUnlimitedDuration(false)
	.setCreator(symbolMultisigAccount.address)
	.build();

// Account Info Fixtures

const accountInfoSymbolWithTokens = AccountInfoFixtureBuilder
	.createWithAccount(CHAIN_NAME_SYMBOL, NETWORK_IDENTIFIER, 0)
	.setMosaics([tokenSymbolCreatedActive, tokenSymbolExternalActive, tokenSymbolCreatedExpired])
	.build();

const accountInfoEthereumWithTokens = AccountInfoFixtureBuilder
	.createWithAccount(CHAIN_NAME_ETHEREUM, NETWORK_IDENTIFIER, 0)
	.setTokens([tokenEthereumActive])
	.build();

const accountInfoEmpty = AccountInfoFixtureBuilder
	.createWithAccount(CHAIN_NAME_SYMBOL, NETWORK_IDENTIFIER, 0)
	.setMosaics([])
	.build();

// Event Handlers Store

const createEventHandlersStore = () => {
	const handlersByEvent = new Map();

	return {
		addHandler: (eventName, handler) => {
			const handlers = handlersByEvent.get(eventName) ?? new Set();
			handlers.add(handler);
			handlersByEvent.set(eventName, handlers);
		},
		removeHandler: (eventName, handler) => {
			handlersByEvent.get(eventName)?.delete(handler);
		},
		emit: eventName => {
			handlersByEvent.get(eventName)?.forEach(handler => handler());
		}
	};
};

// Wallet Controller Mock Factory

const createWalletControllerMock = config => {
	const events = createEventHandlersStore();

	return {
		chainName: config.chainName,
		networkIdentifier: config.networkIdentifier ?? NETWORK_IDENTIFIER,
		ticker: config.chainName === CHAIN_NAME_SYMBOL ? 'XYM' : 'ETH',
		accounts: { mainnet: [], testnet: config.currentAccount ? [config.currentAccount] : [] },
		currentAccount: config.currentAccount ?? null,
		currentAccountInfo: config.currentAccountInfo ?? accountInfoEmpty,
		networkProperties: config.networkProperties ?? networkPropertiesSymbol,
		isWalletReady: config.isWalletReady ?? true,
		fetchAccountInfo: jest.fn().mockResolvedValue(undefined),
		on: jest.fn((eventName, callback) => events.addHandler(eventName, callback)),
		removeListener: jest.fn((eventName, callback) => events.removeHandler(eventName, callback)),
		emit: events.emit,
		modules: {
			addressBook: { whiteList: [], blackList: [], contacts: [] },
			...(config.multisigAccounts ? { multisig: { multisigAccounts: config.multisigAccounts } } : {})
		}
	};
};

// Predefined Controller Configurations

const CONTROLLER_CONFIG_SYMBOL_WITH_TOKENS = {
	chainName: CHAIN_NAME_SYMBOL,
	currentAccount: symbolMainAccount,
	currentAccountInfo: accountInfoSymbolWithTokens,
	networkProperties: networkPropertiesSymbol,
	isWalletReady: true
};

const CONTROLLER_CONFIG_ETHEREUM_WITH_TOKENS = {
	chainName: CHAIN_NAME_ETHEREUM,
	currentAccount: ethereumMainAccount,
	currentAccountInfo: accountInfoEthereumWithTokens,
	networkProperties: networkPropertiesEthereum,
	isWalletReady: true
};

const CONTROLLER_CONFIG_SYMBOL_EMPTY = {
	chainName: CHAIN_NAME_SYMBOL,
	currentAccount: symbolMainAccount,
	currentAccountInfo: accountInfoEmpty,
	networkProperties: networkPropertiesSymbol,
	isWalletReady: true
};

const CONTROLLER_CONFIG_NO_ACCOUNT = {
	chainName: CHAIN_NAME_ETHEREUM,
	currentAccount: null,
	currentAccountInfo: accountInfoEthereumWithTokens,
	networkProperties: networkPropertiesEthereum,
	isWalletReady: true
};

const CONTROLLER_CONFIG_NOT_READY = {
	chainName: CHAIN_NAME_ETHEREUM,
	currentAccount: ethereumMainAccount,
	currentAccountInfo: accountInfoEthereumWithTokens,
	networkProperties: networkPropertiesEthereum,
	isWalletReady: false
};

const CONTROLLER_CONFIG_SYMBOL_WITH_MULTISIG = {
	chainName: CHAIN_NAME_SYMBOL,
	currentAccount: symbolMainAccount,
	currentAccountInfo: accountInfoSymbolWithTokens,
	networkProperties: networkPropertiesSymbol,
	isWalletReady: true,
	multisigAccounts: [
		{ ...symbolMultisigAccount, mosaics: [tokenSymbolMultisigActive] }
	]
};

// Mock Setup

const mockWalletControllers = configs => {
	const mainController = createWalletControllerMock(configs.main);
	const additionalControllers = (configs.additional ?? []).map(createWalletControllerMock);

	walletControllers.main = mainController;
	walletControllers.additional = additionalControllers;

	return { mainController, additionalControllers };
};

// Tests

describe('screens/assets/Assets', () => {
	beforeEach(() => {
		mockLocalization();
		mockOs('android');
		jest.clearAllMocks();
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	describe('render', () => {
		it('renders filter labels', async () => {
			// Arrange:
			mockWalletControllers({
				main: CONTROLLER_CONFIG_SYMBOL_WITH_TOKENS,
				additional: [CONTROLLER_CONFIG_ETHEREUM_WITH_TOKENS]
			});

			// Act:
			const screenTester = new ScreenTester(Assets);
			await screenTester.waitForTimer();

			// Assert:
			screenTester.expectText([
				SCREEN_TEXT.textFilterExpired,
				SCREEN_TEXT.textFilterCreated,
				SCREEN_TEXT.buttonClear
			]);
		});

		it('renders tokens from main wallet controller', async () => {
			// Arrange:
			mockWalletControllers({
				main: CONTROLLER_CONFIG_SYMBOL_WITH_TOKENS,
				additional: []
			});

			// Act:
			const screenTester = new ScreenTester(Assets);
			await screenTester.waitForTimer();

			// Assert:
			screenTester.expectText([
				SCREEN_TEXT.textSectionCurrentAccount,
				symbolMainAccount.address,
				tokenSymbolCreatedActive.name,
				tokenSymbolCreatedActive.amount
			]);
			screenTester.expectText([symbolMainAccount.name], true);
		});

		it('renders tokens from multiple wallet controllers', async () => {
			// Arrange:
			mockWalletControllers({
				main: CONTROLLER_CONFIG_SYMBOL_WITH_TOKENS,
				additional: [CONTROLLER_CONFIG_ETHEREUM_WITH_TOKENS]
			});

			// Act:
			const screenTester = new ScreenTester(Assets);
			await screenTester.waitForTimer();

			// Assert:
			screenTester.expectText([
				SCREEN_TEXT.textSectionCurrentAccount,
				SCREEN_TEXT.textSectionBridgeAccounts,
				symbolMainAccount.address,
				ethereumMainAccount.address,
				tokenSymbolCreatedActive.name,
				tokenSymbolCreatedActive.amount,
				tokenEthereumActive.name,
				tokenEthereumActive.amount
			]);
			screenTester.expectText([symbolMainAccount.name, ethereumMainAccount.name], true);
		});

		it('renders tokens from multisig accounts', async () => {
			// Arrange:
			mockWalletControllers({
				main: CONTROLLER_CONFIG_SYMBOL_WITH_MULTISIG,
				additional: []
			});

			// Act:
			const screenTester = new ScreenTester(Assets);
			await screenTester.waitForTimer();

			// Assert:
			screenTester.expectText([
				SCREEN_TEXT.textSectionMultisigAccounts,
				symbolMultisigAccount.address,
				tokenSymbolMultisigActive.name,
				tokenSymbolMultisigActive.amount
			]);
			screenTester.expectText([symbolMultisigAccount.name], true);
		});
	});

	describe('filters', () => {
		const runToggleFilterTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				mockWalletControllers(config.controllers);

				// Act:
				const screenTester = new ScreenTester(Assets);
				await screenTester.waitForTimer();

				if (config.filterToPress)
					screenTester.pressButton(config.filterToPress);

				// Assert:
				if (expected.visibleTexts?.length > 0)
					screenTester.expectText(expected.visibleTexts);

				if (expected.hiddenTexts?.length > 0)
					screenTester.notExpectText(expected.hiddenTexts);
			});
		};

		const filterTests = [
			{
				description: 'hides expired tokens by default',
				config: {
					controllers: {
						main: CONTROLLER_CONFIG_SYMBOL_WITH_TOKENS,
						additional: [CONTROLLER_CONFIG_ETHEREUM_WITH_TOKENS]
					},
					filterToPress: null
				},
				expected: {
					visibleTexts: [tokenSymbolCreatedActive.name, tokenSymbolExternalActive.name],
					hiddenTexts: [tokenSymbolCreatedExpired.name]
				}
			},
			{
				description: 'shows expired tokens when expired filter is enabled',
				config: {
					controllers: {
						main: CONTROLLER_CONFIG_SYMBOL_WITH_TOKENS,
						additional: [CONTROLLER_CONFIG_ETHEREUM_WITH_TOKENS]
					},
					filterToPress: SCREEN_TEXT.textFilterExpired
				},
				expected: {
					visibleTexts: [
						tokenSymbolCreatedActive.name,
						tokenSymbolExternalActive.name,
						tokenSymbolCreatedExpired.name
					]
				}
			},
			{
				description: 'shows only self-created tokens when created filter is enabled',
				config: {
					controllers: {
						main: CONTROLLER_CONFIG_SYMBOL_WITH_TOKENS,
						additional: [CONTROLLER_CONFIG_ETHEREUM_WITH_TOKENS]
					},
					filterToPress: SCREEN_TEXT.textFilterCreated
				},
				expected: {
					visibleTexts: [tokenSymbolCreatedActive.name, tokenEthereumActive.name],
					hiddenTexts: [tokenSymbolExternalActive.name, tokenSymbolCreatedExpired.name]
				}
			}
		];

		filterTests.forEach(test => {
			runToggleFilterTest(test.description, test.config, test.expected);
		});
	});

	describe('data fetch', () => {
		it('fetches account info only for controllers that are ready and have current account', async () => {
			// Arrange:
			const { mainController, additionalControllers } = mockWalletControllers({
				main: CONTROLLER_CONFIG_SYMBOL_WITH_TOKENS,
				additional: [
					CONTROLLER_CONFIG_ETHEREUM_WITH_TOKENS,
					CONTROLLER_CONFIG_NO_ACCOUNT,
					CONTROLLER_CONFIG_NOT_READY
				]
			});

			// Act:
			const screenTester = new ScreenTester(Assets);
			await screenTester.waitForTimer();

			// Assert:
			expect(mainController.fetchAccountInfo).toHaveBeenCalledTimes(1);
			expect(additionalControllers[0].fetchAccountInfo).toHaveBeenCalledTimes(1);
			expect(additionalControllers[1].fetchAccountInfo).toHaveBeenCalledTimes(0);
			expect(additionalControllers[2].fetchAccountInfo).toHaveBeenCalledTimes(0);
		});

		const runRefreshOnEventTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				const { mainController, additionalControllers } = mockWalletControllers({
					main: CONTROLLER_CONFIG_SYMBOL_WITH_TOKENS,
					additional: [CONTROLLER_CONFIG_ETHEREUM_WITH_TOKENS]
				});
				const screenTester = new ScreenTester(Assets);
				await screenTester.waitForTimer();
				mainController.fetchAccountInfo.mockClear();
				additionalControllers[0].fetchAccountInfo.mockClear();

				// Act:
				await act(async () => {
					mainController.emit(config.eventName);
				});
				await screenTester.waitForTimer();

				// Assert:
				expect(mainController.fetchAccountInfo).toHaveBeenCalledTimes(expected.fetchCallCount);
				expect(additionalControllers[0].fetchAccountInfo).toHaveBeenCalledTimes(expected.fetchCallCount);
			});
		};

		const eventTests = [
			{
				description: 'refreshes assets on account change event',
				config: { eventName: ControllerEventName.ACCOUNT_CHANGE },
				expected: { fetchCallCount: 1 }
			},
			{
				description: 'refreshes assets on new confirmed transaction event',
				config: { eventName: ControllerEventName.NEW_TRANSACTION_CONFIRMED },
				expected: { fetchCallCount: 1 }
			}
		];

		eventTests.forEach(test => {
			runRefreshOnEventTest(test.description, test.config, test.expected);
		});
	});

	describe('empty state', () => {
		it('shows empty list message when no assets are available', async () => {
			// Arrange:
			mockWalletControllers({
				main: CONTROLLER_CONFIG_SYMBOL_EMPTY,
				additional: []
			});

			// Act:
			const screenTester = new ScreenTester(Assets);
			await screenTester.waitForTimer();

			// Assert:
			screenTester.expectText([SCREEN_TEXT.textEmptyList]);
		});

		it('hides empty list message during initial loading', async () => {
			// Arrange:
			const pendingFetch = new Promise(() => {});
			const { mainController } = mockWalletControllers({
				main: CONTROLLER_CONFIG_SYMBOL_EMPTY,
				additional: []
			});
			mainController.fetchAccountInfo.mockReturnValue(pendingFetch);

			// Act:
			const screenTester = new ScreenTester(Assets);
			await screenTester.waitForTimer();

			// Assert:
			screenTester.notExpectText([SCREEN_TEXT.textEmptyList]);
		});
	});
});

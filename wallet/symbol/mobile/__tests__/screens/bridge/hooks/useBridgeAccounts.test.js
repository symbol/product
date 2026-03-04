import { useBridgeAccounts } from '@/app/screens/bridge/hooks/useBridgeAccounts';
import { AccountFixtureBuilder } from '__fixtures__/local/AccountFixtureBuilder';
import { AccountInfoFixtureBuilder } from '__fixtures__/local/AccountInfoFixtureBuilder';
import { NetworkPropertiesFixtureBuilder } from '__fixtures__/local/NetworkPropertiesFixtureBuilder';
import { TokenFixtureBuilder } from '__fixtures__/local/TokenFixtureBuilder';
import { HookTester } from '__tests__/HookTester';
import { runHookContractTest } from '__tests__/hook-tests';
import { createWalletControllerMock } from '__tests__/mock-helpers';
import { act } from '@testing-library/react-native';
import { ControllerEventName } from 'wallet-common-core/src/constants';

// Mocks

let MOCK_ADDITIONAL_CONTROLLERS = [];

jest.mock('@/app/hooks', () => ({
	useReactiveWalletControllers: () => MOCK_ADDITIONAL_CONTROLLERS
}));

jest.mock('@/app/lib/controller', () => ({
	walletControllers: {
		main: { networkIdentifier: 'testnet' },
		additional: []
	}
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

const BalanceValue = {
	ZERO_STRING: '0',
	SYMBOL: '1000000000',
	ETHEREUM: '500000000'
};

const ControllerEvent = {
	ACCOUNT_CHANGE: ControllerEventName.ACCOUNT_CHANGE,
	NEW_TRANSACTION_CONFIRMED: ControllerEventName.NEW_TRANSACTION_CONFIRMED,
	NETWORK_CONNECTED: ControllerEventName.NETWORK_CONNECTED
};

const EXPECTED_EVENT_SUBSCRIPTIONS_PER_CONTROLLER = 3;

// Fixtures

const SYMBOL_ACCOUNT = AccountFixtureBuilder
	.createWithAccount(ChainName.SYMBOL, NetworkIdentifier.TESTNET, 0)
	.build();

const ETHEREUM_ACCOUNT = AccountFixtureBuilder
	.createWithAccount(ChainName.ETHEREUM, NetworkIdentifier.TESTNET, 0)
	.build();

const NETWORK_PROPERTIES_SYMBOL_TESTNET = NetworkPropertiesFixtureBuilder
	.createWithType(ChainName.SYMBOL, NetworkIdentifier.TESTNET)
	.build();

const NETWORK_PROPERTIES_ETHEREUM_TESTNET = NetworkPropertiesFixtureBuilder
	.createWithType(ChainName.ETHEREUM, NetworkIdentifier.TESTNET)
	.build();

const TOKEN_SYMBOL = TokenFixtureBuilder
	.createEmpty()
	.setId('token-symbol-1')
	.setName('Token Symbol 1')
	.setDivisibility(6)
	.setAmount('1000')
	.build();

const TOKEN_ETHEREUM = TokenFixtureBuilder
	.createEmpty()
	.setId('token-ethereum-1')
	.setName('Token Ethereum 1')
	.setDivisibility(18)
	.setAmount('2000')
	.build();

const TOKENS_MIXED = [TOKEN_SYMBOL, TOKEN_ETHEREUM];

const createAccountInfoFixture = ({ chainName, account, balance, tokens = [], hasFetchedAt = true }) => {
	const builder = AccountInfoFixtureBuilder
		.createEmpty(chainName, NetworkIdentifier.TESTNET)
		.override({ address: account.address, publicKey: account.publicKey })
		.setBalance(balance)
		.setTokens(tokens);

	if (hasFetchedAt)
		builder.setFetchedAt(Date.now() - 60000);

	return builder.build();
};

const SYMBOL_ACCOUNT_INFO_LOADED = createAccountInfoFixture({
	chainName: ChainName.SYMBOL,
	account: SYMBOL_ACCOUNT,
	balance: BalanceValue.SYMBOL
});

const SYMBOL_ACCOUNT_INFO_NOT_LOADED = createAccountInfoFixture({
	chainName: ChainName.SYMBOL,
	account: SYMBOL_ACCOUNT,
	balance: BalanceValue.SYMBOL,
	hasFetchedAt: false
});

const SYMBOL_ACCOUNT_INFO_WITH_TOKENS = createAccountInfoFixture({
	chainName: ChainName.SYMBOL,
	account: SYMBOL_ACCOUNT,
	balance: BalanceValue.SYMBOL,
	tokens: TOKENS_MIXED
});

const ETHEREUM_ACCOUNT_INFO_LOADED = createAccountInfoFixture({
	chainName: ChainName.ETHEREUM,
	account: ETHEREUM_ACCOUNT,
	balance: BalanceValue.ETHEREUM
});

const ControllerState = {
	READY: {
		isStateReady: true,
		hasAccounts: true,
		isNetworkConnectionReady: true,
		isWalletReady: true
	},
	NOT_READY: {
		isStateReady: false,
		hasAccounts: false,
		isNetworkConnectionReady: false,
		isWalletReady: false
	}
};

const ControllerScenario = {
	SYMBOL_READY: {
		chainName: ChainName.SYMBOL,
		ticker: Ticker.SYMBOL,
		networkIdentifier: NetworkIdentifier.TESTNET,
		networkProperties: NETWORK_PROPERTIES_SYMBOL_TESTNET,
		currentAccount: SYMBOL_ACCOUNT,
		currentAccountInfo: SYMBOL_ACCOUNT_INFO_LOADED,
		...ControllerState.READY
	},
	ETHEREUM_READY: {
		chainName: ChainName.ETHEREUM,
		ticker: Ticker.ETHEREUM,
		networkIdentifier: NetworkIdentifier.TESTNET,
		networkProperties: NETWORK_PROPERTIES_ETHEREUM_TESTNET,
		currentAccount: ETHEREUM_ACCOUNT,
		currentAccountInfo: ETHEREUM_ACCOUNT_INFO_LOADED,
		...ControllerState.READY
	},
	SYMBOL_READY_NO_ACCOUNT: {
		chainName: ChainName.SYMBOL,
		ticker: Ticker.SYMBOL,
		networkIdentifier: NetworkIdentifier.TESTNET,
		networkProperties: NETWORK_PROPERTIES_SYMBOL_TESTNET,
		currentAccount: null,
		currentAccountInfo: null,
		...ControllerState.READY
	},
	SYMBOL_NOT_READY: {
		chainName: ChainName.SYMBOL,
		ticker: Ticker.SYMBOL,
		networkIdentifier: NetworkIdentifier.TESTNET,
		networkProperties: NETWORK_PROPERTIES_SYMBOL_TESTNET,
		currentAccount: SYMBOL_ACCOUNT,
		currentAccountInfo: SYMBOL_ACCOUNT_INFO_LOADED,
		...ControllerState.NOT_READY
	},
	SYMBOL_READY_NO_ACCOUNT_INFO: {
		chainName: ChainName.SYMBOL,
		ticker: Ticker.SYMBOL,
		networkIdentifier: NetworkIdentifier.TESTNET,
		networkProperties: NETWORK_PROPERTIES_SYMBOL_TESTNET,
		currentAccount: SYMBOL_ACCOUNT,
		currentAccountInfo: null,
		...ControllerState.READY
	},
	SYMBOL_READY_INFO_NOT_LOADED: {
		chainName: ChainName.SYMBOL,
		ticker: Ticker.SYMBOL,
		networkIdentifier: NetworkIdentifier.TESTNET,
		networkProperties: NETWORK_PROPERTIES_SYMBOL_TESTNET,
		currentAccount: SYMBOL_ACCOUNT,
		currentAccountInfo: SYMBOL_ACCOUNT_INFO_NOT_LOADED,
		...ControllerState.READY
	},
	SYMBOL_READY_WITH_TOKENS: {
		chainName: ChainName.SYMBOL,
		ticker: Ticker.SYMBOL,
		networkIdentifier: NetworkIdentifier.TESTNET,
		networkProperties: NETWORK_PROPERTIES_SYMBOL_TESTNET,
		currentAccount: SYMBOL_ACCOUNT,
		currentAccountInfo: SYMBOL_ACCOUNT_INFO_WITH_TOKENS,
		...ControllerState.READY
	}
};

// Test helpers

const createWalletController = (scenario, overrides = {}) => {
	const eventHandlers = {};

	return createWalletControllerMock({
		...scenario,
		fetchAccountInfo: jest.fn().mockResolvedValue(undefined),
		on: jest.fn((eventName, handler) => {
			eventHandlers[eventName] = eventHandlers[eventName] || [];
			eventHandlers[eventName].push(handler);
		}),
		removeListener: jest.fn((eventName, handler) => {
			if (!eventHandlers[eventName])
				return;

			eventHandlers[eventName] = eventHandlers[eventName].filter(currentHandler => currentHandler !== handler);
		}),
		emit: eventName => {
			if (!eventHandlers[eventName])
				return;

			eventHandlers[eventName].forEach(handler => handler());
		},
		...overrides
	}, { bindUseWalletController: false });
};

const setAdditionalControllers = controllers => {
	MOCK_ADDITIONAL_CONTROLLERS = controllers;
};

describe('hooks/useBridgeAccounts', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		setAdditionalControllers([]);
	});

	runHookContractTest(useBridgeAccounts, {
		props: [],
		contract: {
			accounts: 'array',
			refresh: 'function'
		}
	});

	describe('initialization', () => {
		const runInitializationFetchTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const fetchAccountInfoMock = jest.fn();
				setAdditionalControllers([
					createWalletController(config.scenario, {
						fetchAccountInfo: fetchAccountInfoMock
					})
				]);

				// Act:
				new HookTester(useBridgeAccounts);

				// Assert:
				if (expected.shouldFetch)
					expect(fetchAccountInfoMock).toHaveBeenCalledTimes(1);
				else
					expect(fetchAccountInfoMock).not.toHaveBeenCalled();
			});
		};

		const initializationTests = [
			{
				description: 'calls fetchAccountInfo on mount for ready controllers',
				config: { scenario: ControllerScenario.SYMBOL_READY },
				expected: { shouldFetch: true }
			},
			{
				description: 'does not call fetchAccountInfo when no currentAccount',
				config: { scenario: ControllerScenario.SYMBOL_READY_NO_ACCOUNT },
				expected: { shouldFetch: false }
			},
			{
				description: 'does not call fetchAccountInfo when wallet is not ready',
				config: { scenario: ControllerScenario.SYMBOL_NOT_READY },
				expected: { shouldFetch: false }
			}
		];

		initializationTests.forEach(test => {
			runInitializationFetchTest(test.description, test.config, test.expected);
		});

		it('calls fetchAccountInfo for each ready controller', () => {
			// Arrange:
			const symbolFetchAccountInfoMock = jest.fn();
			const ethereumFetchAccountInfoMock = jest.fn();
			setAdditionalControllers([
				createWalletController(ControllerScenario.SYMBOL_READY, {
					fetchAccountInfo: symbolFetchAccountInfoMock
				}),
				createWalletController(ControllerScenario.ETHEREUM_READY, {
					fetchAccountInfo: ethereumFetchAccountInfoMock
				})
			]);

			// Act:
			new HookTester(useBridgeAccounts);

			// Assert:
			expect(symbolFetchAccountInfoMock).toHaveBeenCalledTimes(1);
			expect(ethereumFetchAccountInfoMock).toHaveBeenCalledTimes(1);
		});
	});

	describe('accounts mapping', () => {
		it('creates account object for each wallet controller', () => {
			// Arrange:
			setAdditionalControllers([
				createWalletController(ControllerScenario.SYMBOL_READY),
				createWalletController(ControllerScenario.ETHEREUM_READY)
			]);

			// Act:
			const hookTester = new HookTester(useBridgeAccounts);

			// Assert:
			expect(hookTester.currentResult.accounts).toHaveLength(2);
		});

		it('returns empty array when no additional controllers exist', () => {
			// Arrange:
			setAdditionalControllers([]);

			// Act:
			const hookTester = new HookTester(useBridgeAccounts);

			// Assert:
			expect(hookTester.currentResult.accounts).toEqual([]);
		});

		describe('account object properties', () => {
			const runAccountObjectPropertyTest = (description, config, expected) => {
				it(description, () => {
					// Arrange:
					setAdditionalControllers([
						createWalletController(config.scenario)
					]);

					// Act:
					const hookTester = new HookTester(useBridgeAccounts);
					const mappedAccount = hookTester.currentResult.accounts[0];

					// Assert:
					expect(mappedAccount).toMatchObject(expected);
				});
			};

			const accountObjectPropertyTests = [
				{
					description: 'maps chainName from controller',
					config: { scenario: ControllerScenario.SYMBOL_READY },
					expected: { chainName: ChainName.SYMBOL }
				},
				{
					description: 'maps ticker from controller',
					config: { scenario: ControllerScenario.SYMBOL_READY },
					expected: { ticker: Ticker.SYMBOL }
				},
				{
					description: 'sets isActive true when currentAccount exists',
					config: { scenario: ControllerScenario.SYMBOL_READY },
					expected: { isActive: true }
				},
				{
					description: 'sets isActive false when currentAccount is null',
					config: { scenario: ControllerScenario.SYMBOL_READY_NO_ACCOUNT },
					expected: { isActive: false }
				},
				{
					description: 'maps account from currentAccount',
					config: { scenario: ControllerScenario.SYMBOL_READY },
					expected: { account: SYMBOL_ACCOUNT }
				},
				{
					description: 'maps balance from currentAccountInfo',
					config: { scenario: ControllerScenario.SYMBOL_READY },
					expected: { balance: BalanceValue.SYMBOL }
				},
				{
					description: 'returns zero balance when currentAccountInfo is null',
					config: { scenario: ControllerScenario.SYMBOL_READY_NO_ACCOUNT_INFO },
					expected: { balance: 0 }
				},
				{
					description: 'maps tokens from currentAccountInfo',
					config: { scenario: ControllerScenario.SYMBOL_READY_WITH_TOKENS },
					expected: { tokens: TOKENS_MIXED }
				},
				{
					description: 'returns empty tokens array when currentAccountInfo is null',
					config: { scenario: ControllerScenario.SYMBOL_READY_NO_ACCOUNT_INFO },
					expected: { tokens: [] }
				},
				{
					description: 'sets isAccountInfoLoaded true when fetchedAt exists',
					config: { scenario: ControllerScenario.SYMBOL_READY },
					expected: { isAccountInfoLoaded: true }
				},
				{
					description: 'sets isAccountInfoLoaded false when fetchedAt is missing',
					config: { scenario: ControllerScenario.SYMBOL_READY_INFO_NOT_LOADED },
					expected: { isAccountInfoLoaded: false }
				},
				{
					description: 'sets isAccountInfoLoaded false when currentAccountInfo is null',
					config: { scenario: ControllerScenario.SYMBOL_READY_NO_ACCOUNT_INFO },
					expected: { isAccountInfoLoaded: false }
				}
			];

			accountObjectPropertyTests.forEach(test => {
				runAccountObjectPropertyTest(test.description, test.config, test.expected);
			});
		});
	});

	describe('event subscriptions', () => {
		const runEventSubscriptionTest = (description, eventName) => {
			it(description, () => {
				// Arrange:
				const onMock = jest.fn();
				setAdditionalControllers([
					createWalletController(ControllerScenario.SYMBOL_READY, {
						on: onMock
					})
				]);

				// Act:
				new HookTester(useBridgeAccounts);

				// Assert:
				expect(onMock).toHaveBeenCalledWith(eventName, expect.any(Function));
			});
		};

		const eventSubscriptionTests = [
			{
				description: 'subscribes to account change events',
				eventName: ControllerEvent.ACCOUNT_CHANGE
			},
			{
				description: 'subscribes to new transaction confirmed events',
				eventName: ControllerEvent.NEW_TRANSACTION_CONFIRMED
			},
			{
				description: 'subscribes to network connected events',
				eventName: ControllerEvent.NETWORK_CONNECTED
			}
		];

		eventSubscriptionTests.forEach(test => {
			runEventSubscriptionTest(test.description, test.eventName);
		});

		it('subscribes to all events for each controller', () => {
			// Arrange:
			const symbolOnMock = jest.fn();
			const ethereumOnMock = jest.fn();
			setAdditionalControllers([
				createWalletController(ControllerScenario.SYMBOL_READY, {
					on: symbolOnMock
				}),
				createWalletController(ControllerScenario.ETHEREUM_READY, {
					on: ethereumOnMock
				})
			]);

			// Act:
			new HookTester(useBridgeAccounts);

			// Assert:
			expect(symbolOnMock).toHaveBeenCalledTimes(EXPECTED_EVENT_SUBSCRIPTIONS_PER_CONTROLLER);
			expect(ethereumOnMock).toHaveBeenCalledTimes(EXPECTED_EVENT_SUBSCRIPTIONS_PER_CONTROLLER);
		});
	});

	describe('event handlers', () => {
		const runEventHandlerFetchTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const fetchAccountInfoMock = jest.fn();
				const controller = createWalletController(config.scenario, {
					fetchAccountInfo: fetchAccountInfoMock
				});
				setAdditionalControllers([controller]);
				new HookTester(useBridgeAccounts);
				fetchAccountInfoMock.mockClear();

				// Act:
				act(() => {
					controller.emit(config.eventName);
				});

				// Assert:
				if (expected.shouldFetch)
					expect(fetchAccountInfoMock).toHaveBeenCalledTimes(1);
				else
					expect(fetchAccountInfoMock).not.toHaveBeenCalled();
			});
		};

		const eventHandlerFetchTests = [
			{
				description: 'fetches account info when account change event is emitted',
				config: {
					scenario: ControllerScenario.SYMBOL_READY,
					eventName: ControllerEvent.ACCOUNT_CHANGE
				},
				expected: { shouldFetch: true }
			},
			{
				description: 'fetches account info when new transaction confirmed event is emitted',
				config: {
					scenario: ControllerScenario.SYMBOL_READY,
					eventName: ControllerEvent.NEW_TRANSACTION_CONFIRMED
				},
				expected: { shouldFetch: true }
			},
			{
				description: 'fetches account info when network connected event is emitted',
				config: {
					scenario: ControllerScenario.SYMBOL_READY,
					eventName: ControllerEvent.NETWORK_CONNECTED
				},
				expected: { shouldFetch: true }
			},
			{
				description: 'does not fetch when controller is not ready on event trigger',
				config: {
					scenario: ControllerScenario.SYMBOL_NOT_READY,
					eventName: ControllerEvent.ACCOUNT_CHANGE
				},
				expected: { shouldFetch: false }
			}
		];

		eventHandlerFetchTests.forEach(test => {
			runEventHandlerFetchTest(test.description, test.config, test.expected);
		});
	});

	describe('cleanup', () => {
		it('unsubscribes from events on unmount', () => {
			// Arrange:
			const removeListenerMock = jest.fn();
			setAdditionalControllers([
				createWalletController(ControllerScenario.SYMBOL_READY, {
					removeListener: removeListenerMock
				})
			]);

			// Act:
			const hookTester = new HookTester(useBridgeAccounts);
			hookTester.hookRenderer.unmount();

			// Assert:
			expect(removeListenerMock).toHaveBeenCalledTimes(EXPECTED_EVENT_SUBSCRIPTIONS_PER_CONTROLLER);
			expect(removeListenerMock).toHaveBeenCalledWith(ControllerEvent.ACCOUNT_CHANGE, expect.any(Function));
			expect(removeListenerMock).toHaveBeenCalledWith(ControllerEvent.NEW_TRANSACTION_CONFIRMED, expect.any(Function));
			expect(removeListenerMock).toHaveBeenCalledWith(ControllerEvent.NETWORK_CONNECTED, expect.any(Function));
		});

		it('unsubscribes from all controllers on unmount', () => {
			// Arrange:
			const symbolRemoveListenerMock = jest.fn();
			const ethereumRemoveListenerMock = jest.fn();
			setAdditionalControllers([
				createWalletController(ControllerScenario.SYMBOL_READY, {
					removeListener: symbolRemoveListenerMock
				}),
				createWalletController(ControllerScenario.ETHEREUM_READY, {
					removeListener: ethereumRemoveListenerMock
				})
			]);

			// Act:
			const hookTester = new HookTester(useBridgeAccounts);
			hookTester.hookRenderer.unmount();

			// Assert:
			expect(symbolRemoveListenerMock).toHaveBeenCalledTimes(EXPECTED_EVENT_SUBSCRIPTIONS_PER_CONTROLLER);
			expect(ethereumRemoveListenerMock).toHaveBeenCalledTimes(EXPECTED_EVENT_SUBSCRIPTIONS_PER_CONTROLLER);
		});
	});

	describe('refresh function', () => {
		const runRefreshFetchTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const fetchAccountInfoMock = jest.fn();
				setAdditionalControllers([
					createWalletController(config.scenario, {
						fetchAccountInfo: fetchAccountInfoMock
					})
				]);

				const hookTester = new HookTester(useBridgeAccounts);
				fetchAccountInfoMock.mockClear();

				// Act:
				act(() => {
					hookTester.currentResult.refresh();
				});

				// Assert:
				if (expected.shouldFetch)
					expect(fetchAccountInfoMock).toHaveBeenCalledTimes(1);
				else
					expect(fetchAccountInfoMock).not.toHaveBeenCalled();
			});
		};

		const refreshFetchTests = [
			{
				description: 'calls fetchAccountInfo for ready controllers',
				config: { scenario: ControllerScenario.SYMBOL_READY },
				expected: { shouldFetch: true }
			},
			{
				description: 'does not call fetchAccountInfo for controllers without currentAccount',
				config: { scenario: ControllerScenario.SYMBOL_READY_NO_ACCOUNT },
				expected: { shouldFetch: false }
			},
			{
				description: 'does not call fetchAccountInfo for not-ready controllers',
				config: { scenario: ControllerScenario.SYMBOL_NOT_READY },
				expected: { shouldFetch: false }
			}
		];

		refreshFetchTests.forEach(test => {
			runRefreshFetchTest(test.description, test.config, test.expected);
		});

		it('calls fetchAccountInfo for all ready controllers', () => {
			// Arrange:
			const symbolFetchAccountInfoMock = jest.fn();
			const ethereumFetchAccountInfoMock = jest.fn();
			setAdditionalControllers([
				createWalletController(ControllerScenario.SYMBOL_READY, {
					fetchAccountInfo: symbolFetchAccountInfoMock
				}),
				createWalletController(ControllerScenario.ETHEREUM_READY, {
					fetchAccountInfo: ethereumFetchAccountInfoMock
				})
			]);

			const hookTester = new HookTester(useBridgeAccounts);
			symbolFetchAccountInfoMock.mockClear();
			ethereumFetchAccountInfoMock.mockClear();

			// Act:
			act(() => {
				hookTester.currentResult.refresh();
			});

			// Assert:
			expect(symbolFetchAccountInfoMock).toHaveBeenCalledTimes(1);
			expect(ethereumFetchAccountInfoMock).toHaveBeenCalledTimes(1);
		});

		it('skips not-ready controllers when refreshing multiple controllers', () => {
			// Arrange:
			const symbolFetchAccountInfoMock = jest.fn();
			const ethereumFetchAccountInfoMock = jest.fn();
			setAdditionalControllers([
				createWalletController(ControllerScenario.SYMBOL_READY, {
					fetchAccountInfo: symbolFetchAccountInfoMock
				}),
				createWalletController(ControllerScenario.ETHEREUM_READY, {
					...ControllerState.NOT_READY,
					fetchAccountInfo: ethereumFetchAccountInfoMock
				})
			]);

			const hookTester = new HookTester(useBridgeAccounts);
			symbolFetchAccountInfoMock.mockClear();
			ethereumFetchAccountInfoMock.mockClear();

			// Act:
			act(() => {
				hookTester.currentResult.refresh();
			});

			// Assert:
			expect(symbolFetchAccountInfoMock).toHaveBeenCalledTimes(1);
			expect(ethereumFetchAccountInfoMock).not.toHaveBeenCalled();
		});
	});
});

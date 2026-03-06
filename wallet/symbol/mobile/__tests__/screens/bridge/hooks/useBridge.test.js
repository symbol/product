import { useBridge } from '@/app/screens/bridge/hooks/useBridge';
import { BridgeMode, BridgePairsStatus } from '@/app/screens/bridge/types/Bridge';
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

const mockLoadWalletController = jest.fn().mockResolvedValue(undefined);

jest.mock('@/app/screens/bridge/utils', () => ({
	loadWalletController: (...args) => mockLoadWalletController(...args)
}));

const mockBridges = [];
const mockMainWalletController = { networkIdentifier: 'testnet' };
const mockEthereumWalletController = { networkIdentifier: 'testnet' };

jest.mock('@/app/lib/controller', () => ({
	default: mockMainWalletController,
	symbolWalletController: mockMainWalletController,
	ethereumWalletController: mockEthereumWalletController,
	walletControllers: {
		main: mockMainWalletController,
		additional: [mockEthereumWalletController]
	},
	get bridges() {
		return mockBridges;
	}
}));

// Constants

const NATIVE_CHAIN_NAME = 'symbol';
const WRAPPED_CHAIN_NAME = 'ethereum';
const NETWORK_IDENTIFIER = 'testnet';
const BRIDGE_ID = 'symbol-xym-ethereum-wxym';

const BalanceValue = {
	ZERO: '0',
	NATIVE: '1000000000',
	WRAPPED: '500000000'
};

const BridgeControllerState = {
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
	},
	CACHE_LOADED_NO_ACCOUNTS: {
		isStateReady: true,
		hasAccounts: false,
		isNetworkConnectionReady: true,
		isWalletReady: false
	},
	CACHE_LOADED_WITH_ACCOUNTS_NOT_CONNECTED: {
		isStateReady: true,
		hasAccounts: true,
		isNetworkConnectionReady: false,
		isWalletReady: false
	}
};

// Fixtures

const nativeAccount = AccountFixtureBuilder
	.createWithAccount(NATIVE_CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.build();

const wrappedAccount = AccountFixtureBuilder
	.createWithAccount(WRAPPED_CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.build();

const nativeNetworkProperties = NetworkPropertiesFixtureBuilder
	.createWithType(NATIVE_CHAIN_NAME, NETWORK_IDENTIFIER)
	.build();

const wrappedNetworkProperties = NetworkPropertiesFixtureBuilder
	.createWithType(WRAPPED_CHAIN_NAME, NETWORK_IDENTIFIER)
	.build();

const nativeToken = TokenFixtureBuilder
	.createWithToken(NATIVE_CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.build();

const wrappedToken = TokenFixtureBuilder
	.createWithToken(WRAPPED_CHAIN_NAME, NETWORK_IDENTIFIER, 1)
	.build();

const nativeTokenInfo = {
	id: nativeToken.id,
	name: nativeToken.name,
	divisibility: nativeToken.divisibility
};

const wrappedTokenInfo = {
	id: wrappedToken.id,
	name: wrappedToken.name,
	divisibility: wrappedToken.divisibility
};

const createAccountInfoWithTokens = (chainName, account, tokens) => {
	return AccountInfoFixtureBuilder
		.createEmpty(chainName, NETWORK_IDENTIFIER)
		.override({ address: account.address, publicKey: account.publicKey })
		.setTokens(tokens)
		.build();
};

const createAccountInfoWithMosaics = (chainName, account, mosaics) => {
	return AccountInfoFixtureBuilder
		.createEmpty(chainName, NETWORK_IDENTIFIER)
		.override({ address: account.address, publicKey: account.publicKey })
		.setMosaics(mosaics)
		.build();
};

const nativeAccountInfoWithToken = createAccountInfoWithTokens(
	NATIVE_CHAIN_NAME,
	nativeAccount,
	[{ id: nativeTokenInfo.id, amount: BalanceValue.NATIVE }]
);

const wrappedAccountInfoWithToken = createAccountInfoWithTokens(
	WRAPPED_CHAIN_NAME,
	wrappedAccount,
	[{ id: wrappedTokenInfo.id, amount: BalanceValue.WRAPPED }]
);

const nativeAccountInfoWithMosaic = createAccountInfoWithMosaics(
	NATIVE_CHAIN_NAME,
	nativeAccount,
	[{ id: nativeTokenInfo.id, amount: BalanceValue.NATIVE }]
);

const wrappedAccountInfoWithMosaic = createAccountInfoWithMosaics(
	WRAPPED_CHAIN_NAME,
	wrappedAccount,
	[{ id: wrappedTokenInfo.id, amount: BalanceValue.WRAPPED }]
);

const nativeBaseController = {
	chainName: NATIVE_CHAIN_NAME,
	networkIdentifier: NETWORK_IDENTIFIER,
	networkProperties: nativeNetworkProperties,
	currentAccount: nativeAccount
};

const wrappedBaseController = {
	chainName: WRAPPED_CHAIN_NAME,
	networkIdentifier: NETWORK_IDENTIFIER,
	networkProperties: wrappedNetworkProperties,
	currentAccount: wrappedAccount
};

const BridgeScenario = {
	FULLY_READY: {
		nativeState: BridgeControllerState.READY,
		wrappedState: BridgeControllerState.READY,
		nativeAccountInfo: null,
		wrappedAccountInfo: null
	},
	NOT_READY: {
		nativeState: BridgeControllerState.NOT_READY,
		wrappedState: BridgeControllerState.NOT_READY,
		nativeAccountInfo: null,
		wrappedAccountInfo: null
	},
	CACHE_LOADED_NO_ACCOUNTS: {
		nativeState: BridgeControllerState.CACHE_LOADED_NO_ACCOUNTS,
		wrappedState: BridgeControllerState.CACHE_LOADED_NO_ACCOUNTS,
		nativeAccountInfo: null,
		wrappedAccountInfo: null
	},
	NATIVE_NOT_CONNECTED: {
		nativeState: BridgeControllerState.CACHE_LOADED_WITH_ACCOUNTS_NOT_CONNECTED,
		wrappedState: BridgeControllerState.READY,
		nativeAccountInfo: null,
		wrappedAccountInfo: null
	},
	WITH_TOKEN_BALANCES: {
		nativeState: BridgeControllerState.READY,
		wrappedState: BridgeControllerState.READY,
		nativeAccountInfo: nativeAccountInfoWithToken,
		wrappedAccountInfo: wrappedAccountInfoWithToken
	},
	WITH_MOSAIC_BALANCES: {
		nativeState: BridgeControllerState.READY,
		wrappedState: BridgeControllerState.READY,
		nativeAccountInfo: nativeAccountInfoWithMosaic,
		wrappedAccountInfo: wrappedAccountInfoWithMosaic
	}
};

// Test helpers

const setBridges = bridgesList => {
	mockBridges.length = 0;
	mockBridges.push(...bridgesList);
};

const createUseBridgeHookTester = async () => {
	const hookTester = new HookTester(useBridge);

	await act(async () => {
		await Promise.resolve();
	});

	return hookTester;
};

const createBridgeWalletController = (baseController, state, currentAccountInfo = null) => {
	return createWalletControllerMock({
		...baseController,
		...state,
		currentAccountInfo,
		loadCache: jest.fn().mockResolvedValue(),
		connectToNetwork: jest.fn().mockResolvedValue(),
		fetchAccountInfo: jest.fn().mockResolvedValue(),
		selectNetwork: jest.fn().mockResolvedValue(),
		on: jest.fn(),
		removeListener: jest.fn()
	}, {
		bindUseWalletController: false
	});
};

const createBridgeManagerMock = (scenario = BridgeScenario.FULLY_READY, overrides = {}) => {
	const nativeWalletController = overrides.nativeWalletController
		?? createBridgeWalletController(
			nativeBaseController,
			scenario.nativeState,
			scenario.nativeAccountInfo
		);
	const wrappedWalletController = overrides.wrappedWalletController
		?? createBridgeWalletController(
			wrappedBaseController,
			scenario.wrappedState,
			scenario.wrappedAccountInfo
		);

	return {
		id: BRIDGE_ID,
		nativeWalletController,
		wrappedWalletController,
		nativeTokenInfo,
		wrappedTokenInfo,
		load: overrides.load ?? jest.fn().mockResolvedValue(),
		isEnabled: true,
		isReady: true,
		config: { enabled: true }
	};
};

describe('hooks/useBridge', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		setBridges([]);
	});

	runHookContractTest(useBridge, {
		props: [],
		contract: {
			bridges: 'array',
			pairs: 'array',
			pairsStatus: 'string',
			loadBridges: 'function',
			loadWalletControllers: 'function',
			fetchBalances: 'function'
		},
		waitAsyncEffects: true
	});

	describe('initialization', () => {
		const runInitializationTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				setBridges(config.bridges);

				// Act:
				const hookTester = await createUseBridgeHookTester();

				// Assert:
				await hookTester.waitFor(() => {
					expect(hookTester.currentResult.pairsStatus).toBe(expected.pairsStatus);
				});
			});
		};

		const initializationTests = [
			{
				description: 'returns loading when no bridge cache is loaded',
				config: { bridges: [createBridgeManagerMock(BridgeScenario.NOT_READY)] },
				expected: { pairsStatus: BridgePairsStatus.LOADING }
			},
			{
				description: 'returns no_pairs when cache is loaded but accounts are missing',
				config: { bridges: [createBridgeManagerMock(BridgeScenario.CACHE_LOADED_NO_ACCOUNTS)] },
				expected: { pairsStatus: BridgePairsStatus.NO_PAIRS }
			},
			{
				description: 'returns ok when bridge controllers are fully ready',
				config: { bridges: [createBridgeManagerMock(BridgeScenario.FULLY_READY)] },
				expected: { pairsStatus: BridgePairsStatus.OK }
			},
			{
				description: 'returns loading when bridge list is empty',
				config: { bridges: [] },
				expected: { pairsStatus: BridgePairsStatus.LOADING }
			}
		];

		initializationTests.forEach(test => {
			runInitializationTest(test.description, test.config, test.expected);
		});
	});

	describe('swap pairs', () => {
		it('creates two pairs per ready bridge (wrap + unwrap)', async () => {
			// Arrange:
			setBridges([createBridgeManagerMock(BridgeScenario.FULLY_READY)]);

			// Act:
			const hookTester = await createUseBridgeHookTester();

			// Assert:
			await hookTester.waitFor(() => {
				expect(hookTester.currentResult.pairs).toHaveLength(2);
			});
		});

		const runSwapDirectionTest = (description, mode, expected) => {
			it(description, async () => {
				// Arrange:
				setBridges([createBridgeManagerMock(BridgeScenario.FULLY_READY)]);

				// Act:
				const hookTester = await createUseBridgeHookTester();

				// Assert:
				await hookTester.waitFor(() => {
					const pair = hookTester.currentResult.pairs.find(item => item.mode === mode);
					expect(pair).toBeDefined();
					expect(pair.source.chainName).toBe(expected.sourceChainName);
					expect(pair.target.chainName).toBe(expected.targetChainName);
				});
			});
		};

		const swapDirectionTests = [
			{
				description: 'creates wrap pair with native source and wrapped target',
				mode: BridgeMode.WRAP,
				expected: {
					sourceChainName: NATIVE_CHAIN_NAME,
					targetChainName: WRAPPED_CHAIN_NAME
				}
			},
			{
				description: 'creates unwrap pair with wrapped source and native target',
				mode: BridgeMode.UNWRAP,
				expected: {
					sourceChainName: WRAPPED_CHAIN_NAME,
					targetChainName: NATIVE_CHAIN_NAME
				}
			}
		];

		swapDirectionTests.forEach(test => {
			runSwapDirectionTest(test.description, test.mode, test.expected);
		});

		it('includes token info with balance in swap pairs', async () => {
			// Arrange:
			setBridges([createBridgeManagerMock(BridgeScenario.WITH_TOKEN_BALANCES)]);

			// Act:
			const hookTester = await createUseBridgeHookTester();

			// Assert:
			await hookTester.waitFor(() => {
				const wrapPair = hookTester.currentResult.pairs.find(item => item.mode === BridgeMode.WRAP);
				expect(wrapPair.source.token.id).toBe(nativeTokenInfo.id);
				expect(wrapPair.source.token.amount).toBe(BalanceValue.NATIVE);
				expect(wrapPair.target.token.id).toBe(wrappedTokenInfo.id);
				expect(wrapPair.target.token.amount).toBe(BalanceValue.WRAPPED);
			});
		});

		it('falls back to mosaics when tokens are absent', async () => {
			// Arrange:
			setBridges([createBridgeManagerMock(BridgeScenario.WITH_MOSAIC_BALANCES)]);

			// Act:
			const hookTester = await createUseBridgeHookTester();

			// Assert:
			await hookTester.waitFor(() => {
				const wrapPair = hookTester.currentResult.pairs.find(item => item.mode === BridgeMode.WRAP);
				expect(wrapPair.source.token.amount).toBe(BalanceValue.NATIVE);
				expect(wrapPair.target.token.amount).toBe(BalanceValue.WRAPPED);
			});
		});

		it('sets zero amount when account has no matching token', async () => {
			// Arrange:
			setBridges([createBridgeManagerMock(BridgeScenario.FULLY_READY)]);

			// Act:
			const hookTester = await createUseBridgeHookTester();

			// Assert:
			await hookTester.waitFor(() => {
				const wrapPair = hookTester.currentResult.pairs.find(item => item.mode === BridgeMode.WRAP);
				expect(wrapPair.source.token.amount).toBe(BalanceValue.ZERO);
			});
		});

		it('keeps bridge and wallet-controller references in pair object', async () => {
			// Arrange:
			const bridge = createBridgeManagerMock(BridgeScenario.FULLY_READY);
			setBridges([bridge]);

			// Act:
			const hookTester = await createUseBridgeHookTester();

			// Assert:
			await hookTester.waitFor(() => {
				const wrapPair = hookTester.currentResult.pairs.find(item => item.mode === BridgeMode.WRAP);
				expect(wrapPair.bridge).toBe(bridge);
				expect(wrapPair.source.walletController).toBe(bridge.nativeWalletController);
				expect(wrapPair.target.walletController).toBe(bridge.wrappedWalletController);
			});
		});

		it('does not create pairs when one controller is not network-connected', async () => {
			// Arrange:
			setBridges([createBridgeManagerMock(BridgeScenario.NATIVE_NOT_CONNECTED)]);

			// Act:
			const hookTester = await createUseBridgeHookTester();

			// Assert:
			await hookTester.waitFor(() => {
				expect(hookTester.currentResult.pairs).toHaveLength(0);
			});
		});

		it('creates pairs for each ready bridge', async () => {
			// Arrange:
			setBridges([
				createBridgeManagerMock(BridgeScenario.FULLY_READY),
				createBridgeManagerMock(BridgeScenario.FULLY_READY)
			]);

			// Act:
			const hookTester = await createUseBridgeHookTester();

			// Assert:
			await hookTester.waitFor(() => {
				expect(hookTester.currentResult.pairs).toHaveLength(4);
			});
		});
	});

	describe('wallet and bridge loading', () => {
		it('loads only not-ready wallet controllers', async () => {
			// Arrange:
			const bridge = createBridgeManagerMock(BridgeScenario.NOT_READY);
			setBridges([bridge]);

			// Act:
			const hookTester = await createUseBridgeHookTester();

			// Assert:
			await hookTester.waitFor(() => {
				expect(mockLoadWalletController).toHaveBeenCalledTimes(2);
			});
			expect(mockLoadWalletController).toHaveBeenCalledWith(bridge.nativeWalletController);
			expect(mockLoadWalletController).toHaveBeenCalledWith(bridge.wrappedWalletController);
		});

		it('does not load already-ready wallet controllers', async () => {
			// Arrange:
			setBridges([createBridgeManagerMock(BridgeScenario.FULLY_READY)]);

			// Act:
			const hookTester = await createUseBridgeHookTester();
			await hookTester.waitFor(() => {
				expect(hookTester.currentResult.pairsStatus).toBeDefined();
			});

			// Assert:
			expect(mockLoadWalletController).not.toHaveBeenCalled();
		});

		it('loads only fully-ready bridges', async () => {
			// Arrange:
			const readyBridge = createBridgeManagerMock(BridgeScenario.FULLY_READY);
			const notReadyBridge = createBridgeManagerMock(BridgeScenario.NOT_READY);
			setBridges([readyBridge, notReadyBridge]);

			// Act:
			const hookTester = await createUseBridgeHookTester();

			// Assert:
			await hookTester.waitFor(() => {
				expect(readyBridge.load).toHaveBeenCalledTimes(1);
			});
			expect(notReadyBridge.load).not.toHaveBeenCalled();
		});

		it('can manually reload wallet controllers', async () => {
			// Arrange:
			const notReadyNativeController = createBridgeWalletController(
				nativeBaseController,
				BridgeControllerState.NOT_READY
			);
			const bridge = createBridgeManagerMock(BridgeScenario.FULLY_READY, {
				nativeWalletController: notReadyNativeController
			});
			setBridges([bridge]);

			// Act:
			const hookTester = await createUseBridgeHookTester();
			await hookTester.waitFor(() => {
				expect(mockLoadWalletController).toHaveBeenCalledWith(notReadyNativeController);
			});

			mockLoadWalletController.mockClear();
			await act(async () => {
				await hookTester.currentResult.loadWalletControllers();
			});

			// Assert:
			expect(mockLoadWalletController).toHaveBeenCalledTimes(1);
			expect(mockLoadWalletController).toHaveBeenCalledWith(notReadyNativeController);
		});

		it('can manually reload ready bridges', async () => {
			// Arrange:
			const bridge = createBridgeManagerMock(BridgeScenario.FULLY_READY);
			setBridges([bridge]);

			// Act:
			const hookTester = await createUseBridgeHookTester();
			await hookTester.waitFor(() => {
				expect(bridge.load).toHaveBeenCalledTimes(1);
			});

			bridge.load.mockClear();
			await act(async () => {
				await hookTester.currentResult.loadBridges();
			});

			// Assert:
			expect(bridge.load).toHaveBeenCalledTimes(1);
		});
	});

	describe('balance fetching', () => {
		it('fetches account info only for wallet-ready controllers with accounts', async () => {
			// Arrange:
			const readyBridge = createBridgeManagerMock(BridgeScenario.FULLY_READY);
			const noAccountsBridge = createBridgeManagerMock(BridgeScenario.CACHE_LOADED_NO_ACCOUNTS);
			setBridges([readyBridge, noAccountsBridge]);

			// Act:
			const hookTester = await createUseBridgeHookTester();

			// Assert:
			await hookTester.waitFor(() => {
				expect(readyBridge.nativeWalletController.fetchAccountInfo).toHaveBeenCalled();
				expect(readyBridge.wrappedWalletController.fetchAccountInfo).toHaveBeenCalled();
			});
			expect(noAccountsBridge.nativeWalletController.fetchAccountInfo).not.toHaveBeenCalled();
			expect(noAccountsBridge.wrappedWalletController.fetchAccountInfo).not.toHaveBeenCalled();
		});

		it('can manually refetch balances', async () => {
			// Arrange:
			const bridge = createBridgeManagerMock(BridgeScenario.FULLY_READY);
			setBridges([bridge]);

			// Act:
			const hookTester = await createUseBridgeHookTester();
			await hookTester.waitFor(() => {
				expect(bridge.nativeWalletController.fetchAccountInfo).toHaveBeenCalledTimes(1);
			});

			bridge.nativeWalletController.fetchAccountInfo.mockClear();
			bridge.wrappedWalletController.fetchAccountInfo.mockClear();
			await act(async () => {
				await hookTester.currentResult.fetchBalances();
			});

			// Assert:
			expect(bridge.nativeWalletController.fetchAccountInfo).toHaveBeenCalledTimes(1);
			expect(bridge.wrappedWalletController.fetchAccountInfo).toHaveBeenCalledTimes(1);
		});
	});

	describe('event subscriptions', () => {
		const runSubscriptionTest = (description, eventName) => {
			it(description, async () => {
				// Arrange:
				const bridge = createBridgeManagerMock(BridgeScenario.FULLY_READY);
				setBridges([bridge]);

				// Act:
				const hookTester = await createUseBridgeHookTester();
				await hookTester.waitFor(() => {
					expect(bridge.nativeWalletController.on).toHaveBeenCalled();
				});

				// Assert:
				expect(bridge.nativeWalletController.on).toHaveBeenCalledWith(eventName, expect.any(Function));
				expect(bridge.wrappedWalletController.on).toHaveBeenCalledWith(eventName, expect.any(Function));
			});
		};

		const subscriptionTests = [
			{
				description: 'subscribes to account change',
				eventName: ControllerEventName.ACCOUNT_CHANGE
			},
			{
				description: 'subscribes to network connected',
				eventName: ControllerEventName.NETWORK_CONNECTED
			},
			{
				description: 'subscribes to new transaction confirmed',
				eventName: ControllerEventName.NEW_TRANSACTION_CONFIRMED
			}
		];

		subscriptionTests.forEach(test => {
			runSubscriptionTest(test.description, test.eventName);
		});

		it('removes all listeners on unmount', async () => {
			// Arrange:
			const bridge = createBridgeManagerMock(BridgeScenario.FULLY_READY);
			setBridges([bridge]);

			// Act:
			const hookTester = await createUseBridgeHookTester();
			await hookTester.waitFor(() => {
				expect(bridge.nativeWalletController.on).toHaveBeenCalled();
			});
			hookTester.hookRenderer.unmount();

			// Assert:
			expect(bridge.nativeWalletController.removeListener).toHaveBeenCalledWith(
				ControllerEventName.ACCOUNT_CHANGE,
				expect.any(Function)
			);
			expect(bridge.nativeWalletController.removeListener).toHaveBeenCalledWith(
				ControllerEventName.NETWORK_CONNECTED,
				expect.any(Function)
			);
			expect(bridge.nativeWalletController.removeListener).toHaveBeenCalledWith(
				ControllerEventName.NEW_TRANSACTION_CONFIRMED,
				expect.any(Function)
			);
		});

		it('fetches account info when NEW_TRANSACTION_CONFIRMED callback runs', async () => {
			// Arrange:
			const bridge = createBridgeManagerMock(BridgeScenario.FULLY_READY);
			setBridges([bridge]);

			// Act:
			const hookTester = await createUseBridgeHookTester();
			await hookTester.waitFor(() => {
				expect(bridge.nativeWalletController.fetchAccountInfo).toHaveBeenCalled();
			});

			bridge.nativeWalletController.fetchAccountInfo.mockClear();
			const transactionEventCall = bridge.nativeWalletController.on.mock.calls
				.find(call => call[0] === ControllerEventName.NEW_TRANSACTION_CONFIRMED);

			await act(async () => {
				await transactionEventCall[1]();
			});

			// Assert:
			expect(bridge.nativeWalletController.fetchAccountInfo).toHaveBeenCalledTimes(1);
		});
	});
});

import { useBridge } from '@/app/screens/bridge/hooks/useBridge';
import { BridgeMode, BridgePairsStatus } from '@/app/screens/bridge/types/Bridge';
import { AccountFixtureBuilder } from '__fixtures__/local/AccountFixtureBuilder';
import { AccountInfoFixtureBuilder } from '__fixtures__/local/AccountInfoFixtureBuilder';
import { NetworkPropertiesFixtureBuilder } from '__fixtures__/local/NetworkPropertiesFixtureBuilder';
import { TokenFixtureBuilder } from '__fixtures__/local/TokenFixtureBuilder';
import { createWalletControllerMock } from '__tests__/mock-helpers';
import { act, renderHook, waitFor } from '@testing-library/react-native';
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

const NATIVE_ACCOUNT = AccountFixtureBuilder
	.createWithAccount(NATIVE_CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.build();

const WRAPPED_ACCOUNT = AccountFixtureBuilder
	.createWithAccount(WRAPPED_CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.build();

const NATIVE_NETWORK_PROPERTIES = NetworkPropertiesFixtureBuilder
	.createWithType(NATIVE_CHAIN_NAME, NETWORK_IDENTIFIER)
	.build();

const WRAPPED_NETWORK_PROPERTIES = NetworkPropertiesFixtureBuilder
	.createWithType(WRAPPED_CHAIN_NAME, NETWORK_IDENTIFIER)
	.build();

const NATIVE_TOKEN = TokenFixtureBuilder
	.createWithToken(NATIVE_CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.build();

const WRAPPED_TOKEN = TokenFixtureBuilder
	.createWithToken(WRAPPED_CHAIN_NAME, NETWORK_IDENTIFIER, 1)
	.build();

const NATIVE_TOKEN_INFO = {
	id: NATIVE_TOKEN.id,
	name: NATIVE_TOKEN.name,
	divisibility: NATIVE_TOKEN.divisibility
};

const WRAPPED_TOKEN_INFO = {
	id: WRAPPED_TOKEN.id,
	name: WRAPPED_TOKEN.name,
	divisibility: WRAPPED_TOKEN.divisibility
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

const NATIVE_ACCOUNT_INFO_WITH_TOKEN = createAccountInfoWithTokens(
	NATIVE_CHAIN_NAME,
	NATIVE_ACCOUNT,
	[{ id: NATIVE_TOKEN_INFO.id, amount: BalanceValue.NATIVE }]
);

const WRAPPED_ACCOUNT_INFO_WITH_TOKEN = createAccountInfoWithTokens(
	WRAPPED_CHAIN_NAME,
	WRAPPED_ACCOUNT,
	[{ id: WRAPPED_TOKEN_INFO.id, amount: BalanceValue.WRAPPED }]
);

const NATIVE_ACCOUNT_INFO_WITH_MOSAIC = createAccountInfoWithMosaics(
	NATIVE_CHAIN_NAME,
	NATIVE_ACCOUNT,
	[{ id: NATIVE_TOKEN_INFO.id, amount: BalanceValue.NATIVE }]
);

const WRAPPED_ACCOUNT_INFO_WITH_MOSAIC = createAccountInfoWithMosaics(
	WRAPPED_CHAIN_NAME,
	WRAPPED_ACCOUNT,
	[{ id: WRAPPED_TOKEN_INFO.id, amount: BalanceValue.WRAPPED }]
);

const NATIVE_BASE_CONTROLLER = {
	chainName: NATIVE_CHAIN_NAME,
	networkIdentifier: NETWORK_IDENTIFIER,
	networkProperties: NATIVE_NETWORK_PROPERTIES,
	currentAccount: NATIVE_ACCOUNT
};

const WRAPPED_BASE_CONTROLLER = {
	chainName: WRAPPED_CHAIN_NAME,
	networkIdentifier: NETWORK_IDENTIFIER,
	networkProperties: WRAPPED_NETWORK_PROPERTIES,
	currentAccount: WRAPPED_ACCOUNT
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
		nativeAccountInfo: NATIVE_ACCOUNT_INFO_WITH_TOKEN,
		wrappedAccountInfo: WRAPPED_ACCOUNT_INFO_WITH_TOKEN
	},
	WITH_MOSAIC_BALANCES: {
		nativeState: BridgeControllerState.READY,
		wrappedState: BridgeControllerState.READY,
		nativeAccountInfo: NATIVE_ACCOUNT_INFO_WITH_MOSAIC,
		wrappedAccountInfo: WRAPPED_ACCOUNT_INFO_WITH_MOSAIC
	}
};

// Test helpers

const setBridges = bridgesList => {
	mockBridges.length = 0;
	mockBridges.push(...bridgesList);
};

const renderUseBridge = async () => {
	const renderResult = renderHook(() => useBridge());

	await act(async () => {
		await Promise.resolve();
		await Promise.resolve();
		await Promise.resolve();
	});

	return renderResult;
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
			NATIVE_BASE_CONTROLLER,
			scenario.nativeState,
			scenario.nativeAccountInfo
		);
	const wrappedWalletController = overrides.wrappedWalletController
		?? createBridgeWalletController(
			WRAPPED_BASE_CONTROLLER,
			scenario.wrappedState,
			scenario.wrappedAccountInfo
		);

	return {
		id: BRIDGE_ID,
		nativeWalletController,
		wrappedWalletController,
		nativeTokenInfo: NATIVE_TOKEN_INFO,
		wrappedTokenInfo: WRAPPED_TOKEN_INFO,
		load: overrides.load ?? jest.fn().mockResolvedValue(undefined),
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

	describe('hook contract', () => {
		it('returns all expected fields', async () => {
			// Arrange:
			setBridges([createBridgeManagerMock()]);

			// Act:
			const { result } = await renderUseBridge();

			// Assert:
			expect(Array.isArray(result.current.bridges)).toBe(true);
			expect(Array.isArray(result.current.pairs)).toBe(true);
			expect(result.current.pairsStatus).toBeDefined();
			expect(typeof result.current.loadBridges).toBe('function');
			expect(typeof result.current.loadWalletControllers).toBe('function');
			expect(typeof result.current.fetchBalances).toBe('function');
		});
	});

	describe('pairs status', () => {
		const runPairsStatusTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				setBridges(config.bridges);

				// Act:
				const { result } = await renderUseBridge();

				// Assert:
				await waitFor(() => {
					expect(result.current.pairsStatus).toBe(expected.status);
				});
			});
		};

		const pairsStatusTests = [
			{
				description: 'returns loading when no bridge cache is loaded',
				config: { bridges: [createBridgeManagerMock(BridgeScenario.NOT_READY)] },
				expected: { status: BridgePairsStatus.LOADING }
			},
			{
				description: 'returns no_pairs when cache is loaded but accounts are missing',
				config: { bridges: [createBridgeManagerMock(BridgeScenario.CACHE_LOADED_NO_ACCOUNTS)] },
				expected: { status: BridgePairsStatus.NO_PAIRS }
			},
			{
				description: 'returns ok when bridge controllers are fully ready',
				config: { bridges: [createBridgeManagerMock(BridgeScenario.FULLY_READY)] },
				expected: { status: BridgePairsStatus.OK }
			},
			{
				description: 'returns loading when bridge list is empty',
				config: { bridges: [] },
				expected: { status: BridgePairsStatus.LOADING }
			}
		];

		pairsStatusTests.forEach(test => {
			runPairsStatusTest(test.description, test.config, test.expected);
		});
	});

	describe('swap pairs', () => {
		it('creates two pairs per ready bridge (wrap + unwrap)', async () => {
			// Arrange:
			setBridges([createBridgeManagerMock(BridgeScenario.FULLY_READY)]);

			// Act:
			const { result } = await renderUseBridge();

			// Assert:
			await waitFor(() => {
				expect(result.current.pairs).toHaveLength(2);
			});
		});

		const runSwapDirectionTest = (description, mode, expected) => {
			it(description, async () => {
				// Arrange:
				setBridges([createBridgeManagerMock(BridgeScenario.FULLY_READY)]);

				// Act:
				const { result } = await renderUseBridge();

				// Assert:
				await waitFor(() => {
					const pair = result.current.pairs.find(item => item.mode === mode);

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
			const { result } = await renderUseBridge();

			// Assert:
			await waitFor(() => {
				const wrapPair = result.current.pairs.find(item => item.mode === BridgeMode.WRAP);

				expect(wrapPair.source.token.id).toBe(NATIVE_TOKEN_INFO.id);
				expect(wrapPair.source.token.amount).toBe(BalanceValue.NATIVE);
				expect(wrapPair.target.token.id).toBe(WRAPPED_TOKEN_INFO.id);
				expect(wrapPair.target.token.amount).toBe(BalanceValue.WRAPPED);
			});
		});

		it('falls back to mosaics when tokens are absent', async () => {
			// Arrange:
			setBridges([createBridgeManagerMock(BridgeScenario.WITH_MOSAIC_BALANCES)]);

			// Act:
			const { result } = await renderUseBridge();

			// Assert:
			await waitFor(() => {
				const wrapPair = result.current.pairs.find(item => item.mode === BridgeMode.WRAP);

				expect(wrapPair.source.token.amount).toBe(BalanceValue.NATIVE);
				expect(wrapPair.target.token.amount).toBe(BalanceValue.WRAPPED);
			});
		});

		it('sets zero amount when account has no matching token', async () => {
			// Arrange:
			setBridges([createBridgeManagerMock(BridgeScenario.FULLY_READY)]);

			// Act:
			const { result } = await renderUseBridge();

			// Assert:
			await waitFor(() => {
				const wrapPair = result.current.pairs.find(item => item.mode === BridgeMode.WRAP);
				expect(wrapPair.source.token.amount).toBe(BalanceValue.ZERO);
			});
		});

		it('keeps bridge and wallet-controller references in pair object', async () => {
			// Arrange:
			const bridge = createBridgeManagerMock(BridgeScenario.FULLY_READY);
			setBridges([bridge]);

			// Act:
			const { result } = await renderUseBridge();

			// Assert:
			await waitFor(() => {
				const wrapPair = result.current.pairs.find(item => item.mode === BridgeMode.WRAP);
				expect(wrapPair.bridge).toBe(bridge);
				expect(wrapPair.source.walletController).toBe(bridge.nativeWalletController);
				expect(wrapPair.target.walletController).toBe(bridge.wrappedWalletController);
			});
		});

		it('does not create pairs when one controller is not network-connected', async () => {
			// Arrange:
			setBridges([createBridgeManagerMock(BridgeScenario.NATIVE_NOT_CONNECTED)]);

			// Act:
			const { result } = await renderUseBridge();

			// Assert:
			await waitFor(() => {
				expect(result.current.pairs).toHaveLength(0);
			});
		});

		it('creates pairs for each ready bridge', async () => {
			// Arrange:
			setBridges([
				createBridgeManagerMock(BridgeScenario.FULLY_READY),
				createBridgeManagerMock(BridgeScenario.FULLY_READY)
			]);

			// Act:
			const { result } = await renderUseBridge();

			// Assert:
			await waitFor(() => {
				expect(result.current.pairs).toHaveLength(4);
			});
		});
	});

	describe('wallet and bridge loading', () => {
		it('loads only not-ready wallet controllers', async () => {
			// Arrange:
			const bridge = createBridgeManagerMock(BridgeScenario.NOT_READY);
			setBridges([bridge]);

			// Act:
			await renderUseBridge();

			// Assert:
			await waitFor(() => {
				expect(mockLoadWalletController).toHaveBeenCalledTimes(2);
			});
			expect(mockLoadWalletController).toHaveBeenCalledWith(bridge.nativeWalletController);
			expect(mockLoadWalletController).toHaveBeenCalledWith(bridge.wrappedWalletController);
		});

		it('does not load already-ready wallet controllers', async () => {
			// Arrange:
			setBridges([createBridgeManagerMock(BridgeScenario.FULLY_READY)]);

			// Act:
			await renderUseBridge();

			// Assert:
			expect(mockLoadWalletController).not.toHaveBeenCalled();
		});

		it('loads only fully-ready bridges', async () => {
			// Arrange:
			const readyBridge = createBridgeManagerMock(BridgeScenario.FULLY_READY);
			const notReadyBridge = createBridgeManagerMock(BridgeScenario.NOT_READY);
			setBridges([readyBridge, notReadyBridge]);

			// Act:
			await renderUseBridge();

			// Assert:
			await waitFor(() => {
				expect(readyBridge.load).toHaveBeenCalledTimes(1);
			});
			expect(notReadyBridge.load).not.toHaveBeenCalled();
		});

		it('can manually reload wallet controllers', async () => {
			// Arrange:
			const notReadyNativeController = createBridgeWalletController(
				NATIVE_BASE_CONTROLLER,
				BridgeControllerState.NOT_READY
			);
			const bridge = createBridgeManagerMock(BridgeScenario.FULLY_READY, {
				nativeWalletController: notReadyNativeController
			});
			setBridges([bridge]);

			// Act:
			const { result } = await renderUseBridge();
			await waitFor(() => {
				expect(mockLoadWalletController).toHaveBeenCalledWith(notReadyNativeController);
			});

			mockLoadWalletController.mockClear();
			await act(async () => {
				await result.current.loadWalletControllers();
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
			const { result } = await renderUseBridge();
			await waitFor(() => {
				expect(bridge.load).toHaveBeenCalledTimes(1);
			});

			bridge.load.mockClear();
			await act(async () => {
				await result.current.loadBridges();
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
			await renderUseBridge();

			// Assert:
			await waitFor(() => {
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
			const { result } = await renderUseBridge();
			await waitFor(() => {
				expect(bridge.nativeWalletController.fetchAccountInfo).toHaveBeenCalledTimes(1);
			});

			bridge.nativeWalletController.fetchAccountInfo.mockClear();
			bridge.wrappedWalletController.fetchAccountInfo.mockClear();
			await act(async () => {
				await result.current.fetchBalances();
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
				await renderUseBridge();

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
			const { unmount } = await renderUseBridge();
			unmount();

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
			await renderUseBridge();
			await waitFor(() => {
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

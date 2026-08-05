import { BridgePairsStatus } from '@/app/screens/bridge/types/Bridge';
import { getBridgePairs, isBridgeControllersReady } from '@/app/screens/bridge/utils/bridge-pairs';

// Constants

const NATIVE_CHAIN_NAME = 'symbol';
const WRAPPED_CHAIN_NAME = 'ethereum';
const NETWORK_IDENTIFIER = 'testnet';

const TokenId = {
	NATIVE: 'native-token-id',
	WRAPPED: 'wrapped-token-id'
};

const BalanceValue = {
	ZERO: '0',
	NATIVE: '1000000000',
	WRAPPED: '500000000'
};

// Describes how far a pair of wallet controllers has progressed through its own loading sequence.
const ControllerState = {
	READY: {
		isStateReady: true,
		hasAccounts: true,
		isNetworkConnectionReady: true
	},
	CACHE_NOT_LOADED: {
		isStateReady: false,
		hasAccounts: false,
		isNetworkConnectionReady: false
	},
	CACHE_LOADED_NO_ACCOUNTS: {
		isStateReady: true,
		hasAccounts: false,
		isNetworkConnectionReady: true
	},
	NOT_CONNECTED: {
		isStateReady: true,
		hasAccounts: true,
		isNetworkConnectionReady: false
	}
};

// Fixtures

const nativeTokenInfo = {
	id: TokenId.NATIVE,
	name: 'XYM',
	divisibility: 6
};

const wrappedTokenInfo = {
	id: TokenId.WRAPPED,
	name: 'BXYM',
	divisibility: 6
};

const createWalletControllerStub = (chainName, controllerState, currentAccountInfo) => {
	return {
		...controllerState,
		chainName,
		networkIdentifier: NETWORK_IDENTIFIER,
		currentAccountInfo
	};
};

const createBridgeStub = ({
	controllerState = ControllerState.READY,
	isReady = true,
	isEnabled = true,
	sourceAccountInfo = null,
	targetAccountInfo = null
} = {}) => {
	return {
		sourceWalletController: createWalletControllerStub(NATIVE_CHAIN_NAME, controllerState, sourceAccountInfo),
		targetWalletController: createWalletControllerStub(WRAPPED_CHAIN_NAME, controllerState, targetAccountInfo),
		sourceTokenInfo: nativeTokenInfo,
		targetTokenInfo: wrappedTokenInfo,
		isReady,
		isEnabled
	};
};

describe('screens/bridge/utils/bridge-pairs', () => {
	describe('getBridgePairs', () => {
		describe('status', () => {
			const runStatusTest = (description, config, expected) => {
				it(description, () => {
					// Act:
					const result = getBridgePairs(config.bridges);

					// Assert:
					expect(result.status).toBe(expected.status);
				});
			};

			const statusTests = [
				{
					description: 'returns not_configured when no bridge is configured',
					config: { bridges: [] },
					expected: { status: BridgePairsStatus.NOT_CONFIGURED }
				},
				{
					description: 'returns loading while the controllers are still loading their cache',
					config: { bridges: [createBridgeStub({ controllerState: ControllerState.CACHE_NOT_LOADED })] },
					expected: { status: BridgePairsStatus.LOADING }
				},
				{
					description: 'returns no_pairs, not loading, when the cache is loaded but accounts are missing',
					config: { bridges: [createBridgeStub({ controllerState: ControllerState.CACHE_LOADED_NO_ACCOUNTS })] },
					expected: { status: BridgePairsStatus.NO_PAIRS }
				},
				{
					description: 'returns loading when accounts exist but a controller is not network-connected',
					config: { bridges: [createBridgeStub({ controllerState: ControllerState.NOT_CONNECTED })] },
					expected: { status: BridgePairsStatus.LOADING }
				},
				{
					description: 'returns loading, not disabled, when the bridge config is not fetched yet',
					config: { bridges: [createBridgeStub({ isReady: false, isEnabled: false })] },
					expected: { status: BridgePairsStatus.LOADING }
				},
				{
					description: 'returns disabled when every bridge is turned off by its operator',
					config: { bridges: [createBridgeStub({ isEnabled: false })] },
					expected: { status: BridgePairsStatus.DISABLED }
				},
				{
					description: 'returns ok when a bridge is loaded and enabled',
					config: { bridges: [createBridgeStub()] },
					expected: { status: BridgePairsStatus.OK }
				},
				{
					description: 'returns ok when at least one of several bridges is enabled',
					config: { bridges: [createBridgeStub(), createBridgeStub({ isEnabled: false })] },
					expected: { status: BridgePairsStatus.OK }
				}
			];

			statusTests.forEach(test => {
				runStatusTest(test.description, test.config, test.expected);
			});
		});

		describe('pairs', () => {
			const runPairCountTest = (description, config, expected) => {
				it(description, () => {
					// Act:
					const result = getBridgePairs(config.bridges);

					// Assert:
					expect(result.pairs).toHaveLength(expected.pairCount);
				});
			};

			const pairCountTests = [
				{
					description: 'creates no pair when no bridge is configured',
					config: { bridges: [] },
					expected: { pairCount: 0 }
				},
				{
					description: 'creates no pair while the controllers are still loading their cache',
					config: { bridges: [createBridgeStub({ controllerState: ControllerState.CACHE_NOT_LOADED })] },
					expected: { pairCount: 0 }
				},
				{
					description: 'creates no pair when accounts are missing',
					config: { bridges: [createBridgeStub({ controllerState: ControllerState.CACHE_LOADED_NO_ACCOUNTS })] },
					expected: { pairCount: 0 }
				},
				{
					description: 'creates no pair when a controller is not network-connected',
					config: { bridges: [createBridgeStub({ controllerState: ControllerState.NOT_CONNECTED })] },
					expected: { pairCount: 0 }
				},
				{
					description: 'creates no pair when the bridge config is not fetched yet',
					config: { bridges: [createBridgeStub({ isReady: false })] },
					expected: { pairCount: 0 }
				},
				{
					description: 'creates no pair for a bridge turned off by its operator',
					config: { bridges: [createBridgeStub({ isEnabled: false })] },
					expected: { pairCount: 0 }
				},
				{
					description: 'creates one pair per loaded and enabled bridge',
					config: { bridges: [createBridgeStub(), createBridgeStub()] },
					expected: { pairCount: 2 }
				},
				{
					description: 'keeps the pair of the bridge that is still enabled',
					config: { bridges: [createBridgeStub(), createBridgeStub({ isEnabled: false })] },
					expected: { pairCount: 1 }
				}
			];

			pairCountTests.forEach(test => {
				runPairCountTest(test.description, test.config, test.expected);
			});

			it('describes both sides of the swap', () => {
				// Arrange:
				const bridge = createBridgeStub();

				// Act:
				const { pairs } = getBridgePairs([bridge]);

				// Assert:
				expect(pairs[0].bridge).toBe(bridge);
				expect(pairs[0].source.chainName).toBe(NATIVE_CHAIN_NAME);
				expect(pairs[0].source.networkIdentifier).toBe(NETWORK_IDENTIFIER);
				expect(pairs[0].source.walletController).toBe(bridge.sourceWalletController);
				expect(pairs[0].target.chainName).toBe(WRAPPED_CHAIN_NAME);
				expect(pairs[0].target.walletController).toBe(bridge.targetWalletController);
			});

			const runBalanceTest = (description, config, expected) => {
				it(description, () => {
					// Arrange:
					const bridge = createBridgeStub({
						sourceAccountInfo: config.sourceAccountInfo,
						targetAccountInfo: config.targetAccountInfo
					});

					// Act:
					const { pairs } = getBridgePairs([bridge]);

					// Assert:
					expect(pairs[0].source.token.id).toBe(TokenId.NATIVE);
					expect(pairs[0].source.token.amount).toBe(expected.sourceAmount);
					expect(pairs[0].target.token.id).toBe(TokenId.WRAPPED);
					expect(pairs[0].target.token.amount).toBe(expected.targetAmount);
				});
			};

			const balanceTests = [
				{
					description: 'takes the token balances from the account tokens',
					config: {
						sourceAccountInfo: { tokens: [{ id: TokenId.NATIVE, amount: BalanceValue.NATIVE }] },
						targetAccountInfo: { tokens: [{ id: TokenId.WRAPPED, amount: BalanceValue.WRAPPED }] }
					},
					expected: {
						sourceAmount: BalanceValue.NATIVE,
						targetAmount: BalanceValue.WRAPPED
					}
				},
				{
					description: 'falls back to the account mosaics when tokens are absent',
					config: {
						sourceAccountInfo: { mosaics: [{ id: TokenId.NATIVE, amount: BalanceValue.NATIVE }] },
						targetAccountInfo: { mosaics: [{ id: TokenId.WRAPPED, amount: BalanceValue.WRAPPED }] }
					},
					expected: {
						sourceAmount: BalanceValue.NATIVE,
						targetAmount: BalanceValue.WRAPPED
					}
				},
				{
					description: 'uses a zero balance when the account holds no matching token',
					config: {
						sourceAccountInfo: { tokens: [] },
						targetAccountInfo: { tokens: [] }
					},
					expected: {
						sourceAmount: BalanceValue.ZERO,
						targetAmount: BalanceValue.ZERO
					}
				},
				{
					description: 'uses a zero balance when the account info is not fetched yet',
					config: {
						sourceAccountInfo: null,
						targetAccountInfo: null
					},
					expected: {
						sourceAmount: BalanceValue.ZERO,
						targetAmount: BalanceValue.ZERO
					}
				}
			];

			balanceTests.forEach(test => {
				runBalanceTest(test.description, test.config, test.expected);
			});
		});
	});

	describe('isBridgeControllersReady', () => {
		const runReadyTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const bridge = createBridgeStub({ controllerState: config.controllerState });

				// Act:
				const result = isBridgeControllersReady(bridge);

				// Assert:
				expect(result).toBe(expected.isReady);
			});
		};

		const readyTests = [
			{
				description: 'returns true when both controllers have cache, accounts and a connection',
				config: { controllerState: ControllerState.READY },
				expected: { isReady: true }
			},
			{
				description: 'returns false when the cache is not loaded',
				config: { controllerState: ControllerState.CACHE_NOT_LOADED },
				expected: { isReady: false }
			},
			{
				description: 'returns false when accounts are missing',
				config: { controllerState: ControllerState.CACHE_LOADED_NO_ACCOUNTS },
				expected: { isReady: false }
			},
			{
				description: 'returns false when the controllers are not network-connected',
				config: { controllerState: ControllerState.NOT_CONNECTED },
				expected: { isReady: false }
			}
		];

		readyTests.forEach(test => {
			runReadyTest(test.description, test.config, test.expected);
		});
	});
});

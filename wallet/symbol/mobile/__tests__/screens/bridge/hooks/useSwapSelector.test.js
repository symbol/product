import { useSwapSelector } from '@/app/screens/bridge/hooks/useSwapSelector';
import { BridgeMode } from '@/app/screens/bridge/types/Bridge';
import { AccountFixtureBuilder } from '__fixtures__/local/AccountFixtureBuilder';
import { NetworkPropertiesFixtureBuilder } from '__fixtures__/local/NetworkPropertiesFixtureBuilder';
import { TokenFixtureBuilder } from '__fixtures__/local/TokenFixtureBuilder';
import { HookTester } from '__tests__/HookTester';
import { runHookContractTest } from '__tests__/hook-tests';
import { createWalletControllerMock } from '__tests__/mock-helpers';
import { act } from '@testing-library/react-native';

// Constants

const CHAIN_NAME_SYMBOL = 'symbol';
const CHAIN_NAME_ETHEREUM = 'ethereum';
const NETWORK_IDENTIFIER = 'testnet';

const BRIDGE_ID_XYM_TO_WXYM = 'symbol-xym-ethereum-wxym';
const BRIDGE_ID_XYM_TO_ETH = 'symbol-xym-ethereum-eth';

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

// Bridge Fixtures

const createBridgeMock = id => ({
	id,
	estimateFee: jest.fn(),
	createTransaction: jest.fn()
});

const bridgeXymToWxym = createBridgeMock(BRIDGE_ID_XYM_TO_WXYM);
const bridgeXymToEth = createBridgeMock(BRIDGE_ID_XYM_TO_ETH);

// Token Fixtures

const swapTokenXym = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME_SYMBOL, NETWORK_IDENTIFIER, 0)
	.setAmount('1000000000')
	.build();

const swapTokenWxym = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME_ETHEREUM, NETWORK_IDENTIFIER, 1)
	.setAmount('500000000')
	.build();

const swapTokenEth = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME_ETHEREUM, NETWORK_IDENTIFIER, 0)
	.setAmount('2000000000')
	.build();

const swapTokenXymUpdated = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME_SYMBOL, NETWORK_IDENTIFIER, 0)
	.setAmount('9999999')
	.build();

// Swap Side Fixtures

const swapSideSymbolXym = {
	token: swapTokenXym,
	chainName: CHAIN_NAME_SYMBOL,
	networkIdentifier: NETWORK_IDENTIFIER,
	walletController: symbolWalletController
};

const swapSideEthereumWxym = {
	token: swapTokenWxym,
	chainName: CHAIN_NAME_ETHEREUM,
	networkIdentifier: NETWORK_IDENTIFIER,
	walletController: ethereumWalletController
};

const swapSideEthereumEth = {
	token: swapTokenEth,
	chainName: CHAIN_NAME_ETHEREUM,
	networkIdentifier: NETWORK_IDENTIFIER,
	walletController: ethereumWalletController
};

// Swap Pair Fixtures

const swapPairXymToWxym = {
	source: swapSideSymbolXym,
	target: swapSideEthereumWxym,
	bridge: bridgeXymToWxym,
	mode: BridgeMode.WRAP
};

const swapPairWxymToXym = {
	source: swapSideEthereumWxym,
	target: swapSideSymbolXym,
	bridge: bridgeXymToWxym,
	mode: BridgeMode.UNWRAP
};

const swapPairXymToEth = {
	source: swapSideSymbolXym,
	target: swapSideEthereumEth,
	bridge: bridgeXymToEth,
	mode: BridgeMode.WRAP
};

const swapPairEthToXym = {
	source: swapSideEthereumEth,
	target: swapSideSymbolXym,
	bridge: bridgeXymToEth,
	mode: BridgeMode.UNWRAP
};

const swapPairXymToWxymUpdated = {
	...swapPairXymToWxym,
	source: {
		...swapPairXymToWxym.source,
		token: swapTokenXymUpdated
	}
};

// Pair Collections

const pairsEmpty = [];
const pairsSingleWxym = [swapPairXymToWxym];
const pairsBidirectionalWxym = [swapPairXymToWxym, swapPairWxymToXym];
const pairsAll = [
	swapPairXymToWxym,
	swapPairWxymToXym,
	swapPairXymToEth,
	swapPairEthToXym
];

// Hook Helpers

const createHookParams = overrides => ({
	pairs: pairsBidirectionalWxym,
	defaultSourceChainName: CHAIN_NAME_SYMBOL,
	...overrides
});

describe('hooks/useSwapSelector', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	runHookContractTest(useSwapSelector, {
		props: [createHookParams()],
		contract: {
			isReady: 'boolean',
			bridge: 'object',
			mode: 'string',
			source: 'object',
			target: 'object',
			sourceList: 'array',
			targetList: 'array',
			changeSource: 'function',
			changeTarget: 'function',
			reverse: 'function'
		}
	});

	describe('initialization', () => {
		const runInitializationTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const params = createHookParams(config);
				const hookTester = new HookTester(useSwapSelector, [params]);

				// Assert:
				expect(hookTester.currentResult.source).toStrictEqual(expected.source);
				expect(hookTester.currentResult.target).toStrictEqual(expected.target);
				expect(hookTester.currentResult.bridge).toStrictEqual(expected.bridge);
				expect(hookTester.currentResult.mode).toStrictEqual(expected.mode);
				expect(hookTester.currentResult.isReady).toBe(expected.isReady);
			});
		};

		const initializationTests = [
			{
				description: 'sets null state when pairs are empty',
				config: {
					pairs: pairsEmpty,
					defaultSourceChainName: CHAIN_NAME_SYMBOL
				},
				expected: {
					source: null,
					target: null,
					bridge: null,
					mode: null,
					isReady: false
				}
			},
			{
				description: 'falls back to first pair when default source chain is not found',
				config: {
					pairs: pairsSingleWxym,
					defaultSourceChainName: 'unknown-chain'
				},
				expected: {
					source: swapPairXymToWxym.source,
					target: swapPairXymToWxym.target,
					bridge: bridgeXymToWxym,
					mode: BridgeMode.WRAP,
					isReady: true
				}
			}
		];

		initializationTests.forEach(test => {
			runInitializationTest(test.description, test.config, test.expected);
		});
	});

	describe('default pair and bridge selection', () => {
		const runDefaultSelectionTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const params = createHookParams(config);
				const hookTester = new HookTester(useSwapSelector, [params]);

				// Assert:
				expect(hookTester.currentResult.source.chainName).toBe(expected.sourceChainName);
				expect(hookTester.currentResult.source.token.id).toBe(expected.sourceTokenId);
				expect(hookTester.currentResult.target.chainName).toBe(expected.targetChainName);
				expect(hookTester.currentResult.target.token.id).toBe(expected.targetTokenId);
				expect(hookTester.currentResult.bridge).toBe(expected.bridge);
				expect(hookTester.currentResult.mode).toBe(expected.mode);
			});
		};

		const defaultSelectionTests = [
			{
				description: 'selects wrap direction for symbol as default source',
				config: { pairs: pairsBidirectionalWxym, defaultSourceChainName: CHAIN_NAME_SYMBOL },
				expected: {
					sourceChainName: CHAIN_NAME_SYMBOL,
					sourceTokenId: swapTokenXym.id,
					targetChainName: CHAIN_NAME_ETHEREUM,
					targetTokenId: swapTokenWxym.id,
					bridge: bridgeXymToWxym,
					mode: BridgeMode.WRAP
				}
			},
			{
				description: 'selects unwrap direction for ethereum as default source',
				config: { pairs: pairsBidirectionalWxym, defaultSourceChainName: CHAIN_NAME_ETHEREUM },
				expected: {
					sourceChainName: CHAIN_NAME_ETHEREUM,
					sourceTokenId: swapTokenWxym.id,
					targetChainName: CHAIN_NAME_SYMBOL,
					targetTokenId: swapTokenXym.id,
					bridge: bridgeXymToWxym,
					mode: BridgeMode.UNWRAP
				}
			}
		];

		defaultSelectionTests.forEach(test => {
			runDefaultSelectionTest(test.description, test.config, test.expected);
		});
	});

	describe('selection updates', () => {
		const runSelectionUpdateTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const params = createHookParams({
					pairs: config.pairs,
					defaultSourceChainName: config.defaultSourceChainName
				});
				const hookTester = new HookTester(useSwapSelector, [params]);

				// Act:
				act(() => {
					if (config.changeSource)
						hookTester.currentResult.changeSource(config.changeSource);

					if (config.changeTarget)
						hookTester.currentResult.changeTarget(config.changeTarget);
				});

				// Assert:
				expect(hookTester.currentResult.source).toStrictEqual(expected.source);
				expect(hookTester.currentResult.target).toStrictEqual(expected.target);
				expect(hookTester.currentResult.sourceList).toStrictEqual(expected.sourceList);
				expect(hookTester.currentResult.targetList).toStrictEqual(expected.targetList);
				expect(hookTester.currentResult.bridge).toBe(expected.bridge);
				expect(hookTester.currentResult.mode).toBe(expected.mode);
				expect(hookTester.currentResult.isReady).toBe(expected.isReady);
			});
		};

		const selectionUpdateTests = [
			{
				description: 'ignores invalid source selection and keeps current state',
				config: {
					pairs: pairsSingleWxym,
					defaultSourceChainName: CHAIN_NAME_SYMBOL,
					changeSource: swapSideEthereumEth
				},
				expected: {
					source: swapSideSymbolXym,
					target: swapSideEthereumWxym,
					sourceList: [swapSideSymbolXym],
					targetList: [swapSideEthereumWxym],
					bridge: bridgeXymToWxym,
					mode: BridgeMode.WRAP,
					isReady: true
				}
			},
			{
				description: 'updates target to ETH maintaining symbol XYM source',
				config: {
					pairs: pairsAll,
					defaultSourceChainName: CHAIN_NAME_SYMBOL,
					changeTarget: swapSideEthereumEth
				},
				expected: {
					source: swapSideSymbolXym,
					target: swapSideEthereumEth,
					sourceList: [swapSideSymbolXym],
					targetList: [
						swapSideEthereumWxym,
						swapSideEthereumEth
					],
					bridge: bridgeXymToEth,
					mode: BridgeMode.WRAP,
					isReady: true
				}
			},
			{
				description: 'switches from wrap to unwrap by changing both source and target',
				config: {
					pairs: pairsBidirectionalWxym,
					defaultSourceChainName: CHAIN_NAME_SYMBOL,
					changeSource: swapSideEthereumWxym,
					changeTarget: swapSideSymbolXym
				},
				expected: {
					source: swapSideEthereumWxym,
					target: swapSideSymbolXym,
					sourceList: [swapSideEthereumWxym],
					targetList: [swapSideSymbolXym],
					bridge: bridgeXymToWxym,
					mode: BridgeMode.UNWRAP,
					isReady: true
				}
			},
			{
				description: 'changes ethereum source from WXYM to ETH keeping XYM target',
				config: {
					pairs: pairsAll,
					defaultSourceChainName: CHAIN_NAME_ETHEREUM,
					changeSource: swapSideEthereumEth
				},
				expected: {
					source: swapSideEthereumEth,
					target: swapSideSymbolXym,
					sourceList: [
						swapSideEthereumWxym,
						swapSideEthereumEth
					],
					targetList: [swapSideSymbolXym],
					bridge: bridgeXymToEth,
					mode: BridgeMode.UNWRAP,
					isReady: true
				}
			},
			{
				description: 'switches from unwrap to wrap with cross-chain token change',
				config: {
					pairs: pairsAll,
					defaultSourceChainName: CHAIN_NAME_ETHEREUM,
					changeSource: swapSideSymbolXym,
					changeTarget: swapSideEthereumEth
				},
				expected: {
					source: swapSideSymbolXym,
					target: swapSideEthereumEth,
					sourceList: [swapSideSymbolXym],
					targetList: [
						swapSideEthereumWxym,
						swapSideEthereumEth
					],
					bridge: bridgeXymToEth,
					mode: BridgeMode.WRAP,
					isReady: true
				}
			}
		];

		selectionUpdateTests.forEach(test => {
			runSelectionUpdateTest(test.description, test.config, test.expected);
		});
	});

	describe('reverse', () => {
		const runReverseTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const hookTester = new HookTester(useSwapSelector, [createHookParams({
					pairs: pairsBidirectionalWxym,
					defaultSourceChainName: CHAIN_NAME_SYMBOL
				})]);
				const initialSource = hookTester.currentResult.source;
				const initialTarget = hookTester.currentResult.target;

				// Act:
				for (let i = 0; i < config.reverseCount; i++) {
					act(() => {
						hookTester.currentResult.reverse();
					});
				}

				// Assert:
				if (expected.isFinalValuesReversed) {
					expect(hookTester.currentResult.source).toStrictEqual(initialTarget);
					expect(hookTester.currentResult.target).toStrictEqual(initialSource);
				} else {
					expect(hookTester.currentResult.source).toStrictEqual(initialSource);
					expect(hookTester.currentResult.target).toStrictEqual(initialTarget);
				}
			});
		};

		const reverseTests = [
			{
				description: 'reverses source and target correctly',
				config: { reverseCount: 1 },
				expected: { isFinalValuesReversed: true }
			},
			{
				description: 'reverses back to initial state on second reverse',
				config: { reverseCount: 2 },
				expected: { isFinalValuesReversed: false }
			}
		];

		reverseTests.forEach(test => {
			runReverseTest(test.description, test.config, test.expected);
		});
	});

	describe('pair updates', () => {
		it('refreshes selected side balance when pairs are rerendered', async () => {
			// Arrange:
			const params = createHookParams({
				pairs: pairsSingleWxym,
				defaultSourceChainName: CHAIN_NAME_SYMBOL
			});
			const hookTester = new HookTester(useSwapSelector, [params]);

			// Act:
			act(() => {
				hookTester.updateProps([{
					pairs: [swapPairXymToWxymUpdated],
					defaultSourceChainName: CHAIN_NAME_SYMBOL
				}]);
			});

			// Assert:
			await hookTester.waitFor(() => {
				expect(hookTester.currentResult.source.token.amount).toBe(swapTokenXymUpdated.amount);
			});
		});

		it('resets hook state when pairs become empty', async () => {
			// Arrange:
			const params = createHookParams({
				pairs: pairsBidirectionalWxym,
				defaultSourceChainName: CHAIN_NAME_SYMBOL
			});
			const hookTester = new HookTester(useSwapSelector, [params]);

			// Act:
			act(() => {
				hookTester.updateProps([{
					pairs: pairsEmpty,
					defaultSourceChainName: CHAIN_NAME_SYMBOL
				}]);
			});

			// Assert:
			await hookTester.waitFor(() => {
				expect(hookTester.currentResult.source).toBeNull();
				expect(hookTester.currentResult.target).toBeNull();
				expect(hookTester.currentResult.bridge).toBeNull();
				expect(hookTester.currentResult.mode).toBeNull();
				expect(hookTester.currentResult.sourceList).toStrictEqual([]);
				expect(hookTester.currentResult.targetList).toStrictEqual([]);
				expect(hookTester.currentResult.isReady).toBe(false);
			});
		});

		it('keeps previous state when selected pair no longer exists in updated pairs', async () => {
			// Arrange:
			const params = createHookParams({
				pairs: pairsAll,
				defaultSourceChainName: CHAIN_NAME_SYMBOL
			});
			const hookTester = new HookTester(useSwapSelector, [params]);

			// Change to XYM -> ETH pair
			act(() => {
				hookTester.currentResult.changeTarget(swapSideEthereumEth);
			});

			const previousSource = hookTester.currentResult.source;
			const previousTarget = hookTester.currentResult.target;

			// Act: Update pairs to only include WXYM pairs
			act(() => {
				hookTester.updateProps([{
					pairs: pairsBidirectionalWxym,
					defaultSourceChainName: CHAIN_NAME_SYMBOL
				}]);
			});

			// Assert: Should keep previous state since selected pair no longer exists
			await hookTester.waitFor(() => {
				expect(hookTester.currentResult.source).toBe(previousSource);
				expect(hookTester.currentResult.target).toBe(previousTarget);
			});
		});
	});
});

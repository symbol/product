import { useSwapSelector } from '@/app/screens/bridge/hooks/useSwapSelector';
import { BridgeMode } from '@/app/screens/bridge/types/Bridge';
import { AccountFixtureBuilder } from '__fixtures__/local/AccountFixtureBuilder';
import { NetworkPropertiesFixtureBuilder } from '__fixtures__/local/NetworkPropertiesFixtureBuilder';
import { TokenFixtureBuilder } from '__fixtures__/local/TokenFixtureBuilder';
import { HookTester } from '__tests__/HookTester';
import { createWalletControllerMock } from '__tests__/mock-helpers';
import { act } from '@testing-library/react-native';
import { runHookContractTest } from '__tests__/hook-tests';

// Constants

const CHAIN_NAME_SYMBOL = 'symbol';
const CHAIN_NAME_ETHEREUM = 'ethereum';
const NETWORK_IDENTIFIER = 'testnet';

const BRIDGE_ID_XYM_TO_WXYM = 'symbol-xym-ethereum-wxym';
const BRIDGE_ID_XYM_TO_ETH = 'symbol-xym-ethereum-eth';

// Account Fixtures

const SYMBOL_ACCOUNT = AccountFixtureBuilder
    .createWithAccount(CHAIN_NAME_SYMBOL, NETWORK_IDENTIFIER, 0)
    .build();

const ETHEREUM_ACCOUNT = AccountFixtureBuilder
    .createWithAccount(CHAIN_NAME_ETHEREUM, NETWORK_IDENTIFIER, 0)
    .build();

// Network Properties Fixtures

const SYMBOL_NETWORK_PROPERTIES = NetworkPropertiesFixtureBuilder
    .createWithType(CHAIN_NAME_SYMBOL, NETWORK_IDENTIFIER)
    .build();

const ETHEREUM_NETWORK_PROPERTIES = NetworkPropertiesFixtureBuilder
    .createWithType(CHAIN_NAME_ETHEREUM, NETWORK_IDENTIFIER)
    .build();

// Wallet Controller Fixtures

const SYMBOL_WALLET_CONTROLLER = createWalletControllerMock({
    chainName: CHAIN_NAME_SYMBOL,
    networkIdentifier: NETWORK_IDENTIFIER,
    networkProperties: SYMBOL_NETWORK_PROPERTIES,
    currentAccount: SYMBOL_ACCOUNT
});

const ETHEREUM_WALLET_CONTROLLER = createWalletControllerMock({
    chainName: CHAIN_NAME_ETHEREUM,
    networkIdentifier: NETWORK_IDENTIFIER,
    networkProperties: ETHEREUM_NETWORK_PROPERTIES,
    currentAccount: ETHEREUM_ACCOUNT
});

// Bridge Fixtures

const createBridgeMock = id => ({
    id,
    estimateFee: jest.fn(),
    createTransaction: jest.fn()
});

const BRIDGE_XYM_TO_WXYM = createBridgeMock(BRIDGE_ID_XYM_TO_WXYM);
const BRIDGE_XYM_TO_ETH = createBridgeMock(BRIDGE_ID_XYM_TO_ETH);

// Token Fixtures

const SWAP_TOKEN_XYM = TokenFixtureBuilder
    .createWithToken(CHAIN_NAME_SYMBOL, NETWORK_IDENTIFIER, 0)
    .setAmount('1000000000')
    .build();

const SWAP_TOKEN_WXYM = TokenFixtureBuilder
    .createWithToken(CHAIN_NAME_ETHEREUM, NETWORK_IDENTIFIER, 1)
    .setAmount('500000000')
    .build();

const SWAP_TOKEN_ETH = TokenFixtureBuilder
    .createWithToken(CHAIN_NAME_ETHEREUM, NETWORK_IDENTIFIER, 0)
    .setAmount('2000000000')
    .build();

const SWAP_TOKEN_XYM_UPDATED = TokenFixtureBuilder
    .createWithToken(CHAIN_NAME_SYMBOL, NETWORK_IDENTIFIER, 0)
    .setAmount('9999999')
    .build();

// Swap Side Fixtures

const SWAP_SIDE_SYMBOL_XYM = {
    token: SWAP_TOKEN_XYM,
    chainName: CHAIN_NAME_SYMBOL,
    networkIdentifier: NETWORK_IDENTIFIER,
    walletController: SYMBOL_WALLET_CONTROLLER
};

const SWAP_SIDE_ETHEREUM_WXYM = {
    token: SWAP_TOKEN_WXYM,
    chainName: CHAIN_NAME_ETHEREUM,
    networkIdentifier: NETWORK_IDENTIFIER,
    walletController: ETHEREUM_WALLET_CONTROLLER
};

const SWAP_SIDE_ETHEREUM_ETH = {
    token: SWAP_TOKEN_ETH,
    chainName: CHAIN_NAME_ETHEREUM,
    networkIdentifier: NETWORK_IDENTIFIER,
    walletController: ETHEREUM_WALLET_CONTROLLER
};

// Swap Pair Fixtures

const SWAP_PAIR_XYM_TO_WXYM = {
    source: SWAP_SIDE_SYMBOL_XYM,
    target: SWAP_SIDE_ETHEREUM_WXYM,
    bridge: BRIDGE_XYM_TO_WXYM,
    mode: BridgeMode.WRAP
};

const SWAP_PAIR_WXYM_TO_XYM = {
    source: SWAP_SIDE_ETHEREUM_WXYM,
    target: SWAP_SIDE_SYMBOL_XYM,
    bridge: BRIDGE_XYM_TO_WXYM,
    mode: BridgeMode.UNWRAP
};

const SWAP_PAIR_XYM_TO_ETH = {
    source: SWAP_SIDE_SYMBOL_XYM,
    target: SWAP_SIDE_ETHEREUM_ETH,
    bridge: BRIDGE_XYM_TO_ETH,
    mode: BridgeMode.WRAP
};

const SWAP_PAIR_ETH_TO_XYM = {
    source: SWAP_SIDE_ETHEREUM_ETH,
    target: SWAP_SIDE_SYMBOL_XYM,
    bridge: BRIDGE_XYM_TO_ETH,
    mode: BridgeMode.UNWRAP
};

const SWAP_PAIR_XYM_TO_WXYM_UPDATED = {
    ...SWAP_PAIR_XYM_TO_WXYM,
    source: {
        ...SWAP_PAIR_XYM_TO_WXYM.source,
        token: SWAP_TOKEN_XYM_UPDATED
    }
};

// Pair Collections

const PAIRS_EMPTY = [];
const PAIRS_SINGLE_WXYM = [SWAP_PAIR_XYM_TO_WXYM];
const PAIRS_BIDIRECTIONAL_WXYM = [SWAP_PAIR_XYM_TO_WXYM, SWAP_PAIR_WXYM_TO_XYM];
const PAIRS_ALL = [
    SWAP_PAIR_XYM_TO_WXYM,
    SWAP_PAIR_WXYM_TO_XYM,
    SWAP_PAIR_XYM_TO_ETH,
    SWAP_PAIR_ETH_TO_XYM
];

// Hook Helpers

const createHookParams = overrides => ({
    pairs: PAIRS_BIDIRECTIONAL_WXYM,
    defaultSourceChainName: CHAIN_NAME_SYMBOL,
    ...overrides
});

describe('hooks/useSwapSelector', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    runHookContractTest(useSwapSelector, {
        props: createHookParams(),
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
                    pairs: PAIRS_EMPTY,
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
                    pairs: PAIRS_SINGLE_WXYM,
                    defaultSourceChainName: 'unknown-chain'
                },
                expected: {
                    source: SWAP_PAIR_XYM_TO_WXYM.source,
                    target: SWAP_PAIR_XYM_TO_WXYM.target,
                    bridge: BRIDGE_XYM_TO_WXYM,
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
                config: { pairs: PAIRS_BIDIRECTIONAL_WXYM, defaultSourceChainName: CHAIN_NAME_SYMBOL },
                expected: {
                    sourceChainName: CHAIN_NAME_SYMBOL,
                    sourceTokenId: SWAP_TOKEN_XYM.id,
                    targetChainName: CHAIN_NAME_ETHEREUM,
                    targetTokenId: SWAP_TOKEN_WXYM.id,
                    bridge: BRIDGE_XYM_TO_WXYM,
                    mode: BridgeMode.WRAP
                }
            },
            {
                description: 'selects unwrap direction for ethereum as default source',
                config: { pairs: PAIRS_BIDIRECTIONAL_WXYM, defaultSourceChainName: CHAIN_NAME_ETHEREUM },
                expected: {
                    sourceChainName: CHAIN_NAME_ETHEREUM,
                    sourceTokenId: SWAP_TOKEN_WXYM.id,
                    targetChainName: CHAIN_NAME_SYMBOL,
                    targetTokenId: SWAP_TOKEN_XYM.id,
                    bridge: BRIDGE_XYM_TO_WXYM,
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
                    pairs: PAIRS_SINGLE_WXYM,
                    defaultSourceChainName: CHAIN_NAME_SYMBOL,
                    changeSource: SWAP_SIDE_ETHEREUM_ETH
                },
                expected: {
                    source: SWAP_SIDE_SYMBOL_XYM,
                    target: SWAP_SIDE_ETHEREUM_WXYM,
                    sourceList: [SWAP_SIDE_SYMBOL_XYM],
                    targetList: [SWAP_SIDE_ETHEREUM_WXYM],
                    bridge: BRIDGE_XYM_TO_WXYM,
                    mode: BridgeMode.WRAP,
                    isReady: true
                }
            },
            {
                description: 'updates target to ETH maintaining symbol XYM source',
                config: {
                    pairs: PAIRS_ALL,
                    defaultSourceChainName: CHAIN_NAME_SYMBOL,
                    changeTarget: SWAP_SIDE_ETHEREUM_ETH
                },
                expected: {
                    source: SWAP_SIDE_SYMBOL_XYM,
                    target: SWAP_SIDE_ETHEREUM_ETH,
                    sourceList: [SWAP_SIDE_SYMBOL_XYM],
                    targetList: [
                        SWAP_SIDE_ETHEREUM_WXYM,
                        SWAP_SIDE_ETHEREUM_ETH
                    ],
                    bridge: BRIDGE_XYM_TO_ETH,
                    mode: BridgeMode.WRAP,
                    isReady: true
                }
            },
            {
                description: 'switches from wrap to unwrap by changing both source and target',
                config: {
                    pairs: PAIRS_BIDIRECTIONAL_WXYM,
                    defaultSourceChainName: CHAIN_NAME_SYMBOL,
                    changeSource: SWAP_SIDE_ETHEREUM_WXYM,
                    changeTarget: SWAP_SIDE_SYMBOL_XYM
                },
                expected: {
                    source: SWAP_SIDE_ETHEREUM_WXYM,
                    target: SWAP_SIDE_SYMBOL_XYM,
                    sourceList: [SWAP_SIDE_ETHEREUM_WXYM],
                    targetList: [SWAP_SIDE_SYMBOL_XYM],
                    bridge: BRIDGE_XYM_TO_WXYM,
                    mode: BridgeMode.UNWRAP,
                    isReady: true
                }
            },
            {
                description: 'changes ethereum source from WXYM to ETH keeping XYM target',
                config: {
                    pairs: PAIRS_ALL,
                    defaultSourceChainName: CHAIN_NAME_ETHEREUM,
                    changeSource: SWAP_SIDE_ETHEREUM_ETH
                },
                expected: {
                    source: SWAP_SIDE_ETHEREUM_ETH,
                    target: SWAP_SIDE_SYMBOL_XYM,
                    sourceList: [
                        SWAP_SIDE_ETHEREUM_WXYM,
                        SWAP_SIDE_ETHEREUM_ETH
                    ],
                    targetList: [SWAP_SIDE_SYMBOL_XYM],
                    bridge: BRIDGE_XYM_TO_ETH,
                    mode: BridgeMode.UNWRAP,
                    isReady: true
                }
            },
            {
                description: 'switches from unwrap to wrap with cross-chain token change',
                config: {
                    pairs: PAIRS_ALL,
                    defaultSourceChainName: CHAIN_NAME_ETHEREUM,
                    changeSource: SWAP_SIDE_SYMBOL_XYM,
                    changeTarget: SWAP_SIDE_ETHEREUM_ETH
                },
                expected: {
                    source: SWAP_SIDE_SYMBOL_XYM,
                    target: SWAP_SIDE_ETHEREUM_ETH,
                    sourceList: [SWAP_SIDE_SYMBOL_XYM],
                    targetList: [
                        SWAP_SIDE_ETHEREUM_WXYM,
                        SWAP_SIDE_ETHEREUM_ETH
                    ],
                    bridge: BRIDGE_XYM_TO_ETH,
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
                    pairs: PAIRS_BIDIRECTIONAL_WXYM,
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
                pairs: PAIRS_SINGLE_WXYM,
                defaultSourceChainName: CHAIN_NAME_SYMBOL
            });
            const hookTester = new HookTester(useSwapSelector, [params]);

            // Act:
            act(() => {
                hookTester.updateProps([{
                    pairs: [SWAP_PAIR_XYM_TO_WXYM_UPDATED],
                    defaultSourceChainName: CHAIN_NAME_SYMBOL
                }]);
            });

            // Assert:
            await hookTester.waitFor(() => {
                expect(hookTester.currentResult.source.token.amount).toBe(SWAP_TOKEN_XYM_UPDATED.amount);
            });
        });

        it('resets hook state when pairs become empty', async () => {
            // Arrange:
            const params = createHookParams({
                pairs: PAIRS_BIDIRECTIONAL_WXYM,
                defaultSourceChainName: CHAIN_NAME_SYMBOL
            });
            const hookTester = new HookTester(useSwapSelector, [params]);

            // Act:
            act(() => {
                hookTester.updateProps([{
                    pairs: PAIRS_EMPTY,
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
                pairs: PAIRS_ALL,
                defaultSourceChainName: CHAIN_NAME_SYMBOL
            });
            const hookTester = new HookTester(useSwapSelector, [params]);

            // Change to XYM -> ETH pair
            act(() => {
                hookTester.currentResult.changeTarget(SWAP_SIDE_ETHEREUM_ETH);
            });

            const previousSource = hookTester.currentResult.source;
            const previousTarget = hookTester.currentResult.target;

            // Act: Update pairs to only include WXYM pairs
            act(() => {
                hookTester.updateProps([{
                    pairs: PAIRS_BIDIRECTIONAL_WXYM,
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

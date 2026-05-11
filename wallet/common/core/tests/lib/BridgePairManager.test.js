import { BridgePairManager } from '../../src/lib/bridge/BridgePairManager';
import { TransactionBundle } from '../../src/lib/models/TransactionBundle';
import { jest } from '@jest/globals';

// Bridge / Network constants

const BRIDGE_URL = 'https://bridge.example.com';
const NETWORK_IDENTIFIER = 'testnet';
const CUSTOM_ID = 'my-custom-bridge-pair-id';

// Symbol (native) chain constants

const SYMBOL_CHAIN_NAME = 'symbol';
const SYMBOL_TOKEN_ID = '72C0212E67A08BCE';
const SYMBOL_BRIDGE_ADDRESS_RAW = 'TBQAAMLT4R6TPIZVWERYURELILHHMCERDWZ4FCQ';
const SYMBOL_BRIDGE_ADDRESS = 'TBQAAMLT4R6TPIZVWERYURELILHHMCERDWZ4FCQ'; // already uppercase, no dashes

// Ethereum (wrapped) chain constants

const ETHEREUM_CHAIN_NAME = 'ethereum';
const ETHEREUM_TOKEN_ID = '0x5E8343A455F03109B737B6D8b410e4ECCE998cdA';
const ETHEREUM_BRIDGE_ADDRESS_RAW = '0x9B5b717FEC711af80050986D1306D5c8Fb9FA953';
const ETHEREUM_BRIDGE_ADDRESS = '0x9b5b717fec711af80050986d1306d5c8fb9fa953'; // normalized lowercase

// Account addresses

const SYMBOL_ACCOUNT_ADDRESS = 'TBJP7DIASQUWRMNHZYW7P5XU6QCGZDBHDVK3T4Y';
const ETHEREUM_ACCOUNT_ADDRESS = '0xeCA7dadA410614B604FFcBE0378C05474b0aeD8D';
const ETHEREUM_ACCOUNT_ADDRESS_NORMALIZED = '0xeca7dada410614b604ffcbe0378c05474b0aed8d';

// Account fixtures

const symbolCurrentAccount = {
	address: SYMBOL_ACCOUNT_ADDRESS,
	publicKey: 'symbolPublicKey1234'
};

const ethereumCurrentAccount = {
	address: ETHEREUM_ACCOUNT_ADDRESS,
	publicKey: 'ethereumPublicKey5678'
};

// Network properties fixtures

const symbolNetworkProperties = { chainId: 'symbol-testnet', nodeUrl: 'https://symbol-node.example.com' };
const ethereumNetworkProperties = { chainId: 'ethereum-testnet', nodeUrl: 'https://eth-node.example.com' };

// SDK fixtures

const symbolSdk = {
	normalizeAddress: address => address.replace(/-/g, '').toUpperCase(),
	normalizeTransactionHash: hash => hash.toUpperCase()
};

const ethereumSdk = {
	normalizeAddress: address => {
		const lower = address.toLowerCase();
		return lower.startsWith('0x') ? lower : `0x${lower}`;
	},
	normalizeTransactionHash: hash => {
		const lower = hash.toLowerCase();
		return lower.startsWith('0x') ? lower : `0x${lower}`;
	}
};

// Factory functions

const createTokenInfo = (id, divisibility = 6) => ({ id, name: id, divisibility });

const createConfigResponse = (overrides = {}) => ({
	enabled: true,
	nativeNetwork: {
		blockchain: SYMBOL_CHAIN_NAME,
		bridgeAddress: SYMBOL_BRIDGE_ADDRESS_RAW,
		defaultNodeUrl: 'https://symbol-node.example.com',
		explorerUrl: 'https://symbol-explorer.example.com',
		network: NETWORK_IDENTIFIER,
		tokenId: SYMBOL_TOKEN_ID
	},
	wrappedNetwork: {
		blockchain: ETHEREUM_CHAIN_NAME,
		bridgeAddress: ETHEREUM_BRIDGE_ADDRESS_RAW,
		defaultNodeUrl: 'https://eth-node.example.com',
		explorerUrl: 'https://eth-explorer.example.com',
		network: NETWORK_IDENTIFIER,
		tokenId: ETHEREUM_TOKEN_ID
	},
	...overrides
});

const createEstimationResponse = (totalFee, netAmount) => ({
	conversionFee: '0.001',
	grossAmount: '10000000',
	transactionFee: '0.01',
	totalFee,
	netAmount
});

const createNativeController = (overrides = {}) => ({
	chainName: SYMBOL_CHAIN_NAME,
	networkIdentifier: NETWORK_IDENTIFIER,
	networkProperties: symbolNetworkProperties,
	currentAccount: symbolCurrentAccount,
	isWalletReady: true,
	fetchAccountTransactions: jest.fn(async () => []),
	walletSdk: symbolSdk,
	...overrides
});

const createWrappedController = (overrides = {}) => ({
	chainName: ETHEREUM_CHAIN_NAME,
	networkIdentifier: NETWORK_IDENTIFIER,
	networkProperties: ethereumNetworkProperties,
	currentAccount: ethereumCurrentAccount,
	isWalletReady: true,
	fetchAccountTransactions: jest.fn(async () => []),
	walletSdk: ethereumSdk,
	...overrides
});

const createNativeBridgeHelper = (overrides = {}) => ({
	fetchTokenInfo: jest.fn(async (networkProperties, tokenId) => createTokenInfo(tokenId)),
	createTransaction: jest.fn(),
	...overrides
});

const createWrappedBridgeHelper = (overrides = {}) => ({
	fetchTokenInfo: jest.fn(async (networkProperties, tokenId) => createTokenInfo(tokenId)),
	createTransaction: jest.fn(),
	...overrides
});

const createManager = (overrides = {}) => {
	const makeRequest = overrides.makeRequest ?? jest.fn();
	const nativeWalletController = overrides.nativeWalletController ?? createNativeController();
	const wrappedWalletController = overrides.wrappedWalletController ?? createWrappedController();
	const nativeBridgeHelper = overrides.nativeBridgeHelper ?? createNativeBridgeHelper();
	const wrappedBridgeHelper = overrides.wrappedBridgeHelper ?? createWrappedBridgeHelper();

	const manager = new BridgePairManager({
		nativeWalletController,
		wrappedWalletController,
		nativeBridgeHelper,
		wrappedBridgeHelper,
		bridgeUrls: { [NETWORK_IDENTIFIER]: BRIDGE_URL },
		makeRequest,
		mode: 'wrap',
		...overrides.managerOptions
	});

	return {
		manager,
		makeRequest,
		nativeWalletController,
		wrappedWalletController,
		nativeBridgeHelper,
		wrappedBridgeHelper
	};
};

const createLoadedManager = async (overrides = {}) => {
	const mocks = createManager(overrides);
	mocks.makeRequest.mockResolvedValueOnce(createConfigResponse());
	await mocks.manager.load();
	return mocks;
};

// Helper – constructs the URL the BridgeApi builds for paginated GET requests
const buildPageUrl = (mode, group, address, { pageSize = 15, pageNumber = 1 } = {}) => {
	const count = pageSize;
	const offset = (pageNumber - 1) * pageSize;
	return `${BRIDGE_URL}/${mode}/${group}/${address}?count=${count}&offset=${offset}`;
};

// Tests

describe('bridge/BridgePairManager', () => {
	afterEach(() => {
		jest.restoreAllMocks();
		jest.clearAllMocks();
	});

	// Constructor

	describe('constructor', () => {
		it('throws when mode is invalid', () => {
			// Arrange & Act & Assert:
			expect(() => createManager({ managerOptions: { mode: 'invalid' } }))
				.toThrow('Invalid bridge mode: invalid. Must be \'wrap\' or \'unwrap\'');
		});

		it('does not throw when mode is wrap', () => {
			// Arrange & Act & Assert:
			expect(() => createManager({ managerOptions: { mode: 'wrap' } })).not.toThrow();
		});

		it('does not throw when mode is unwrap', () => {
			// Arrange & Act & Assert:
			expect(() => createManager({ managerOptions: { mode: 'unwrap' } })).not.toThrow();
		});
	});

	// Properties

	describe('properties', () => {
		describe('hasHistory', () => {
			it('returns true', () => {
				// Arrange:
				const { manager } = createManager();

				// Act & Assert:
				expect(manager.hasHistory).toBe(true);
			});
		});

		describe('id', () => {
			it('generates default id from sorted chain names when not specified', () => {
				// Arrange:
				const { manager } = createManager();

				// Act & Assert:
				// chain names: 'symbol' and 'ethereum' → sorted: ['ethereum', 'symbol']
				expect(manager.id).toBe(`${ETHEREUM_CHAIN_NAME}-${SYMBOL_CHAIN_NAME}`);
			});

			it('uses custom id when specified', () => {
				// Arrange:
				const { manager } = createManager({ managerOptions: { id: CUSTOM_ID } });

				// Act & Assert:
				expect(manager.id).toBe(CUSTOM_ID);
			});
		});

		describe('mode', () => {
			const runModeTest = (description, config, expected) => {
				it(description, () => {
					// Arrange:
					const { manager } = createManager({ managerOptions: { mode: config.mode } });

					// Act & Assert:
					expect(manager.mode).toBe(expected.mode);
				});
			};

			const modeTests = [
				{
					description: 'returns wrap when initialized with wrap mode',
					config: { mode: 'wrap' },
					expected: { mode: 'wrap' }
				},
				{
					description: 'returns unwrap when initialized with unwrap mode',
					config: { mode: 'unwrap' },
					expected: { mode: 'unwrap' }
				}
			];

			modeTests.forEach(test => {
				runModeTest(test.description, test.config, test.expected);
			});
		});

		describe('isEnabled', () => {
			it('returns false before load', () => {
				// Arrange:
				const { manager } = createManager();

				// Act & Assert:
				expect(manager.isEnabled).toBe(false);
			});

			it('returns true after load when config is enabled', async () => {
				// Arrange:
				const { manager } = await createLoadedManager();

				// Act & Assert:
				expect(manager.isEnabled).toBe(true);
			});

			it('returns false after load when config is disabled', async () => {
				// Arrange:
				const mocks = createManager();
				mocks.makeRequest.mockResolvedValueOnce({ ...createConfigResponse(), enabled: false });
				await mocks.manager.load();

				// Act & Assert:
				expect(mocks.manager.isEnabled).toBe(false);
			});
		});

		describe('isReady', () => {
			const runIsReadyTest = (description, config, expected) => {
				it(description, async () => {
					// Arrange:
					const nativeWalletController = createNativeController(config.nativeOverrides ?? {});
					const wrappedWalletController = createWrappedController(config.wrappedOverrides ?? {});
					const mocks = createManager({ nativeWalletController, wrappedWalletController });
					if (config.isLoaded) {
						mocks.makeRequest.mockResolvedValueOnce(createConfigResponse());
						await mocks.manager.load();
					}
					if (config.mutateAfterLoad)
						config.mutateAfterLoad(nativeWalletController, wrappedWalletController);

					// Act & Assert:
					expect(mocks.manager.isReady).toBe(expected.isReady);
				});
			};

			const isReadyTests = [
				{
					description: 'returns false when not loaded and wallets are not ready',
					config: {
						isLoaded: false,
						nativeOverrides: { isWalletReady: false },
						wrappedOverrides: { isWalletReady: false }
					},
					expected: { isReady: false }
				},
				{
					description: 'returns false when wallets are ready but manager is not loaded',
					config: { isLoaded: false },
					expected: { isReady: false }
				},
				{
					description: 'returns true when loaded and both wallets are ready',
					config: { isLoaded: true },
					expected: { isReady: true }
				},
				{
					description: 'returns false when loaded but native wallet is not ready',
					config: {
						isLoaded: true,
						mutateAfterLoad: native => { native.isWalletReady = false; }
					},
					expected: { isReady: false }
				},
				{
					description: 'returns false when loaded but wrapped wallet is not ready',
					config: {
						isLoaded: true,
						mutateAfterLoad: (native, wrapped) => { wrapped.isWalletReady = false; }
					},
					expected: { isReady: false }
				},
				{
					description: 'returns false when loaded but controller network identifiers mismatch',
					config: {
						isLoaded: true,
						mutateAfterLoad: (native, wrapped) => { wrapped.networkIdentifier = 'mainnet'; }
					},
					expected: { isReady: false }
				}
			];

			isReadyTests.forEach(test => {
				runIsReadyTest(test.description, test.config, test.expected);
			});
		});

		describe('config', () => {
			it('returns null before load', () => {
				// Arrange:
				const { manager } = createManager();

				// Act & Assert:
				expect(manager.config).toBeNull();
			});

			it('returns populated config after load', async () => {
				// Arrange:
				const { manager } = await createLoadedManager();

				// Act & Assert:
				expect(manager.config).not.toBeNull();
				expect(manager.config.nativeNetwork.blockchain).toBe(SYMBOL_CHAIN_NAME);
				expect(manager.config.wrappedNetwork.blockchain).toBe(ETHEREUM_CHAIN_NAME);
			});
		});

		describe('nativeTokenInfo and wrappedTokenInfo', () => {
			it('returns null for both before load', () => {
				// Arrange:
				const { manager } = createManager();

				// Act & Assert:
				expect(manager.nativeTokenInfo).toBeNull();
				expect(manager.wrappedTokenInfo).toBeNull();
			});

			it('returns resolved token infos after load', async () => {
				// Arrange:
				const { manager } = await createLoadedManager();

				// Act & Assert:
				expect(manager.nativeTokenInfo).toStrictEqual(createTokenInfo(SYMBOL_TOKEN_ID));
				expect(manager.wrappedTokenInfo).toStrictEqual(createTokenInfo(ETHEREUM_TOKEN_ID));
			});
		});

		describe('nativeWalletController and wrappedWalletController', () => {
			it('returns respective controller instances', () => {
				// Arrange:
				const nativeWalletController = createNativeController();
				const wrappedWalletController = createWrappedController();
				const { manager } = createManager({ nativeWalletController, wrappedWalletController });

				// Act & Assert:
				expect(manager.nativeWalletController).toBe(nativeWalletController);
				expect(manager.wrappedWalletController).toBe(wrappedWalletController);
			});
		});

		describe('sourceWalletController and targetWalletController', () => {
			const runDirectionalControllersTest = (description, config, expected) => {
				it(description, () => {
					// Arrange:
					const nativeWalletController = createNativeController();
					const wrappedWalletController = createWrappedController();
					const { manager } = createManager({
						nativeWalletController,
						wrappedWalletController,
						managerOptions: { mode: config.mode }
					});

					// Act & Assert:
					expect(manager.sourceWalletController).toBe(expected.source === 'native'
						? nativeWalletController
						: wrappedWalletController);
					expect(manager.targetWalletController).toBe(expected.target === 'native'
						? nativeWalletController
						: wrappedWalletController);
				});
			};

			const directionalTests = [
				{
					description: 'wrap mode: source is native, target is wrapped',
					config: { mode: 'wrap' },
					expected: { source: 'native', target: 'wrapped' }
				},
				{
					description: 'unwrap mode: source is wrapped, target is native',
					config: { mode: 'unwrap' },
					expected: { source: 'wrapped', target: 'native' }
				}
			];

			directionalTests.forEach(test => {
				runDirectionalControllersTest(test.description, test.config, test.expected);
			});
		});

		describe('getWalletController', () => {
			it('returns respective controllers by chain name and null for unknown chain', () => {
				// Arrange:
				const nativeWalletController = createNativeController();
				const wrappedWalletController = createWrappedController();
				const { manager } = createManager({ nativeWalletController, wrappedWalletController });

				// Act:
				const nativeResult = manager.getWalletController(SYMBOL_CHAIN_NAME);
				const wrappedResult = manager.getWalletController(ETHEREUM_CHAIN_NAME);
				const unknownResult = manager.getWalletController('unknown');

				// Assert:
				expect(nativeResult).toBe(nativeWalletController);
				expect(wrappedResult).toBe(wrappedWalletController);
				expect(unknownResult).toBeNull();
			});
		});
	});

	// Load

	describe('load', () => {
		it('fetches config, resolves token infos, and normalizes bridge addresses', async () => {
			// Arrange:
			const configResponse = createConfigResponse();
			const mocks = createManager();
			mocks.makeRequest.mockResolvedValueOnce(configResponse);
			mocks.nativeBridgeHelper.fetchTokenInfo.mockImplementation(async (networkProperties, tokenId) =>
				createTokenInfo(tokenId));
			mocks.wrappedBridgeHelper.fetchTokenInfo.mockImplementation(async (networkProperties, tokenId) =>
				createTokenInfo(tokenId));

			// Act:
			await mocks.manager.load();

			// Assert:
			expect(mocks.makeRequest).toHaveBeenCalledWith(`${BRIDGE_URL}/`);
			expect(mocks.nativeBridgeHelper.fetchTokenInfo).toHaveBeenCalledWith(
				symbolNetworkProperties,
				SYMBOL_TOKEN_ID
			);
			expect(mocks.wrappedBridgeHelper.fetchTokenInfo).toHaveBeenCalledWith(
				ethereumNetworkProperties,
				ETHEREUM_TOKEN_ID
			);
			expect(mocks.manager.nativeTokenInfo).toStrictEqual(createTokenInfo(SYMBOL_TOKEN_ID));
			expect(mocks.manager.wrappedTokenInfo).toStrictEqual(createTokenInfo(ETHEREUM_TOKEN_ID));
			expect(mocks.manager.config.nativeNetwork.bridgeAddress).toBe(SYMBOL_BRIDGE_ADDRESS);
			expect(mocks.manager.config.wrappedNetwork.bridgeAddress).toBe(ETHEREUM_BRIDGE_ADDRESS);
		});

		it('tokenId is removed from config after load', async () => {
			// Arrange:
			const mocks = createManager();
			mocks.makeRequest.mockResolvedValueOnce(createConfigResponse());

			// Act:
			await mocks.manager.load();

			// Assert:
			expect(mocks.manager.config.nativeNetwork.tokenId).toBeUndefined();
			expect(mocks.manager.config.wrappedNetwork.tokenId).toBeUndefined();
			expect(mocks.manager.config.nativeNetwork.tokenInfo).toStrictEqual(createTokenInfo(SYMBOL_TOKEN_ID));
			expect(mocks.manager.config.wrappedNetwork.tokenInfo).toStrictEqual(createTokenInfo(ETHEREUM_TOKEN_ID));
		});

		it('throws when controller network identifiers mismatch', async () => {
			// Arrange:
			const mocks = createManager({
				wrappedWalletController: createWrappedController({ networkIdentifier: 'mainnet' })
			});

			// Act & Assert:
			await expect(mocks.manager.load())
				.rejects.toThrow('Failed to load bridge config. Wallet controller network identifier mismatch.');
		});

		it('throws when native chain name does not match config blockchain', async () => {
			// Arrange:
			const configResponse = createConfigResponse();
			configResponse.nativeNetwork.blockchain = 'nem';
			const mocks = createManager();
			mocks.makeRequest.mockResolvedValueOnce(configResponse);

			// Act & Assert:
			await expect(mocks.manager.load())
				.rejects.toThrow('Failed to load bridge config. Bridge networks do not match wallet controller chains.');
		});

		it('throws when wrapped chain name does not match config blockchain', async () => {
			// Arrange:
			const configResponse = createConfigResponse();
			configResponse.wrappedNetwork.blockchain = 'bitcoin';
			const mocks = createManager();
			mocks.makeRequest.mockResolvedValueOnce(configResponse);

			// Act & Assert:
			await expect(mocks.manager.load())
				.rejects.toThrow('Failed to load bridge config. Bridge networks do not match wallet controller chains.');
		});

		it('throws when native network type does not match controller network identifier', async () => {
			// Arrange:
			const configResponse = createConfigResponse();
			configResponse.nativeNetwork.network = 'mainnet';
			const mocks = createManager();
			mocks.makeRequest.mockResolvedValueOnce(configResponse);

			// Act & Assert:
			await expect(mocks.manager.load())
				.rejects.toThrow('Failed to load bridge config. Bridge networks do not match wallet controller networks.');
		});
	});

	// fetchRequests

	describe('fetchRequests', () => {
		it('throws when no current account is selected', async () => {
			// Arrange:
			const mocks = createManager({
				nativeWalletController: createNativeController({ currentAccount: null })
			});
			mocks.makeRequest.mockResolvedValueOnce(createConfigResponse());
			await mocks.manager.load();

			// Act & Assert:
			await expect(mocks.manager.fetchRequests({ pageSize: 5, pageNumber: 1 }))
				.rejects.toThrow('Failed to fetch bridge requests. No current account selected');
		});

		it('throws when no config is loaded', async () => {
			// Arrange:
			const { manager } = createManager();

			// Act & Assert:
			await expect(manager.fetchRequests({ pageSize: 5, pageNumber: 1 }))
				.rejects.toThrow('Failed to fetch bridge requests. No bridge config fetched');
		});

		const runFetchRequestsTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				const mocks = createManager({ managerOptions: { mode: config.mode } });
				mocks.makeRequest.mockResolvedValueOnce(createConfigResponse());
				await mocks.manager.load();
				mocks.makeRequest.mockResolvedValueOnce(config.dtoResponse);

				// Act:
				const result = await mocks.manager.fetchRequests(config.searchCriteria);

				// Assert:
				const queryAddress = config.mode === 'wrap' ? SYMBOL_ACCOUNT_ADDRESS : ETHEREUM_ACCOUNT_ADDRESS;
				const expectedUrl = buildPageUrl(config.mode, 'requests', queryAddress, config.searchCriteria);
				expect(mocks.makeRequest).toHaveBeenLastCalledWith(expectedUrl);
				expect(result).toStrictEqual(expected.result);
			});
		};

		const wrapRequestDto = {
			senderAddress: SYMBOL_ACCOUNT_ADDRESS,
			destinationAddress: ETHEREUM_ACCOUNT_ADDRESS,
			payoutConversionRate: '1000000',
			payoutNetAmount: '9900000',
			payoutStatus: 2,
			payoutTimestamp: 1750000100.5,
			payoutTotalFee: '100000',
			payoutTransactionHash: 'PAYOUT_HASH_ABC',
			payoutTransactionHeight: 123,
			requestAmount: '10000000',
			requestTimestamp: 1750000000.5,
			requestTransactionHash: 'REQUEST_HASH_XYZ',
			requestTransactionHeight: 999
		};

		const unwrapRequestDto = {
			senderAddress: ETHEREUM_ACCOUNT_ADDRESS,
			destinationAddress: SYMBOL_ACCOUNT_ADDRESS,
			payoutConversionRate: '1000000',
			payoutNetAmount: '9900000',
			payoutStatus: 1,
			payoutTimestamp: 1750001000.9,
			payoutTotalFee: '100000',
			payoutTransactionHash: 'UNWRAP_PAYOUT_HASH',
			payoutTransactionHeight: 55,
			requestAmount: '10000000',
			requestTimestamp: 1750000900.1,
			requestTransactionHash: 'UNWRAP_REQUEST_HASH',
			requestTransactionHeight: 44
		};

		const fetchRequestsTests = [
			{
				description: 'fetches and maps wrap requests with correct chain and token info',
				config: {
					mode: 'wrap',
					searchCriteria: { pageSize: 5, pageNumber: 1 },
					dtoResponse: [wrapRequestDto]
				},
				expected: {
					result: [
						{
							type: 'wrap',
							sourceChainName: SYMBOL_CHAIN_NAME,
							targetChainName: ETHEREUM_CHAIN_NAME,
							sourceTokenInfo: createTokenInfo(SYMBOL_TOKEN_ID),
							targetTokenInfo: createTokenInfo(ETHEREUM_TOKEN_ID),
							payoutStatus: 2,
							payoutConversionRate: '1',
							payoutTotalFee: '0.1',
							requestTransaction: {
								signerAddress: SYMBOL_ACCOUNT_ADDRESS,
								hash: 'REQUEST_HASH_XYZ',
								height: 999,
								timestamp: 1750000000500,
								token: {
									...createTokenInfo(SYMBOL_TOKEN_ID),
									amount: '10'
								}
							},
							payoutTransaction: {
								recipientAddress: ETHEREUM_ACCOUNT_ADDRESS_NORMALIZED,
								hash: '0xpayout_hash_abc',
								height: 123,
								timestamp: 1750000100500,
								token: {
									...createTokenInfo(ETHEREUM_TOKEN_ID),
									amount: '9.9'
								}
							}
						}
					]
				}
			},
			{
				description: 'fetches and maps unwrap requests with reversed chain and token info',
				config: {
					mode: 'unwrap',
					searchCriteria: { pageSize: 3, pageNumber: 2 },
					dtoResponse: [unwrapRequestDto]
				},
				expected: {
					result: [
						{
							type: 'unwrap',
							sourceChainName: ETHEREUM_CHAIN_NAME,
							targetChainName: SYMBOL_CHAIN_NAME,
							sourceTokenInfo: createTokenInfo(ETHEREUM_TOKEN_ID),
							targetTokenInfo: createTokenInfo(SYMBOL_TOKEN_ID),
							payoutStatus: 1,
							payoutConversionRate: '1',
							payoutTotalFee: '0.1',
							requestTransaction: {
								signerAddress: ETHEREUM_ACCOUNT_ADDRESS_NORMALIZED,
								hash: '0xunwrap_request_hash',
								height: 44,
								timestamp: 1750000900100,
								token: {
									...createTokenInfo(ETHEREUM_TOKEN_ID),
									amount: '10'
								}
							},
							payoutTransaction: {
								recipientAddress: SYMBOL_ACCOUNT_ADDRESS,
								hash: 'UNWRAP_PAYOUT_HASH',
								height: 55,
								timestamp: 1750001000900,
								token: {
									...createTokenInfo(SYMBOL_TOKEN_ID),
									amount: '9.9'
								}
							}
						}
					]
				}
			},
			{
				description: 'maps request with null payout transaction when payoutTransactionHash is absent',
				config: {
					mode: 'wrap',
					searchCriteria: { pageSize: 5, pageNumber: 1 },
					dtoResponse: [
						{
							...wrapRequestDto,
							payoutTransactionHash: undefined,
							payoutTransactionHeight: undefined,
							payoutTimestamp: undefined,
							payoutNetAmount: undefined,
							payoutConversionRate: null,
							payoutTotalFee: null
						}
					]
				},
				expected: {
					result: [
						{
							type: 'wrap',
							sourceChainName: SYMBOL_CHAIN_NAME,
							targetChainName: ETHEREUM_CHAIN_NAME,
							sourceTokenInfo: createTokenInfo(SYMBOL_TOKEN_ID),
							targetTokenInfo: createTokenInfo(ETHEREUM_TOKEN_ID),
							payoutStatus: 2,
							payoutConversionRate: null,
							payoutTotalFee: null,
							requestTransaction: {
								signerAddress: SYMBOL_ACCOUNT_ADDRESS,
								hash: 'REQUEST_HASH_XYZ',
								height: 999,
								timestamp: 1750000000500,
								token: {
									...createTokenInfo(SYMBOL_TOKEN_ID),
									amount: '10'
								}
							},
							payoutTransaction: null
						}
					]
				}
			}
		];

		fetchRequestsTests.forEach(test => {
			runFetchRequestsTest(test.description, test.config, test.expected);
		});
	});

	// fetchErrors

	describe('fetchErrors', () => {
		it('throws when no current account is selected', async () => {
			// Arrange:
			const mocks = createManager({
				nativeWalletController: createNativeController({ currentAccount: null })
			});
			mocks.makeRequest.mockResolvedValueOnce(createConfigResponse());
			await mocks.manager.load();

			// Act & Assert:
			await expect(mocks.manager.fetchErrors({ pageSize: 5, pageNumber: 1 }))
				.rejects.toThrow('Failed to fetch errors. No current account selected');
		});

		it('throws when no config is loaded', async () => {
			// Arrange:
			const { manager } = createManager();

			// Act & Assert:
			await expect(manager.fetchErrors({ pageSize: 5, pageNumber: 1 }))
				.rejects.toThrow('Failed to fetch errors. No bridge config fetched');
		});

		const runFetchErrorsTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				const mocks = createManager({ managerOptions: { mode: config.mode } });
				mocks.makeRequest.mockResolvedValueOnce(createConfigResponse());
				await mocks.manager.load();
				mocks.makeRequest.mockResolvedValueOnce(config.dtoResponse);

				// Act:
				const result = await mocks.manager.fetchErrors(config.searchCriteria);

				// Assert:
				const queryAddress = config.mode === 'wrap' ? SYMBOL_ACCOUNT_ADDRESS : ETHEREUM_ACCOUNT_ADDRESS;
				const expectedUrl = buildPageUrl(config.mode, 'errors', queryAddress, config.searchCriteria);
				expect(mocks.makeRequest).toHaveBeenLastCalledWith(expectedUrl);
				expect(result).toStrictEqual(expected.result);
			});
		};

		const fetchErrorsTests = [
			{
				description: 'fetches and maps wrap errors with correct chain info and normalized hash',
				config: {
					mode: 'wrap',
					searchCriteria: { pageSize: 5, pageNumber: 1 },
					dtoResponse: [
						{
							errorMessage: 'Insufficient bridge liquidity',
							requestTimestamp: 1750000000.5,
							requestTransactionHash: 'ERROR_HASH_WRAP',
							requestTransactionHeight: 12345,
							senderAddress: SYMBOL_ACCOUNT_ADDRESS
						}
					]
				},
				expected: {
					result: [
						{
							type: 'wrap',
							requestStatus: 'error',
							sourceChainName: SYMBOL_CHAIN_NAME,
							targetChainName: ETHEREUM_CHAIN_NAME,
							sourceTokenInfo: createTokenInfo(SYMBOL_TOKEN_ID),
							targetTokenInfo: createTokenInfo(ETHEREUM_TOKEN_ID),
							errorMessage: 'Insufficient bridge liquidity',
							requestTransaction: {
								signerAddress: SYMBOL_ACCOUNT_ADDRESS,
								hash: 'ERROR_HASH_WRAP',
								height: 12345,
								timestamp: 1750000000500
							}
						}
					]
				}
			},
			{
				description: 'fetches and maps unwrap errors with reversed chains and normalized addresses',
				config: {
					mode: 'unwrap',
					searchCriteria: { pageSize: 3, pageNumber: 1 },
					dtoResponse: [
						{
							errorMessage: 'Bridge timeout',
							requestTimestamp: 1750001000.0,
							requestTransactionHash: 'ERROR_HASH_UNWRAP',
							requestTransactionHeight: 99,
							senderAddress: ETHEREUM_ACCOUNT_ADDRESS
						}
					]
				},
				expected: {
					result: [
						{
							type: 'unwrap',
							requestStatus: 'error',
							sourceChainName: ETHEREUM_CHAIN_NAME,
							targetChainName: SYMBOL_CHAIN_NAME,
							sourceTokenInfo: createTokenInfo(ETHEREUM_TOKEN_ID),
							targetTokenInfo: createTokenInfo(SYMBOL_TOKEN_ID),
							errorMessage: 'Bridge timeout',
							requestTransaction: {
								signerAddress: ETHEREUM_ACCOUNT_ADDRESS_NORMALIZED,
								hash: '0xerror_hash_unwrap',
								height: 99,
								timestamp: 1750001000000
							}
						}
					]
				}
			}
		];

		fetchErrorsTests.forEach(test => {
			runFetchErrorsTest(test.description, test.config, test.expected);
		});
	});

	// fetchSentRequests

	describe('fetchSentRequests', () => {
		it('throws when no config is loaded', async () => {
			// Arrange:
			const { manager } = createManager();

			// Act & Assert:
			await expect(manager.fetchSentRequests({ pageSize: 5, pageNumber: 1 }))
				.rejects.toThrow('Failed to fetch sent requests. No bridge config fetched');
		});

		it('wrap mode: fetches from native controller and maps confirmed pending requests', async () => {
			// Arrange:
			const mocks = await createLoadedManager({ managerOptions: { mode: 'wrap' } });
			const { bridgeAddress } = mocks.manager.config.nativeNetwork;
			const transactions = [
				{
					signerAddress: SYMBOL_ACCOUNT_ADDRESS,
					recipientAddress: bridgeAddress.toLowerCase(), // will be normalized to match
					hash: 'PENDING_WRAP_TX',
					height: 100,
					timestamp: 1750000000
				}
			];
			mocks.nativeWalletController.fetchAccountTransactions.mockResolvedValueOnce(transactions);

			// Act:
			const result = await mocks.manager.fetchSentRequests({ pageSize: 5, pageNumber: 1 });

			// Assert:
			expect(mocks.nativeWalletController.fetchAccountTransactions).toHaveBeenCalledWith({
				to: bridgeAddress,
				pageSize: 5,
				pageNumber: 1
			});
			expect(result).toHaveLength(1);
			expect(result[0]).toMatchObject({
				type: 'wrap',
				requestStatus: 'confirmed',
				sourceChainName: SYMBOL_CHAIN_NAME,
				targetChainName: ETHEREUM_CHAIN_NAME,
				requestTransaction: {
					signerAddress: SYMBOL_ACCOUNT_ADDRESS,
					hash: 'PENDING_WRAP_TX',
					height: 100,
					timestamp: 1750000000,
					token: null
				}
			});
		});

		it('unwrap mode: fetches from wrapped controller and maps confirmed pending requests', async () => {
			// Arrange:
			const mocks = await createLoadedManager({ managerOptions: { mode: 'unwrap' } });
			const { bridgeAddress } = mocks.manager.config.wrappedNetwork;
			const transactions = [
				{
					signerAddress: ETHEREUM_ACCOUNT_ADDRESS,
					recipientAddress: bridgeAddress.toUpperCase(), // will be normalized to match
					hash: '0xpending_unwrap_tx',
					height: 200,
					timestamp: 1750001000
				}
			];
			mocks.wrappedWalletController.fetchAccountTransactions.mockResolvedValueOnce(transactions);

			// Act:
			const result = await mocks.manager.fetchSentRequests({ pageSize: 3, pageNumber: 1 });

			// Assert:
			expect(mocks.wrappedWalletController.fetchAccountTransactions).toHaveBeenCalledWith({
				to: bridgeAddress,
				pageSize: 3,
				pageNumber: 1
			});
			expect(result).toHaveLength(1);
			expect(result[0]).toMatchObject({
				type: 'unwrap',
				requestStatus: 'confirmed',
				sourceChainName: ETHEREUM_CHAIN_NAME,
				targetChainName: SYMBOL_CHAIN_NAME,
				requestTransaction: {
					signerAddress: ETHEREUM_ACCOUNT_ADDRESS_NORMALIZED,
					hash: '0xpending_unwrap_tx',
					height: 200,
					timestamp: 1750001000,
					token: null
				}
			});
		});

		it('filters out transactions whose recipient does not match the bridge address', async () => {
			// Arrange:
			const mocks = await createLoadedManager({ managerOptions: { mode: 'wrap' } });
			const { bridgeAddress } = mocks.manager.config.nativeNetwork;
			const transactions = [
				{
					signerAddress: SYMBOL_ACCOUNT_ADDRESS,
					recipientAddress: bridgeAddress,
					hash: 'VALID_HASH',
					height: 1,
					timestamp: 100
				},
				{
					signerAddress: SYMBOL_ACCOUNT_ADDRESS,
					recipientAddress: 'SOME_OTHER_ADDRESS',
					hash: 'IGNORED_HASH',
					height: 2,
					timestamp: 200
				},
				{
					signerAddress: SYMBOL_ACCOUNT_ADDRESS,
					recipientAddress: null,
					hash: 'NO_RECIPIENT_HASH',
					height: 3,
					timestamp: 300
				}
			];
			mocks.nativeWalletController.fetchAccountTransactions.mockResolvedValueOnce(transactions);

			// Act:
			const result = await mocks.manager.fetchSentRequests({ pageSize: 10, pageNumber: 1 });

			// Assert:
			expect(result).toHaveLength(1);
			expect(result[0].requestTransaction.hash).toBe('VALID_HASH');
		});

		it('maps transaction token from mosaics array when present', async () => {
			// Arrange:
			const mocks = await createLoadedManager({ managerOptions: { mode: 'wrap' } });
			const { bridgeAddress } = mocks.manager.config.nativeNetwork;
			const mosaic = { id: SYMBOL_TOKEN_ID, amount: '5000000', divisibility: 6 };
			const transactions = [
				{
					signerAddress: SYMBOL_ACCOUNT_ADDRESS,
					recipientAddress: bridgeAddress,
					hash: 'TX_WITH_MOSAIC',
					height: 1,
					timestamp: 100,
					mosaics: [mosaic]
				}
			];
			mocks.nativeWalletController.fetchAccountTransactions.mockResolvedValueOnce(transactions);

			// Act:
			const result = await mocks.manager.fetchSentRequests({ pageSize: 5, pageNumber: 1 });

			// Assert:
			expect(result[0].requestTransaction.token).toStrictEqual(mosaic);
		});
	});

	// fetchRecentHistory

	describe('fetchRecentHistory', () => {
		it('merges requests, errors and pending; de-duplicates by request hash; sorts descending; slices to count', async () => {
			// Arrange:
			const { manager } = await createLoadedManager();
			const count = 3;

			const requestA = {
				type: 'wrap',
				sourceChainName: SYMBOL_CHAIN_NAME,
				targetChainName: ETHEREUM_CHAIN_NAME,
				requestTransaction: { hash: 'HASH_A', timestamp: 2000 }
			};
			const requestB = {
				type: 'wrap',
				sourceChainName: SYMBOL_CHAIN_NAME,
				targetChainName: ETHEREUM_CHAIN_NAME,
				requestTransaction: { hash: 'HASH_B', timestamp: 3000 }
			};
			// Duplicate of requestA – same hash but different timestamp; should be de-duplicated
			const errorA = {
				type: 'wrap',
				requestStatus: 'error',
				requestTransaction: { hash: 'HASH_A', timestamp: 2500 }
			};
			// Pending with unique hash
			const pendingC = {
				type: 'wrap',
				requestStatus: 'confirmed',
				requestTransaction: { hash: 'HASH_C', timestamp: 1000 }
			};
			// Pending with highest timestamp – should appear first after sort
			const pendingD = {
				type: 'wrap',
				requestStatus: 'confirmed',
				requestTransaction: { hash: 'HASH_D', timestamp: 4000 }
			};

			jest.spyOn(manager, 'fetchRequests').mockResolvedValue([requestA, requestB]);
			jest.spyOn(manager, 'fetchErrors').mockResolvedValue([errorA]);
			jest.spyOn(manager, 'fetchSentRequests').mockResolvedValue([pendingC, pendingD]);

			// Act:
			const result = await manager.fetchRecentHistory(count);

			// Assert:
			// Unique hashes: HASH_A (kept first occurrence from requests), HASH_B, HASH_C, HASH_D
			// Sorted descending by timestamp: HASH_D(4000), HASH_B(3000), HASH_A(2000), HASH_C(1000)
			// Sliced to count 3: HASH_D, HASH_B, HASH_A
			expect(result).toHaveLength(3);
			expect(result[0].requestTransaction.hash).toBe('HASH_D');
			expect(result[1].requestTransaction.hash).toBe('HASH_B');
			expect(result[2].requestTransaction.hash).toBe('HASH_A');
		});

		it('passes count as pageSize to all sub-fetch calls', async () => {
			// Arrange:
			const { manager } = await createLoadedManager();
			const fetchRequestsSpy = jest.spyOn(manager, 'fetchRequests').mockResolvedValue([]);
			const fetchErrorsSpy = jest.spyOn(manager, 'fetchErrors').mockResolvedValue([]);
			const fetchSentRequestsSpy = jest.spyOn(manager, 'fetchSentRequests').mockResolvedValue([]);

			// Act:
			await manager.fetchRecentHistory(7);

			// Assert:
			expect(fetchRequestsSpy).toHaveBeenCalledWith({ pageSize: 7, pageNumber: 1 });
			expect(fetchErrorsSpy).toHaveBeenCalledWith({ pageSize: 7, pageNumber: 1 });
			expect(fetchSentRequestsSpy).toHaveBeenCalledWith({ pageSize: 7, pageNumber: 1 });
		});
	});

	// estimateRequest

	describe('estimateRequest', () => {
		it('throws when no recipient account is selected', async () => {
			// Arrange: wrap mode – recipient is the wrapped (target) controller's account
			const mocks = await createLoadedManager({
				wrappedWalletController: createWrappedController({ currentAccount: null })
			});

			// Act & Assert:
			await expect(mocks.manager.estimateRequest('10'))
				.rejects.toThrow('Failed to estimate bridge request. No recipient account selected');
		});

		const runEstimateRequestTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				const mocks = await createLoadedManager({ managerOptions: { mode: config.mode } });
				mocks.makeRequest.mockResolvedValueOnce(createEstimationResponse(
					config.estimationDto.totalFee,
					config.estimationDto.netAmount
				));

				// Act:
				const result = await mocks.manager.estimateRequest(config.amount);

				// Assert:
				const recipientAddress = config.mode === 'wrap'
					? ETHEREUM_ACCOUNT_ADDRESS
					: SYMBOL_ACCOUNT_ADDRESS;
				expect(mocks.makeRequest).toHaveBeenLastCalledWith(
					`${BRIDGE_URL}/${config.mode}/estimate`,
					{
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ amount: config.expectedAbsoluteAmount, recipientAddress })
					}
				);
				expect(result).toStrictEqual(expected.result);
			});
		};

		const estimateRequestTests = [
			{
				description: 'wrap mode: converts amount to absolute, posts to bridge, maps estimation response',
				config: {
					mode: 'wrap',
					amount: '15',
					expectedAbsoluteAmount: '15000000', // 15 × 10^6
					estimationDto: { totalFee: '1', netAmount: '14999999' }
				},
				expected: {
					result: {
						bridgeFee: '0.000001',
						receiveAmount: '14.999999',
						error: null
					}
				}
			},
			{
				description: 'unwrap mode: uses wrapped divisibility for input conversion',
				config: {
					mode: 'unwrap',
					amount: '499.99999',
					expectedAbsoluteAmount: '499999990', // "499.99999" × 10^6
					estimationDto: { totalFee: '17600', netAmount: '499982390' }
				},
				expected: {
					result: {
						bridgeFee: '0.0176',
						receiveAmount: '499.98239',
						error: null
					}
				}
			},
			{
				description: 'sets isAmountLow error when net amount is negative',
				config: {
					mode: 'wrap',
					amount: '0.0001',
					expectedAbsoluteAmount: '100', // 0.0001 × 10^6
					estimationDto: { totalFee: '200', netAmount: '-1' }
				},
				expected: {
					result: {
						bridgeFee: '0.0002',
						receiveAmount: '0',
						error: { isAmountLow: true }
					}
				}
			}
		];

		estimateRequestTests.forEach(test => {
			runEstimateRequestTest(test.description, test.config, test.expected);
		});

		it('returns isAmountHigh error when bridge estimation reverts with specific message', async () => {
			// Arrange:
			const mocks = await createLoadedManager();
			const gasErrorMessage = 'eth_estimateGas RPC call failed: execution reverted: ERC20: transfer amount exceeds balance';
			const gasError = new Error(gasErrorMessage);
			mocks.makeRequest.mockRejectedValueOnce(gasError);

			// Act:
			const result = await mocks.manager.estimateRequest('99999');

			// Assert:
			expect(result).toStrictEqual({ error: { isAmountHigh: true } });
		});

		it('re-throws unexpected errors from the bridge API', async () => {
			// Arrange:
			const mocks = await createLoadedManager();
			const networkError = new Error('Network timeout');
			mocks.makeRequest.mockRejectedValueOnce(networkError);

			// Act & Assert:
			await expect(mocks.manager.estimateRequest('1')).rejects.toThrow('Network timeout');
		});
	});

	// createTransaction

	describe('createTransaction', () => {
		it('throws when no config is loaded', async () => {
			// Arrange:
			const { manager } = createManager();

			// Act & Assert:
			await expect(manager.createTransaction({ recipientAddress: ETHEREUM_ACCOUNT_ADDRESS, amount: '10' }))
				.rejects.toThrow('Failed to create bridge transaction. No bridge config fetched');
		});

		it('throws when no current account is selected on source controller', async () => {
			// Arrange: wrap mode – source is native controller
			const mocks = await createLoadedManager({
				nativeWalletController: createNativeController({ currentAccount: null })
			});

			// Act & Assert:
			await expect(mocks.manager.createTransaction({ recipientAddress: ETHEREUM_ACCOUNT_ADDRESS, amount: '10' }))
				.rejects.toThrow('Failed to create bridge transaction. No current account selected');
		});

		const runCreateTransactionTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				const mocks = await createLoadedManager({ managerOptions: { mode: config.mode } });
				const expectedTx = { type: config.mode === 'wrap' ? 'TRANSFER' : 'ERC_20_BRIDGE_TRANSFER' };
				const bridgeHelper = config.mode === 'wrap'
					? mocks.nativeBridgeHelper
					: mocks.wrappedBridgeHelper;
				bridgeHelper.createTransaction.mockResolvedValueOnce(expectedTx);

				// Act:
				const result = await mocks.manager.createTransaction(config.options);

				// Assert:
				expect(bridgeHelper.createTransaction).toHaveBeenCalledWith(expected.helperArgs);
				expect(result).toBeInstanceOf(TransactionBundle);
				expect(result.transactions).toHaveLength(1);
				expect(result.transactions[0]).toStrictEqual(expectedTx);
			});
		};

		const createTransactionTests = [
			{
				description: 'wrap mode: delegates to native bridge helper with correct token and bridge address',
				config: {
					mode: 'wrap',
					options: {
						recipientAddress: ETHEREUM_ACCOUNT_ADDRESS,
						amount: '10',
						fee: { maxFee: '100' }
					}
				},
				expected: {
					helperArgs: {
						currentAccount: symbolCurrentAccount,
						networkProperties: symbolNetworkProperties,
						recipientAddress: ETHEREUM_ACCOUNT_ADDRESS,
						bridgeAddress: SYMBOL_BRIDGE_ADDRESS,
						token: { ...createTokenInfo(SYMBOL_TOKEN_ID), amount: '10' },
						fee: { maxFee: '100' }
					}
				}
			},
			{
				description: 'unwrap mode: delegates to wrapped bridge helper with correct token and bridge address',
				config: {
					mode: 'unwrap',
					options: {
						recipientAddress: SYMBOL_ACCOUNT_ADDRESS,
						amount: '5',
						fee: { gasPrice: '20000000000' }
					}
				},
				expected: {
					helperArgs: {
						currentAccount: ethereumCurrentAccount,
						networkProperties: ethereumNetworkProperties,
						recipientAddress: SYMBOL_ACCOUNT_ADDRESS,
						bridgeAddress: ETHEREUM_BRIDGE_ADDRESS,
						token: { ...createTokenInfo(ETHEREUM_TOKEN_ID), amount: '5' },
						fee: { gasPrice: '20000000000' }
					}
				}
			}
		];

		createTransactionTests.forEach(test => {
			runCreateTransactionTest(test.description, test.config, test.expected);
		});
	});
});

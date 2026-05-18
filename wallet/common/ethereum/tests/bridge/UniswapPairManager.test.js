import { UniswapPairManager } from '../../src/bridge/UniswapPairManager';
import { NETWORK_CURRENCY_ID, NETWORK_CURRENCY_NAME, NETWORK_CURRENCY_TICKER, TransactionType } from '../../src/constants';
import { jest } from '@jest/globals';
import { TransactionBundle } from 'wallet-common-core';

// Config constants

const NATIVE_TOKEN_ID = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
const WETH_TOKEN_ID = '0x3a8c1bd531b5c1aefbb9ebc3e021c1251cf4ccb1';
const WRAPPED_TOKEN_ID = '0x5e8343a455f03109b737b6d8b410e4ecce998cda';
const QUOTER_ADDRESS = '0xb27308f9f90d607463bb33ea1bebb41c27ce5ab6';
const SWAP_ROUTER_ADDRESS = '0xe592427a0aece92de3edee1f18e0157c05861564';
const POOL_FEE = 3000;
const FIXED_NOW_MS = 1700000000000;
const FIXED_NOW_S = Math.floor(FIXED_NOW_MS / 1000);
const DEFAULT_DEADLINE_SECONDS = 600;

// Token infos

const nativeTokenInfo = {
	id: NATIVE_TOKEN_ID,
	name: 'Wrapped Ether',
	ticker: 'WETH',
	divisibility: 18
};

const wrappedTokenInfo = {
	id: WRAPPED_TOKEN_ID,
	name: 'Wrapped XYM',
	ticker: 'WXYM',
	divisibility: 6
};

const ethNetworkCurrency = {
	name: NETWORK_CURRENCY_NAME,
	ticker: NETWORK_CURRENCY_TICKER,
	id: NETWORK_CURRENCY_ID,
	divisibility: 18
};

const ethNativeTokenInfo = ethNetworkCurrency;

// Network / Account

const networkProperties = {
	nodeUrl: 'http://localhost:8545',
	networkIdentifier: 'testnet',
	networkCurrency: ethNetworkCurrency
};

const networkPropertiesWithCurrency = {
	...networkProperties,
	networkCurrency: ethNetworkCurrency
};

const currentAccount = {
	address: '0xabcdef1234567890abcdef1234567890abcdef12',
	publicKey: '0xpublickey1234567890abcdef'
};

const customRecipientAddress = '0x9999999999999999999999999999999999999999';
const fee = { maxFee: '20000000000', gasLimit: '200000' };

// Factory functions

const createWalletControllerMock = (overrides = {}) => ({
	isWalletReady: true,
	networkProperties,
	currentAccount,
	...overrides
});

const createUniswapApiMock = (overrides = {}) => ({
	fetchPoolTokenInfos: jest.fn().mockResolvedValue({ nativeTokenInfo, wrappedTokenInfo }),
	quoteExactInputSingle: jest.fn(),
	...overrides
});

const createTransactionApiMock = (overrides = {}) => ({
	fetchTransactionNonce: jest.fn().mockResolvedValue(7),
	...overrides
});

const createManager = (overrides = {}) => {
	const walletController = overrides.walletController ?? createWalletControllerMock();
	const uniswapApi = overrides.uniswapApi ?? createUniswapApiMock();
	const transactionApi = overrides.transactionApi ?? createTransactionApiMock();

	const manager = new UniswapPairManager({
		walletController,
		uniswapApi,
		transactionApi,
		nativeTokenId: NATIVE_TOKEN_ID,
		wethTokenId: WETH_TOKEN_ID,
		wrappedTokenId: WRAPPED_TOKEN_ID,
		quoterAddress: QUOTER_ADDRESS,
		swapRouterAddress: SWAP_ROUTER_ADDRESS,
		poolFee: POOL_FEE,
		mode: 'wrap',
		...overrides.managerOptions
	});

	return {
		manager, walletController, uniswapApi, transactionApi
	};
};

const createEthNativeManager = (overrides = {}) => {
	const walletController = overrides.walletController ?? createWalletControllerMock({ networkProperties: networkPropertiesWithCurrency });
	const uniswapApi = overrides.uniswapApi ?? createUniswapApiMock({
		fetchPoolTokenInfos: jest.fn().mockResolvedValue({ nativeTokenInfo: ethNativeTokenInfo, wrappedTokenInfo })
	});
	const transactionApi = overrides.transactionApi ?? createTransactionApiMock();

	const manager = new UniswapPairManager({
		walletController,
		uniswapApi,
		transactionApi,
		nativeTokenId: NETWORK_CURRENCY_ID,
		wethTokenId: WETH_TOKEN_ID,
		wrappedTokenId: WRAPPED_TOKEN_ID,
		quoterAddress: QUOTER_ADDRESS,
		swapRouterAddress: SWAP_ROUTER_ADDRESS,
		poolFee: POOL_FEE,
		mode: 'wrap',
		...overrides.managerOptions
	});

	return {
		manager, walletController, uniswapApi, transactionApi
	};
};

const createLoadedManager = async (overrides = {}) => {
	const mocks = createManager(overrides);
	await mocks.manager.load();
	return mocks;
};

const createLoadedEthNativeManager = async (overrides = {}) => {
	const mocks = createEthNativeManager(overrides);
	await mocks.manager.load();
	return mocks;
};

// Tests

describe('bridge/UniswapPairManager', () => {
	afterEach(() => {
		jest.restoreAllMocks();
		jest.clearAllMocks();
	});

	// Constructor

	describe('constructor', () => {
		it('throws when mode is invalid', () => {
			// Arrange & Act & Assert:
			expect(() => createManager({ managerOptions: { mode: 'invalid' } }))
				.toThrow('Invalid swap mode: invalid. Must be \'wrap\' or \'unwrap\'');
		});

		it('does not throw when mode is wrap', () => {
			// Arrange & Act & Assert:
			expect(() => createManager({ managerOptions: { mode: 'wrap' } })).not.toThrow();
		});

		it('does not throw when mode is unwrap', () => {
			// Arrange & Act & Assert:
			expect(() => createManager({ managerOptions: { mode: 'unwrap' } })).not.toThrow();
		});

		it('throws when nativeTokenId is ETH and wethTokenId is not provided', () => {
			// Arrange & Act & Assert:
			expect(() => new UniswapPairManager({
				walletController: createWalletControllerMock(),
				uniswapApi: createUniswapApiMock(),
				transactionApi: createTransactionApiMock(),
				nativeTokenId: NETWORK_CURRENCY_ID,
				wrappedTokenId: WRAPPED_TOKEN_ID,
				quoterAddress: QUOTER_ADDRESS,
				swapRouterAddress: SWAP_ROUTER_ADDRESS,
				poolFee: POOL_FEE,
				mode: 'wrap'
			})).toThrow();
		});

		it('does not throw when nativeTokenId is ETH and wethTokenId is provided', () => {
			// Arrange & Act & Assert:
			expect(() => createEthNativeManager()).not.toThrow();
		});
	});

	// Properties

	describe('properties', () => {
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

		describe('hasHistory', () => {
			it('returns false', () => {
				// Arrange:
				const { manager } = createManager();

				// Act & Assert:
				expect(manager.hasHistory).toBe(false);
			});
		});

		describe('isReady', () => {
			const runIsReadyTest = (description, config, expected) => {
				it(description, async () => {
					// Arrange:
					const walletController = createWalletControllerMock(config.walletOverrides);
					const { manager } = config.isLoaded
						? await createLoadedManager({ walletController })
						: createManager({ walletController });

					// Act & Assert:
					expect(manager.isReady).toBe(expected.isReady);
				});
			};

			const isReadyTests = [
				{
					description: 'returns false when wallet is not ready and manager is not loaded',
					config: { isLoaded: false, walletOverrides: { isWalletReady: false } },
					expected: { isReady: false }
				},
				{
					description: 'returns false when wallet is ready but manager is not loaded',
					config: { isLoaded: false, walletOverrides: { isWalletReady: true } },
					expected: { isReady: false }
				},
				{
					description: 'returns false when manager is loaded but wallet is not ready',
					config: { isLoaded: true, walletOverrides: { isWalletReady: false } },
					expected: { isReady: false }
				},
				{
					description: 'returns true when wallet is ready and manager is loaded',
					config: { isLoaded: true, walletOverrides: { isWalletReady: true } },
					expected: { isReady: true }
				}
			];

			isReadyTests.forEach(test => {
				runIsReadyTest(test.description, test.config, test.expected);
			});
		});

		describe('nativeTokenInfo and wrappedTokenInfo', () => {
			it('returns null before load', () => {
				// Arrange:
				const { manager } = createManager();

				// Act & Assert:
				expect(manager.nativeTokenInfo).toBeNull();
				expect(manager.wrappedTokenInfo).toBeNull();
			});

			it('returns token infos after load', async () => {
				// Arrange:
				const { manager } = await createLoadedManager();

				// Act & Assert:
				expect(manager.nativeTokenInfo).toStrictEqual(nativeTokenInfo);
				expect(manager.wrappedTokenInfo).toStrictEqual(wrappedTokenInfo);
			});
		});

		describe('nativeWalletController and wrappedWalletController', () => {
			it('both return the same wallet controller instance', () => {
				// Arrange:
				const { manager, walletController } = createManager();

				// Act & Assert:
				expect(manager.nativeWalletController).toBe(walletController);
				expect(manager.wrappedWalletController).toBe(walletController);
			});
		});

		describe('sourceWalletController and targetWalletController', () => {
			it('both return the same wallet controller instance', () => {
				// Arrange:
				const { manager, walletController } = createManager();

				// Act & Assert:
				expect(manager.sourceWalletController).toBe(walletController);
				expect(manager.targetWalletController).toBe(walletController);
			});
		});
	});

	// Load

	describe('load', () => {
		it('calls fetchPoolTokenInfos with correct args and populates token infos', async () => {
			// Arrange:
			const { manager, uniswapApi } = createManager();

			// Act:
			await manager.load();

			// Assert:
			expect(uniswapApi.fetchPoolTokenInfos).toHaveBeenCalledWith(
				networkProperties,
				NATIVE_TOKEN_ID,
				WRAPPED_TOKEN_ID
			);
			expect(manager.nativeTokenInfo).toStrictEqual(nativeTokenInfo);
			expect(manager.wrappedTokenInfo).toStrictEqual(wrappedTokenInfo);
		});

		it('native ETH: derives nativeTokenInfo from networkCurrency and fetches wrappedTokenInfo via wethTokenId', async () => {
			// Arrange:
			const { manager, uniswapApi } = createEthNativeManager();

			// Act:
			await manager.load();

			// Assert:
			expect(uniswapApi.fetchPoolTokenInfos).toHaveBeenCalledWith(
				networkPropertiesWithCurrency,
				NETWORK_CURRENCY_ID,
				WRAPPED_TOKEN_ID
			);
			expect(manager.nativeTokenInfo).toStrictEqual(ethNativeTokenInfo);
			expect(manager.wrappedTokenInfo).toStrictEqual(wrappedTokenInfo);
		});
	});

	// fetchRecentHistory

	describe('fetchRecentHistory', () => {
		it('returns empty array before load', async () => {
			// Arrange:
			const { manager } = createManager();

			// Act:
			const history = await manager.fetchRecentHistory();

			// Assert:
			expect(history).toStrictEqual([]);
		});

		it('returns empty array after load regardless of page size', async () => {
			// Arrange:
			const { manager } = await createLoadedManager();

			// Act:
			const history = await manager.fetchRecentHistory(100);

			// Assert:
			expect(history).toStrictEqual([]);
		});
	});

	// estimateRequest

	describe('estimateRequest', () => {
		it('throws when manager is not loaded', async () => {
			// Arrange:
			const { manager } = createManager();

			// Act & Assert:
			await expect(manager.estimateRequest('1'))
				.rejects.toThrow('Failed to estimate Uniswap swap. Manager not loaded');
		});

		const runEstimateRequestTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				const { manager, uniswapApi } = await createLoadedManager({ managerOptions: { mode: config.mode } });
				uniswapApi.quoteExactInputSingle.mockResolvedValue(config.quotedAbsoluteAmount);

				// Act:
				const result = await manager.estimateRequest(config.inputAmount);

				// Assert:
				expect(uniswapApi.quoteExactInputSingle).toHaveBeenCalledWith(
					networkProperties,
					QUOTER_ADDRESS,
					expected.quoteParams
				);
				expect(result).toStrictEqual({
					receiveAmount: expected.receiveAmount,
					bridgeFee: expected.bridgeFee,
					error: null
				});
			});
		};

		const estimateRequestTests = [
			{
				description: 'wrap mode: converts native amount to absolute and returns relative wrapped amount',
				config: {
					mode: 'wrap',
					inputAmount: '1',
					quotedAbsoluteAmount: '990000' // 6 decimals → "0.99"
				},
				expected: {
					quoteParams: {
						tokenInId: NATIVE_TOKEN_ID,
						tokenOutId: WRAPPED_TOKEN_ID,
						amountIn: '1000000000000000000', // "1" with 18 decimals
						fee: POOL_FEE
					},
					receiveAmount: '0.99',
					bridgeFee: '0.00297' // 990000 * 3000 / 1_000_000 = 2970 absolute → 6 decimals
				}
			},
			{
				description: 'unwrap mode: uses reversed tokens and wrapped divisibility for input conversion',
				config: {
					mode: 'unwrap',
					inputAmount: '0.5',
					quotedAbsoluteAmount: '490000000000000000' // 18 decimals → "0.49"
				},
				expected: {
					quoteParams: {
						tokenInId: WRAPPED_TOKEN_ID,
						tokenOutId: NATIVE_TOKEN_ID,
						amountIn: '500000', // "0.5" with 6 decimals
						fee: POOL_FEE
					},
					receiveAmount: '0.49',
					bridgeFee: '0.00147' // 490000000000000000 * 3000 / 1_000_000 = 1470000000000000 absolute → 18 decimals
				}
			}
		];

		estimateRequestTests.forEach(test => {
			runEstimateRequestTest(test.description, test.config, test.expected);
		});

		it('native ETH wrap mode: uses wethTokenId for quoter tokenIn instead of ETH id', async () => {
			// Arrange:
			const { manager, uniswapApi } = await createLoadedEthNativeManager();
			uniswapApi.quoteExactInputSingle.mockResolvedValue('990000');

			// Act:
			const result = await manager.estimateRequest('1');

			// Assert:
			expect(uniswapApi.quoteExactInputSingle).toHaveBeenCalledWith(
				networkPropertiesWithCurrency,
				QUOTER_ADDRESS,
				{
					tokenInId: WETH_TOKEN_ID,
					tokenOutId: WRAPPED_TOKEN_ID,
					amountIn: '1000000000000000000',
					fee: POOL_FEE
				}
			);
			expect(result).toStrictEqual({
				receiveAmount: '0.99',
				bridgeFee: '0.00297',
				error: null
			});
		});
	});

	// createTransaction

	describe('createTransaction', () => {
		beforeEach(() => {
			jest.spyOn(Date, 'now').mockReturnValue(FIXED_NOW_MS);
		});

		it('throws when manager is not loaded', async () => {
			// Arrange:
			const { manager } = createManager();

			// Act & Assert:
			await expect(manager.createTransaction({ amount: '1' }))
				.rejects.toThrow('Failed to create Uniswap transaction. Manager not loaded');
		});

		it('throws when no current account is selected', async () => {
			// Arrange:
			const walletController = createWalletControllerMock({ currentAccount: null });
			const { manager } = await createLoadedManager({ walletController });

			// Act & Assert:
			await expect(manager.createTransaction({ amount: '1' }))
				.rejects.toThrow('Failed to create Uniswap transaction. No current account selected');
		});

		const runCreateTransactionTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				const { manager, transactionApi } = await createLoadedManager({ managerOptions: { mode: config.mode } });
				transactionApi.fetchTransactionNonce.mockResolvedValue(42);

				// Act:
				const result = await manager.createTransaction(config.options);

				// Assert:
				expect(transactionApi.fetchTransactionNonce).toHaveBeenCalledWith(
					networkProperties,
					currentAccount.address
				);
				expect(result).toBeInstanceOf(TransactionBundle);
				expect(result.transactions).toHaveLength(2);
				expect(result.transactions[0]).toStrictEqual(expected.approveTransaction);
				expect(result.transactions[1]).toStrictEqual(expected.swapTransaction);
			});
		};

		const swapTransactionTests = [
			{
				description: 'wrap mode: creates approve + swap bundle with correct tokens, amounts and nonces',
				config: {
					mode: 'wrap',
					options: {
						recipientAddress: currentAccount.address,
						amount: '1',
						fee
					}
				},
				expected: {
					approveTransaction: {
						type: TransactionType.ERC_20_APPROVE,
						signerPublicKey: currentAccount.publicKey,
						signerAddress: currentAccount.address,
						tokenId: NATIVE_TOKEN_ID,
						spenderAddress: SWAP_ROUTER_ADDRESS,
						amount: '1',
						divisibility: nativeTokenInfo.divisibility,
						nonce: 42,
						fee
					},
					swapTransaction: {
						type: TransactionType.UNISWAP_SWAP,
						signerPublicKey: currentAccount.publicKey,
						signerAddress: currentAccount.address,
						recipientAddress: currentAccount.address,
						routerAddress: SWAP_ROUTER_ADDRESS,
						sourceToken: {
							id: NATIVE_TOKEN_ID,
							name: nativeTokenInfo.name,
							ticker: nativeTokenInfo.ticker,
							divisibility: nativeTokenInfo.divisibility,
							amount: '1'
						},
						targetToken: {
							id: WRAPPED_TOKEN_ID,
							name: wrappedTokenInfo.name,
							ticker: wrappedTokenInfo.ticker,
							divisibility: wrappedTokenInfo.divisibility,
							amount: '0'
						},
						wethTokenId: WETH_TOKEN_ID,
						poolFee: POOL_FEE,
						deadline: FIXED_NOW_S + DEFAULT_DEADLINE_SECONDS,
						sqrtPriceLimitX96: 0,
						nonce: 43,
						fee
					}
				}
			},
			{
				description: 'unwrap mode: creates approve + swap bundle with reversed tokens',
				config: {
					mode: 'unwrap',
					options: {
						recipientAddress: currentAccount.address,
						amount: '0.5',
						fee
					}
				},
				expected: {
					approveTransaction: {
						type: TransactionType.ERC_20_APPROVE,
						signerPublicKey: currentAccount.publicKey,
						signerAddress: currentAccount.address,
						tokenId: WRAPPED_TOKEN_ID,
						spenderAddress: SWAP_ROUTER_ADDRESS,
						amount: '0.5',
						divisibility: wrappedTokenInfo.divisibility,
						nonce: 42,
						fee
					},
					swapTransaction: {
						type: TransactionType.UNISWAP_SWAP,
						signerPublicKey: currentAccount.publicKey,
						signerAddress: currentAccount.address,
						recipientAddress: currentAccount.address,
						routerAddress: SWAP_ROUTER_ADDRESS,
						sourceToken: {
							id: WRAPPED_TOKEN_ID,
							name: wrappedTokenInfo.name,
							ticker: wrappedTokenInfo.ticker,
							divisibility: wrappedTokenInfo.divisibility,
							amount: '0.5'
						},
						targetToken: {
							id: NATIVE_TOKEN_ID,
							name: nativeTokenInfo.name,
							ticker: nativeTokenInfo.ticker,
							divisibility: nativeTokenInfo.divisibility,
							amount: '0'
						},
						wethTokenId: WETH_TOKEN_ID,
						poolFee: POOL_FEE,
						deadline: FIXED_NOW_S + DEFAULT_DEADLINE_SECONDS,
						sqrtPriceLimitX96: 0,
						nonce: 43,
						fee
					}
				}
			}
		];

		swapTransactionTests.forEach(test => {
			runCreateTransactionTest(test.description, test.config, test.expected);
		});

		it('uses recipient address from options instead of current account address', async () => {
			// Arrange:
			const { manager, transactionApi } = await createLoadedManager();
			transactionApi.fetchTransactionNonce.mockResolvedValue(1);

			// Act:
			const result = await manager.createTransaction({ amount: '1', recipientAddress: customRecipientAddress });

			// Assert:
			expect(result.transactions[1].recipientAddress).toBe(customRecipientAddress);
		});

		it('defaults amountOutMinimum to 0 when not specified', async () => {
			// Arrange:
			const { manager, transactionApi } = await createLoadedManager();
			transactionApi.fetchTransactionNonce.mockResolvedValue(1);

			// Act:
			const result = await manager.createTransaction({ amount: '1', recipientAddress: currentAccount.address });

			// Assert:
			expect(result.transactions[1].targetToken.amount).toBe('0');
		});

		it('stores relative amountOutMinimum in targetToken', async () => {
			// Arrange:
			const { manager, transactionApi } = await createLoadedManager();
			transactionApi.fetchTransactionNonce.mockResolvedValue(1);

			// Act:
			const result = await manager.createTransaction({
				amount: '1',
				recipientAddress: currentAccount.address,
				amountOutMinimum: '0.95'
			});

			// Assert:
			expect(result.transactions[1].targetToken.amount).toBe('0.95');
		});

		it('applies custom deadline seconds to transaction deadline', async () => {
			// Arrange:
			const deadlineSeconds = 300;
			const { manager, transactionApi } = await createLoadedManager();
			transactionApi.fetchTransactionNonce.mockResolvedValue(1);

			// Act:
			const result = await manager.createTransaction({
				amount: '1',
				recipientAddress: currentAccount.address,
				deadlineSeconds
			});

			// Assert:
			expect(result.transactions[1].deadline).toBe(FIXED_NOW_S + deadlineSeconds);
		});

		it('native ETH wrap: creates single swap transaction with value and wethTokenId as tokenIn', async () => {
			// Arrange:
			const { manager, transactionApi } = await createLoadedEthNativeManager();
			transactionApi.fetchTransactionNonce.mockResolvedValue(5);

			// Act:
			const result = await manager.createTransaction({
				recipientAddress: currentAccount.address,
				amount: '0.001',
				fee
			});

			// Assert:
			expect(transactionApi.fetchTransactionNonce).toHaveBeenCalledWith(
				networkPropertiesWithCurrency,
				currentAccount.address
			);
			expect(result).toBeInstanceOf(TransactionBundle);
			expect(result.transactions).toHaveLength(1);
			expect(result.transactions[0]).toStrictEqual({
				type: TransactionType.UNISWAP_SWAP,
				signerPublicKey: currentAccount.publicKey,
				signerAddress: currentAccount.address,
				recipientAddress: currentAccount.address,
				routerAddress: SWAP_ROUTER_ADDRESS,
				sourceToken: {
					id: NETWORK_CURRENCY_ID,
					name: ethNativeTokenInfo.name,
					ticker: ethNativeTokenInfo.ticker,
					divisibility: ethNativeTokenInfo.divisibility,
					amount: '0.001'
				},
				targetToken: {
					id: WRAPPED_TOKEN_ID,
					name: wrappedTokenInfo.name,
					ticker: wrappedTokenInfo.ticker,
					divisibility: wrappedTokenInfo.divisibility,
					amount: '0'
				},
				wethTokenId: WETH_TOKEN_ID,
				poolFee: POOL_FEE,
				deadline: FIXED_NOW_S + DEFAULT_DEADLINE_SECONDS,
				sqrtPriceLimitX96: 0,
				nonce: 5,
				fee
			});
		});

		it('native ETH wrap: uses single nonce (no approve transaction)', async () => {
			// Arrange:
			const { manager, transactionApi } = await createLoadedEthNativeManager();
			transactionApi.fetchTransactionNonce.mockResolvedValue(10);

			// Act:
			const result = await manager.createTransaction({
				recipientAddress: currentAccount.address,
				amount: '1'
			});

			// Assert:
			expect(result.transactions).toHaveLength(1);
			expect(result.transactions[0].nonce).toBe(10);
		});
	});
});

import { jest } from '@jest/globals';

const actual = await import('../../src/utils');

const createContractMock = jest.fn();
const createEthereumJrpcProviderMock = jest.fn().mockReturnValue({ provider: 'mock' });

jest.unstable_mockModule('../../src/utils', async () => {
	return {
		...actual,
		createContract: createContractMock,
		createEthereumJrpcProvider: createEthereumJrpcProviderMock
	};
});

const { UniswapService } = await import('../../src/api/UniswapService');

const networkProperties = {
	nodeUrl: 'http://localhost:8545',
	networkIdentifier: 'mainnet',
	networkCurrency: { id: 'ETH', name: 'Ethereum', divisibility: 18 }
};

const NATIVE_TOKEN_ID = '0xNativeToken000000000000000000000000000000';
const WRAPPED_TOKEN_ID = '0xWrappedToken00000000000000000000000000000';
const QUOTER_ADDRESS = '0xQuoterAddress0000000000000000000000000000';

describe('api/UniswapService', () => {
	afterEach(() => {
		jest.restoreAllMocks();
		jest.clearAllMocks();
	});

	describe('fetchPoolTokenInfos', () => {
		const fetchPoolTokenInfosTestCases = [
			{
				description: 'returns token infos for both pool sides with number decimals',
				config: {
					nativeToken: { name: 'Symbol XYM', symbol: 'XYM', decimals: 6 },
					wrappedToken: { name: 'Wrapped XYM', symbol: 'WXYM', decimals: 18 }
				},
				expected: {
					nativeTokenInfo: { id: NATIVE_TOKEN_ID.toLowerCase(), name: 'Symbol XYM', ticker: 'XYM', divisibility: 6 },
					wrappedTokenInfo: { id: WRAPPED_TOKEN_ID.toLowerCase(), name: 'Wrapped XYM', ticker: 'WXYM', divisibility: 18 }
				}
			},
			{
				description: 'converts bigint decimals returned by contract to number divisibility',
				config: {
					nativeToken: { name: 'Token A', symbol: 'TKNA', decimals: 6n },
					wrappedToken: { name: 'Token B', symbol: 'TKNB', decimals: 18n }
				},
				expected: {
					nativeTokenInfo: { id: NATIVE_TOKEN_ID.toLowerCase(), name: 'Token A', ticker: 'TKNA', divisibility: 6 },
					wrappedTokenInfo: { id: WRAPPED_TOKEN_ID.toLowerCase(), name: 'Token B', ticker: 'TKNB', divisibility: 18 }
				}
			}
		];

		const runFetchPoolTokenInfosTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				const nativeContractMock = {
					name: jest.fn().mockResolvedValue(config.nativeToken.name),
					symbol: jest.fn().mockResolvedValue(config.nativeToken.symbol),
					decimals: jest.fn().mockResolvedValue(config.nativeToken.decimals)
				};
				const wrappedContractMock = {
					name: jest.fn().mockResolvedValue(config.wrappedToken.name),
					symbol: jest.fn().mockResolvedValue(config.wrappedToken.symbol),
					decimals: jest.fn().mockResolvedValue(config.wrappedToken.decimals)
				};
				createContractMock
					.mockReturnValueOnce(nativeContractMock)
					.mockReturnValueOnce(wrappedContractMock);

				const service = new UniswapService();

				// Act:
				const result = await service.fetchPoolTokenInfos(networkProperties, NATIVE_TOKEN_ID, WRAPPED_TOKEN_ID);

				// Assert:
				expect(result).toStrictEqual(expected);
			});
		};

		fetchPoolTokenInfosTestCases.forEach(({ description, config, expected }) =>
			runFetchPoolTokenInfosTest(description, config, expected));

		it('creates two ERC20 contracts — one per token — sharing the same provider', async () => {
			// Arrange:
			const contractMock = {
				name: jest.fn().mockResolvedValue('Token'),
				symbol: jest.fn().mockResolvedValue('TKN'),
				decimals: jest.fn().mockResolvedValue(18)
			};
			createContractMock.mockReturnValue(contractMock);

			const service = new UniswapService();

			// Act:
			await service.fetchPoolTokenInfos(networkProperties, NATIVE_TOKEN_ID, WRAPPED_TOKEN_ID);

			// Assert:
			const provider = createEthereumJrpcProviderMock.mock.results[0].value;
			const erc20Abi = expect.arrayContaining([
				'function decimals() view returns (uint8)',
				'function symbol() view returns (string)',
				'function name() view returns (string)'
			]);
			expect(createEthereumJrpcProviderMock).toHaveBeenCalledWith(networkProperties);
			expect(createContractMock).toHaveBeenCalledTimes(2);
			expect(createContractMock).toHaveBeenNthCalledWith(1, NATIVE_TOKEN_ID, erc20Abi, provider);
			expect(createContractMock).toHaveBeenNthCalledWith(2, WRAPPED_TOKEN_ID, erc20Abi, provider);
		});
	});

	describe('quoteExactInputSingle', () => {
		const quoteExactInputSingleTestCases = [
			{
				description: 'returns quoted output amount for 0.05% fee tier (500)',
				config: {
					params: { tokenIn: '0xTokenIn', tokenOut: '0xTokenOut', amountIn: '1000000', fee: 500 },
					rawAmountOut: 997500n
				},
				expected: { amountOut: '997500' }
			},
			{
				description: 'returns quoted output amount for 0.3% fee tier (3000)',
				config: {
					params: { tokenIn: '0xTokenIn', tokenOut: '0xTokenOut', amountIn: '1000000', fee: 3000 },
					rawAmountOut: 985000n
				},
				expected: { amountOut: '985000' }
			},
			{
				description: 'returns quoted output amount for 1% fee tier (10000)',
				config: {
					params: { tokenIn: '0xTokenIn', tokenOut: '0xTokenOut', amountIn: '1000000', fee: 10000 },
					rawAmountOut: 950000n
				},
				expected: { amountOut: '950000' }
			}
		];

		const runQuoteExactInputSingleTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				const staticCallMock = jest.fn().mockResolvedValue(config.rawAmountOut);
				createContractMock.mockReturnValueOnce({
					quoteExactInputSingle: { staticCall: staticCallMock }
				});

				const service = new UniswapService();

				// Act:
				const result = await service.quoteExactInputSingle(networkProperties, QUOTER_ADDRESS, config.params);

				// Assert:
				expect(result).toBe(expected.amountOut);
			});
		};

		quoteExactInputSingleTestCases.forEach(({ description, config, expected }) =>
			runQuoteExactInputSingleTest(description, config, expected));

		it('passes correct params to staticCall with BigInt amountIn and sqrtPriceLimitX96 = 0', async () => {
			// Arrange:
			const params = {
				tokenInId: '0xTokenIn',
				tokenOutId: '0xTokenOut',
				amountIn: '1000000',
				fee: 3000
			};
			const staticCallMock = jest.fn().mockResolvedValue(985000n);
			createContractMock.mockReturnValueOnce({
				quoteExactInputSingle: { staticCall: staticCallMock }
			});

			const service = new UniswapService();

			// Act:
			await service.quoteExactInputSingle(networkProperties, QUOTER_ADDRESS, params);

			// Assert:
			expect(staticCallMock).toHaveBeenCalledWith({
				tokenIn: params.tokenInId,
				tokenOut: params.tokenOutId,
				amountIn: BigInt(params.amountIn),
				fee: params.fee,
				sqrtPriceLimitX96: 0
			});
		});

		it('creates quoter contract with quoter address and correct ABI', async () => {
			// Arrange:
			const params = { tokenIn: '0xA', tokenOut: '0xB', amountIn: '100', fee: 3000 };
			createContractMock.mockReturnValueOnce({
				quoteExactInputSingle: { staticCall: jest.fn().mockResolvedValue(99n) }
			});

			const service = new UniswapService();

			// Act:
			await service.quoteExactInputSingle(networkProperties, QUOTER_ADDRESS, params);

			// Assert:
			const provider = createEthereumJrpcProviderMock.mock.results[0].value;
			expect(createEthereumJrpcProviderMock).toHaveBeenCalledWith(networkProperties);
			expect(createContractMock).toHaveBeenCalledWith(
				QUOTER_ADDRESS,
				expect.arrayContaining([expect.stringContaining('quoteExactInputSingle')]),
				provider
			);
		});

		it('converts bigint amountOut to string', async () => {
			// Arrange:
			const params = { tokenIn: '0xA', tokenOut: '0xB', amountIn: '1000000000000000000', fee: 3000 };
			const largeAmountOut = 999000000000000000n;
			createContractMock.mockReturnValueOnce({
				quoteExactInputSingle: { staticCall: jest.fn().mockResolvedValue(largeAmountOut) }
			});

			const service = new UniswapService();

			// Act:
			const result = await service.quoteExactInputSingle(networkProperties, QUOTER_ADDRESS, params);

			// Assert:
			expect(typeof result).toBe('string');
			expect(result).toBe('999000000000000000');
		});
	});
});

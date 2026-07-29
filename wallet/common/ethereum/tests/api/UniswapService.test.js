import { jest } from '@jest/globals';

// Mocks

const actual = await import('../../src/utils');
const createContractMock = jest.fn();
const createEthereumJrpcProviderMock = jest.fn().mockReturnValue({ provider: 'mock' });

jest.unstable_mockModule('../../src/utils', async () => ({
	...actual,
	createContract: createContractMock,
	createEthereumJrpcProvider: createEthereumJrpcProviderMock
}));

const { UniswapService } = await import('../../src/api/UniswapService');

// Constants

const NATIVE_TOKEN_ID = '0xNativeToken000000000000000000000000000000';
const WRAPPED_TOKEN_ID = '0xWrappedToken00000000000000000000000000000';
const QUOTER_ADDRESS = '0xQuoterAddress0000000000000000000000000000';

// Network Properties

const mainnetNetworkProperties = {
	nodeUrl: 'http://localhost:8545',
	networkIdentifier: 'mainnet',
	networkCurrency: {
		id: 'eth',
		name: 'Ether',
		ticker: 'ETH',
		divisibility: 18
	}
};

// ERC20 Token Fixtures

const xymToken = {
	address: NATIVE_TOKEN_ID,
	name: 'Symbol XYM',
	symbol: 'XYM',
	decimals: 6
};

const bxymToken = {
	address: WRAPPED_TOKEN_ID,
	name: 'Bridged XYM',
	symbol: 'bXYM',
	decimals: 18
};

// Contract Mock Factory

const createContractFixture = token => ({
	name: jest.fn().mockResolvedValue(token.name),
	symbol: jest.fn().mockResolvedValue(token.symbol),
	decimals: jest.fn().mockResolvedValue(token.decimals)
});

// Expected Token Info Factory

const createExpectedTokenInfo = token => ({
	id: token.address.toLowerCase(),
	name: token.name,
	ticker: token.symbol,
	divisibility: Number(token.decimals)
});

describe('api/UniswapService', () => {
	afterEach(() => {
		jest.restoreAllMocks();
		jest.clearAllMocks();
	});

	describe('fetchPoolTokenInfos', () => {
		const runFetchPoolTokenInfosTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				createContractMock
					.mockReturnValueOnce(createContractFixture(config.nativeToken))
					.mockReturnValueOnce(createContractFixture(config.wrappedToken));
				const service = new UniswapService();

				// Act:
				const result = await service.fetchPoolTokenInfos(
					mainnetNetworkProperties,
					NATIVE_TOKEN_ID,
					WRAPPED_TOKEN_ID
				);

				// Assert:
				expect(result).toStrictEqual(expected);
			});
		};

		const fetchPoolTokenInfosTests = [
			{
				description: 'returns token infos for both pool sides with number decimals',
				config: {
					nativeToken: { ...xymToken, decimals: 6 },
					wrappedToken: { ...bxymToken, decimals: 18 }
				},
				expected: {
					nativeTokenInfo: createExpectedTokenInfo(xymToken),
					wrappedTokenInfo: createExpectedTokenInfo(bxymToken)
				}
			},
			{
				description: 'converts bigint decimals returned by contract to number divisibility',
				config: {
					nativeToken: { ...xymToken, decimals: 6n },
					wrappedToken: { ...bxymToken, decimals: 18n }
				},
				expected: {
					nativeTokenInfo: createExpectedTokenInfo(xymToken),
					wrappedTokenInfo: createExpectedTokenInfo(bxymToken)
				}
			}
		];

		fetchPoolTokenInfosTests.forEach(test => {
			runFetchPoolTokenInfosTest(test.description, test.config, test.expected);
		});

		it('creates one ERC20 contract per token with the correct address and ABI', async () => {
			// Arrange:
			const contractMock = createContractFixture(xymToken);
			createContractMock.mockReturnValue(contractMock);
			const service = new UniswapService();

			// Act:
			await service.fetchPoolTokenInfos(mainnetNetworkProperties, NATIVE_TOKEN_ID, WRAPPED_TOKEN_ID);

			// Assert:
			const erc20Abi = expect.arrayContaining([
				'function decimals() view returns (uint8)',
				'function symbol() view returns (string)',
				'function name() view returns (string)'
			]);
			expect(createEthereumJrpcProviderMock).toHaveBeenCalledWith(mainnetNetworkProperties);
			expect(createContractMock).toHaveBeenCalledTimes(2);
			expect(createContractMock).toHaveBeenNthCalledWith(
				1, 
				NATIVE_TOKEN_ID, 
				erc20Abi, 
				createEthereumJrpcProviderMock.mock.results[0].value
			);
			expect(createContractMock).toHaveBeenNthCalledWith(
				2, 
				WRAPPED_TOKEN_ID, 
				erc20Abi, 
				createEthereumJrpcProviderMock.mock.results[1].value
			);
		});
	});

	describe('quoteExactInputSingle', () => {
		const sqrtPriceX96After = 93455262124906132660367607190557n;

		const runQuoteExactInputSingleTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				const staticCallMock = jest.fn().mockResolvedValue(config.rawQuote);
				createContractMock.mockReturnValueOnce({
					quoteExactInputSingle: { staticCall: staticCallMock }
				});
				const service = new UniswapService();

				// Act:
				const result = await service.quoteExactInputSingle(
					mainnetNetworkProperties,
					QUOTER_ADDRESS,
					config.params
				);

				// Assert:
				expect(result).toStrictEqual(expected.quote);
			});
		};

		const quoteExactInputSingleTests = [
			{
				description: 'returns quoted output amount for 0.05% fee tier (500)',
				config: {
					params: { tokenInId: NATIVE_TOKEN_ID, tokenOutId: WRAPPED_TOKEN_ID, amountIn: '1000000', fee: 500 },
					rawQuote: [997_500n, sqrtPriceX96After, 0n, 91_602n]
				},
				expected: {
					quote: {
						amountOut: '997500',
						sqrtPriceX96After: sqrtPriceX96After.toString(),
						initializedTicksCrossed: 0,
						gasEstimate: '91602'
					}
				}
			},
			{
				description: 'returns quoted output amount for 0.3% fee tier (3000)',
				config: {
					params: { tokenInId: NATIVE_TOKEN_ID, tokenOutId: WRAPPED_TOKEN_ID, amountIn: '1000000', fee: 3000 },
					rawQuote: [985_000n, sqrtPriceX96After, 2n, 130_000n]
				},
				expected: {
					quote: {
						amountOut: '985000',
						sqrtPriceX96After: sqrtPriceX96After.toString(),
						initializedTicksCrossed: 2,
						gasEstimate: '130000'
					}
				}
			},
			{
				description: 'returns large bigint values as strings',
				config: {
					params: { tokenInId: NATIVE_TOKEN_ID, tokenOutId: WRAPPED_TOKEN_ID, amountIn: '1000000000000000000', fee: 3000 },
					rawQuote: [999_000_000_000_000_000n, sqrtPriceX96After, 4n, 200_000n]
				},
				expected: {
					quote: {
						amountOut: '999000000000000000',
						sqrtPriceX96After: sqrtPriceX96After.toString(),
						initializedTicksCrossed: 4,
						gasEstimate: '200000'
					}
				}
			}
		];

		quoteExactInputSingleTests.forEach(test => {
			runQuoteExactInputSingleTest(test.description, test.config, test.expected);
		});

		it('passes correct params to staticCall with BigInt amountIn and sqrtPriceLimitX96 = 0', async () => {
			// Arrange:
			const params = {
				tokenInId: NATIVE_TOKEN_ID,
				tokenOutId: WRAPPED_TOKEN_ID,
				amountIn: '1000000',
				fee: 3000
			};
			const staticCallMock = jest.fn().mockResolvedValue([985_000n, sqrtPriceX96After, 0n, 91_602n]);
			createContractMock.mockReturnValueOnce({
				quoteExactInputSingle: { staticCall: staticCallMock }
			});
			const service = new UniswapService();

			// Act:
			await service.quoteExactInputSingle(mainnetNetworkProperties, QUOTER_ADDRESS, params);

			// Assert:
			expect(staticCallMock).toHaveBeenCalledWith({
				tokenIn: params.tokenInId,
				tokenOut: params.tokenOutId,
				amountIn: BigInt(params.amountIn),
				fee: params.fee,
				sqrtPriceLimitX96: 0
			});
		});

		it('creates quoter contract with the quoter address and quoteExactInputSingle ABI', async () => {
			// Arrange:
			const params = { tokenInId: NATIVE_TOKEN_ID, tokenOutId: WRAPPED_TOKEN_ID, amountIn: '100', fee: 3000 };
			createContractMock.mockReturnValueOnce({
				quoteExactInputSingle: { staticCall: jest.fn().mockResolvedValue([99n, sqrtPriceX96After, 0n, 91_602n]) }
			});
			const service = new UniswapService();

			// Act:
			await service.quoteExactInputSingle(mainnetNetworkProperties, QUOTER_ADDRESS, params);

			// Assert:
			const provider = createEthereumJrpcProviderMock.mock.results[0].value;
			expect(createEthereumJrpcProviderMock).toHaveBeenCalledWith(mainnetNetworkProperties);
			expect(createContractMock).toHaveBeenCalledWith(
				QUOTER_ADDRESS,
				expect.arrayContaining([expect.stringContaining('quoteExactInputSingle')]),
				provider
			);
		});
	});

	describe('quoteExactOutputSingle', () => {
		const sqrtPriceX96After = 93497613353213384457885328768846n;

		it('returns required input amount and post-swap price as strings', async () => {
			// Arrange:
			const params = {
				tokenInId: NATIVE_TOKEN_ID,
				tokenOutId: WRAPPED_TOKEN_ID,
				amountOut: '35811296',
				fee: 3000
			};
			const staticCallMock = jest.fn().mockResolvedValue([49_988_672_502_728n, sqrtPriceX96After, 0n, 91_602n]);
			createContractMock.mockReturnValueOnce({
				quoteExactOutputSingle: { staticCall: staticCallMock }
			});
			const service = new UniswapService();

			// Act:
			const result = await service.quoteExactOutputSingle(mainnetNetworkProperties, QUOTER_ADDRESS, params);

			// Assert:
			expect(result).toStrictEqual({
				amountIn: '49988672502728',
				sqrtPriceX96After: sqrtPriceX96After.toString()
			});
		});

		it('passes correct params to staticCall with BigInt amount and sqrtPriceLimitX96 = 0', async () => {
			// Arrange:
			const params = {
				tokenInId: NATIVE_TOKEN_ID,
				tokenOutId: WRAPPED_TOKEN_ID,
				amountOut: '1000000',
				fee: 3000
			};
			const staticCallMock = jest.fn().mockResolvedValue([1_003_000n, sqrtPriceX96After, 0n, 91_602n]);
			createContractMock.mockReturnValueOnce({
				quoteExactOutputSingle: { staticCall: staticCallMock }
			});
			const service = new UniswapService();

			// Act:
			await service.quoteExactOutputSingle(mainnetNetworkProperties, QUOTER_ADDRESS, params);

			// Assert:
			expect(staticCallMock).toHaveBeenCalledWith({
				tokenIn: params.tokenInId,
				tokenOut: params.tokenOutId,
				amount: BigInt(params.amountOut),
				fee: params.fee,
				sqrtPriceLimitX96: 0
			});
		});
	});
});

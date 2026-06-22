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

const { TokenService } = await import('../../src/api/TokenService');

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

const usdcToken = {
	address: '0xTokenUsdc',
	decimals: 6,
	symbol: 'USDC',
	name: 'USD Coin'
};

const daiToken = {
	address: '0xTokenDai',
	decimals: 18,
	symbol: 'DAI',
	name: 'Dai Stablecoin'
};

// Contract Mock Factory

const createContractFixture = token => ({
	decimals: jest.fn().mockResolvedValue(token.decimals),
	symbol: jest.fn().mockResolvedValue(token.symbol),
	name: jest.fn().mockResolvedValue(token.name)
});

// Expected Token Info Factory

const createExpectedTokenInfo = token => ({
	id: token.address.toLowerCase(),
	name: token.name,
	ticker: token.symbol,
	divisibility: token.decimals
});

describe('api/TokenService', () => {
	afterEach(() => {
		jest.restoreAllMocks();
		jest.clearAllMocks();
	});

	describe('fetchTokenInfo', () => {
		it('returns network currency info when token id matches native currency', async () => {
			// Arrange:
			const service = new TokenService();
			const tokenId = mainnetNetworkProperties.networkCurrency.id;

			// Act:
			const result = await service.fetchTokenInfo(mainnetNetworkProperties, tokenId);

			// Assert:
			expect(createContractMock).not.toHaveBeenCalled();
			expect(result).toStrictEqual(mainnetNetworkProperties.networkCurrency);
		});

		const runFetchTokenInfoTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				createContractMock.mockReturnValueOnce(createContractFixture(config.token));
				const service = new TokenService();

				// Act:
				const result = await service.fetchTokenInfo(mainnetNetworkProperties, config.token.address);

				// Assert:
				expect(createEthereumJrpcProviderMock).toHaveBeenCalledWith(mainnetNetworkProperties);
				expect(createContractMock).toHaveBeenCalledWith(
					config.token.address,
					expect.arrayContaining([
						'function balanceOf(address) view returns (uint256)',
						'function decimals() view returns (uint8)',
						'function symbol() view returns (string)',
						'function name() view returns (string)'
					]),
					createEthereumJrpcProviderMock.mock.results[0].value
				);
				expect(result).toStrictEqual(expected.tokenInfo);
			});
		};

		const fetchTokenInfoTests = [
			{
				description: 'returns token info for a 6-decimal ERC20 token',
				config: { token: usdcToken },
				expected: { tokenInfo: createExpectedTokenInfo(usdcToken) }
			},
			{
				description: 'returns token info for an 18-decimal ERC20 token',
				config: { token: daiToken },
				expected: { tokenInfo: createExpectedTokenInfo(daiToken) }
			}
		];

		fetchTokenInfoTests.forEach(test => {
			runFetchTokenInfoTest(test.description, test.config, test.expected);
		});
	});

	describe('fetchTokenInfos', () => {
		it('returns a token info map for multiple token ids', async () => {
			// Arrange:
			const contractsByAddress = {
				[usdcToken.address]: createContractFixture(usdcToken),
				[daiToken.address]: createContractFixture(daiToken)
			};
			createContractMock.mockImplementation(tokenAddress => contractsByAddress[tokenAddress]);
			const service = new TokenService();
			const tokenIds = [usdcToken.address, daiToken.address];

			// Act:
			const result = await service.fetchTokenInfos(mainnetNetworkProperties, tokenIds);

			// Assert:
			expect(createContractMock).toHaveBeenCalledTimes(tokenIds.length);
			expect(result).toStrictEqual({
				[usdcToken.address.toLowerCase()]: createExpectedTokenInfo(usdcToken),
				[daiToken.address.toLowerCase()]: createExpectedTokenInfo(daiToken)
			});
		});
	});
});

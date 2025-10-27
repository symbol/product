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

const { TokenService } = await import('../../src/api/TokenService');

const networkProperties = {
	nodeUrl: 'http://localhost:8545',
	networkIdentifier: 'mainnet',
	networkCurrency: { id: 'ETH', name: 'Ethereum', divisibility: 18 }
};

describe('api/TokenService', () => {
	afterEach(() => {
		jest.restoreAllMocks();
		jest.clearAllMocks();
	});

	describe('fetchTokenInfo', () => {
		it('returns token info with symbol as name and decimals as divisibility', async () => {
			// Arrange:
			const tokenId = '0xTokenA';
			const contractMock = {
				decimals: jest.fn().mockResolvedValue(6),
				symbol: jest.fn().mockResolvedValue('USDC')
			};
			createContractMock.mockReturnValueOnce(contractMock);

			const service = new TokenService();

			// Act:
			const result = await service.fetchTokenInfo(networkProperties, tokenId);

			// Assert:
			expect(createEthereumJrpcProviderMock).toHaveBeenCalledWith(networkProperties);
			expect(createContractMock).toHaveBeenCalledTimes(1);

			const [passedTokenId, abi, provider] = createContractMock.mock.calls[0];
			expect(passedTokenId).toBe(tokenId);
			expect(abi).toEqual(expect.arrayContaining([
				'function balanceOf(address) view returns (uint256)',
				'function decimals() view returns (uint8)',
				'function symbol() view returns (string)'
			]));
			// Provider instance passed to createContract is the one returned by createEthereumJrpcProvider
			expect(provider).toBe(createEthereumJrpcProviderMock.mock.results[0].value);

			expect(contractMock.decimals).toHaveBeenCalledTimes(1);
			expect(contractMock.symbol).toHaveBeenCalledTimes(1);

			const expectedResult = {
				id: tokenId,
				name: 'USDC',
				divisibility: 6
			};
			expect(result).toStrictEqual(expectedResult);
		});
	});

	describe('fetchTokenInfos', () => {
		it('returns a token info map for multiple token ids', async () => {
			// Arrange:
			const tokenA = '0xTokenA';
			const tokenB = '0xTokenB';
			const tokenIds = [tokenA, tokenB];

			const decimalsByToken = {
				[tokenA]: 6,
				[tokenB]: 18
			};
			const symbolsByToken = {
				[tokenA]: 'USDC',
				[tokenB]: 'DAI'
			};

			createContractMock.mockImplementation((tokenAddress /*, abi, provider */) => ({
				decimals: jest.fn().mockResolvedValue(decimalsByToken[tokenAddress]),
				symbol: jest.fn().mockResolvedValue(symbolsByToken[tokenAddress])
			}));

			const service = new TokenService();

			// Act:
			const result = await service.fetchTokenInfos(networkProperties, tokenIds);

			// Assert:
			expect(createEthereumJrpcProviderMock).toHaveBeenCalledTimes(tokenIds.length);
			expect(createContractMock).toHaveBeenCalledTimes(tokenIds.length);

			const expectedResult = {
				[tokenA]: { id: tokenA, name: 'USDC', divisibility: 6 },
				[tokenB]: { id: tokenB, name: 'DAI', divisibility: 18 }
			};
			expect(result).toStrictEqual(expectedResult);
		});
	});
});

import { jest } from '@jest/globals';
import { ethers } from 'ethers';

// Mocks

const actual = await import('../../src/utils');
const createContractMock = jest.fn();

jest.unstable_mockModule('../../src/utils', async () => ({
	...actual,
	createContract: createContractMock
}));

const { AccountService } = await import('../../src/api/AccountService');

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

// Account Address Fixtures

const ACCOUNT_ADDRESS = '0xAbCDEF0000000000000000000000000000000000';
const ACCOUNT_ADDRESS_LOWER = ACCOUNT_ADDRESS.toLowerCase();

// ERC20 Token Fixtures

const usdcToken = {
	address: '0xTokenUsdc',
	balanceRaw: 2_500_000n,                      // 2.5 USDC (6 decimals)
	decimals: 6,
	symbol: 'USDC',
	name: 'USD Coin',
	expectedAmount: '2.5'
};

const daiToken = {
	address: '0xTokenDai',
	balanceRaw: 10_000_000_000_000_000_000n,     // 10 DAI (18 decimals)
	decimals: 18,
	symbol: 'DAI',
	name: 'Dai Stablecoin',
	expectedAmount: '10'
};

// Contract Mock Factory

const createContractFixture = token => ({
	balanceOf: jest.fn().mockResolvedValue(token.balanceRaw),
	decimals: jest.fn().mockResolvedValue(token.decimals),
	symbol: jest.fn().mockResolvedValue(token.symbol),
	name: jest.fn().mockResolvedValue(token.name)
});

// Service Factory

const createService = (config = {}) => {
	const erc20TokensAddresses = config.erc20TokensAddresses ?? {
		[mainnetNetworkProperties.networkIdentifier]: [usdcToken.address, daiToken.address]
	};
	return new AccountService({ config: { erc20TokensAddresses } });
};

describe('api/AccountService', () => {
	afterEach(() => {
		jest.restoreAllMocks();
		jest.clearAllMocks();
	});

	describe('fetchAccountBalance', () => {
		it('returns native currency balance as a relative amount string', async () => {
			// Arrange:
			const nativeBalanceRaw = 1_230_000_000_000_000_000n; // 1.23 ETH
			jest.spyOn(ethers.JsonRpcProvider.prototype, 'getBalance')
				.mockResolvedValue(nativeBalanceRaw);
			const service = createService({ erc20TokensAddresses: {} });

			// Act:
			const result = await service.fetchAccountBalance(mainnetNetworkProperties, ACCOUNT_ADDRESS);

			// Assert:
			expect(result).toBe('1.23');
		});
	});

	describe('fetchAccountInfo', () => {
		it('returns account info with native balance and configured ERC20 token balances', async () => {
			// Arrange:
			jest.spyOn(ethers.JsonRpcProvider.prototype, 'getBalance')
				.mockResolvedValue(1_230_000_000_000_000_000n); // 1.23 ETH
			const contractsByAddress = {
				[usdcToken.address]: createContractFixture(usdcToken),
				[daiToken.address]: createContractFixture(daiToken)
			};
			createContractMock.mockImplementation(tokenAddress => contractsByAddress[tokenAddress]);
			const service = createService();

			// Act:
			const result = await service.fetchAccountInfo(mainnetNetworkProperties, ACCOUNT_ADDRESS);

			// Assert:
			expect(result).toStrictEqual({
				address: ACCOUNT_ADDRESS_LOWER,
				balance: '1.23',
				tokens: [
					{
						id: mainnetNetworkProperties.networkCurrency.id,
						name: mainnetNetworkProperties.networkCurrency.name,
						ticker: mainnetNetworkProperties.networkCurrency.ticker,
						divisibility: mainnetNetworkProperties.networkCurrency.divisibility,
						amount: '1.23'
					},
					{
						id: usdcToken.address.toLowerCase(),
						name: usdcToken.name,
						ticker: usdcToken.symbol,
						divisibility: usdcToken.decimals,
						amount: usdcToken.expectedAmount
					},
					{
						id: daiToken.address.toLowerCase(),
						name: daiToken.name,
						ticker: daiToken.symbol,
						divisibility: daiToken.decimals,
						amount: daiToken.expectedAmount
					}
				]
			});
		});

		it('returns only native token when no ERC20 tokens are configured for the network', async () => {
			// Arrange:
			jest.spyOn(ethers.JsonRpcProvider.prototype, 'getBalance')
				.mockResolvedValue(5_000_000_000_000_000_000n); // 5 ETH
			const service = createService({ erc20TokensAddresses: {} });

			// Act:
			const result = await service.fetchAccountInfo(mainnetNetworkProperties, ACCOUNT_ADDRESS);

			// Assert:
			expect(createContractMock).not.toHaveBeenCalled();
			expect(result).toStrictEqual({
				address: ACCOUNT_ADDRESS_LOWER,
				balance: '5',
				tokens: [
					{
						id: mainnetNetworkProperties.networkCurrency.id,
						name: mainnetNetworkProperties.networkCurrency.name,
						ticker: mainnetNetworkProperties.networkCurrency.ticker,
						divisibility: mainnetNetworkProperties.networkCurrency.divisibility,
						amount: '5'
					}
				]
			});
		});
	});
});

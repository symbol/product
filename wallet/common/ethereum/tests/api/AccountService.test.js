import { jest } from '@jest/globals';
import { ethers } from 'ethers';

const actual = await import('../../src/utils');
const createContractMock = jest.fn();
jest.unstable_mockModule('../../src/utils', async () => {
	return {
		...actual,
		createContract: createContractMock
	};
});

const { AccountService } = await import('../../src/api/AccountService');

describe('api/AccountService', () => {
	afterEach(() => {
		jest.restoreAllMocks();
		jest.clearAllMocks();
	});

	describe('fetchAccountBalance', () => {
		it('returns relative ETH balance string', async () => {
			// Arrange:
			const networkProperties = {
				nodeUrl: 'http://localhost:8545',
				networkIdentifier: 'mainnet',
				networkCurrency: { id: 'ETH', name: 'Ethereum', divisibility: 18 }
			};
			const address = '0xAbCDEF0000000000000000000000000000000000';

			// 1.23 ETH in wei
			jest.spyOn(ethers.JsonRpcProvider.prototype, 'getBalance')
				.mockResolvedValue(1230000000000000000n);

			// Act:
			const service = new AccountService({ config: { erc20TokensAddresses: {} } });
			const result = await service.fetchAccountBalance(networkProperties, address);

			// Assert:
			expect(result).toBe('1.23');
		});
	});

	describe('fetchAccountInfo', () => {
		it('returns account info including native balance and configured ERC20 token balances', async () => {
			// Arrange:
			const networkProperties = {
				nodeUrl: 'http://localhost:8545',
				networkIdentifier: 'mainnet',
				networkCurrency: { id: 'ETH', name: 'Ethereum', divisibility: 18 }
			};
			const address = '0xAbCDEF0000000000000000000000000000000000';
			const lowerAddress = address.toLowerCase();

			// Native balance: 1.23 ETH
			jest.spyOn(ethers.JsonRpcProvider.prototype, 'getBalance')
				.mockResolvedValue(1230000000000000000n);

			// ERC20 contracts and responses
			const tokenA = '0xTokenA';
			const tokenB = '0xTokenB';

			const balances = {
				[tokenA]: 2_500_000n,                     // USDC 2.5 with 6 decimals
				[tokenB]: 10_000_000_000_000_000_000n    // DAI 10 with 18 decimals
			};
			const decimals = {
				[tokenA]: 6,
				[tokenB]: 18
			};
			const symbols = {
				[tokenA]: 'USDC',
				[tokenB]: 'DAI'
			};

			createContractMock.mockImplementation((tokenAddress /*, abi, provider */) => ({
				balanceOf: jest.fn().mockResolvedValue(balances[tokenAddress]),
				decimals: jest.fn().mockResolvedValue(decimals[tokenAddress]),
				symbol: jest.fn().mockResolvedValue(symbols[tokenAddress])
			}));

			const service = new AccountService({
				config: {
					erc20TokensAddresses: {
						[networkProperties.networkIdentifier]: [tokenA, tokenB]
					}
				}
			});

			// Act:
			const result = await service.fetchAccountInfo(networkProperties, address);

			// Assert:
			const expected = {
				address: lowerAddress,
				balance: '1.23',
				tokens: [
					{
						id: 'ETH',
						name: 'Ethereum',
						divisibility: 18,
						amount: '1.23'
					},
					{
						id: tokenA,
						amount: '2.5',
						name: 'USDC',
						divisibility: 6
					},
					{
						id: tokenB,
						amount: '10',
						name: 'DAI',
						divisibility: 18
					}
				]
			};
			expect(result).toStrictEqual(expected);
		});

		it('returns only native token when no ERC20 tokens configured for network', async () => {
			// Arrange:
			const networkProperties = {
				nodeUrl: 'http://localhost:8545',
				networkIdentifier: 'mainnet',
				networkCurrency: { id: 'ETH', name: 'Ethereum', divisibility: 18 }
			};
			const address = '0xABC0000000000000000000000000000000000000';

			jest.spyOn(ethers.JsonRpcProvider.prototype, 'getBalance')
				.mockResolvedValue(5_000_000_000_000_000_000n); // 5 ETH

			const service = new AccountService({
				config: { erc20TokensAddresses: { othernet: ['0xIGNORED'] } }
			});

			// Act:
			const result = await service.fetchAccountInfo(networkProperties, address);

			// Assert:
			const expected = {
				address: address.toLowerCase(),
				balance: '5',
				tokens: [
					{
						id: 'ETH',
						name: 'Ethereum',
						divisibility: 18,
						amount: '5'
					}
				]
			};
			expect(result).toStrictEqual(expected);
		});
	});
});

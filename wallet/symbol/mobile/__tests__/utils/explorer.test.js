import {
	createExplorerAccountUrl,
	createExplorerNamespaceUrl,
	createExplorerTransactionUrl,
	createTokenExplorerUrl
} from '@/app/utils/explorer';

jest.mock('@/app/config', () => ({
	config: {
		chains: {
			symbol: {
				explorerURL: {
					mainnet: 'https://symbol.fyi',
					testnet: 'https://testnet.symbol.fyi'
				}
			},
			ethereum: {
				explorerURL: {
					mainnet: 'https://etherscan.io',
					testnet: 'https://sepolia.etherscan.io'
				}
			}
		}
	}
}));

describe('utils/explorer', () => {
	describe('createExplorerTransactionUrl', () => {
		const runCreateExplorerTransactionUrlTest = (description, config, expected) => {
			it(description, () => {
				// Act:
				const result = createExplorerTransactionUrl(config.chainName, config.networkIdentifier, config.transactionHash);

				// Assert:
				expect(result).toBe(expected.url);
			});
		};

		const tests = [
			{
				description: 'creates transaction URL for symbol mainnet',
				config: {
					chainName: 'symbol',
					networkIdentifier: 'mainnet',
					transactionHash: 'ABC123'
				},
				expected: { url: 'https://symbol.fyi/transactions/ABC123' }
			},
			{
				description: 'creates transaction URL for symbol testnet',
				config: {
					chainName: 'symbol',
					networkIdentifier: 'testnet',
					transactionHash: 'DEF456'
				},
				expected: { url: 'https://testnet.symbol.fyi/transactions/DEF456' }
			},
			{
				description: 'creates transaction URL for ethereum mainnet',
				config: {
					chainName: 'ethereum',
					networkIdentifier: 'mainnet',
					transactionHash: '0x123abc'
				},
				expected: { url: 'https://etherscan.io/tx/0x123abc' }
			},
			{
				description: 'creates transaction URL for ethereum testnet',
				config: {
					chainName: 'ethereum',
					networkIdentifier: 'testnet',
					transactionHash: '0x456def'
				},
				expected: { url: 'https://sepolia.etherscan.io/tx/0x456def' }
			}
		];

		tests.forEach(test => {
			runCreateExplorerTransactionUrlTest(test.description, test.config, test.expected);
		});

		it('throws error for unsupported chain', () => {
			// Act & Assert:
			expect(() => createExplorerTransactionUrl('unsupported', 'mainnet', 'hash123'))
				.toThrow('Cannot create explorer URL for transaction on chain "unsupported"');
		});
	});

	describe('createExplorerAccountUrl', () => {
		const runCreateExplorerAccountUrlTest = (description, config, expected) => {
			it(description, () => {
				// Act:
				const result = createExplorerAccountUrl(config.chainName, config.networkIdentifier, config.address);

				// Assert:
				expect(result).toBe(expected.url);
			});
		};

		const tests = [
			{
				description: 'creates account URL for symbol mainnet',
				config: {
					chainName: 'symbol',
					networkIdentifier: 'mainnet',
					address: 'NABCDEF123456'
				},
				expected: { url: 'https://symbol.fyi/accounts/NABCDEF123456' }
			},
			{
				description: 'creates account URL for symbol testnet',
				config: {
					chainName: 'symbol',
					networkIdentifier: 'testnet',
					address: 'TABCDEF789012'
				},
				expected: { url: 'https://testnet.symbol.fyi/accounts/TABCDEF789012' }
			},
			{
				description: 'creates account URL for ethereum mainnet',
				config: {
					chainName: 'ethereum',
					networkIdentifier: 'mainnet',
					address: '0x1234567890abcdef'
				},
				expected: { url: 'https://etherscan.io/address/0x1234567890abcdef' }
			},
			{
				description: 'creates account URL for ethereum testnet',
				config: {
					chainName: 'ethereum',
					networkIdentifier: 'testnet',
					address: '0xfedcba0987654321'
				},
				expected: { url: 'https://sepolia.etherscan.io/address/0xfedcba0987654321' }
			}
		];

		tests.forEach(test => {
			runCreateExplorerAccountUrlTest(test.description, test.config, test.expected);
		});

		it('throws error for unsupported chain', () => {
			// Act & Assert:
			expect(() => createExplorerAccountUrl('unsupported', 'mainnet', 'address123'))
				.toThrow('Cannot create explorer URL for account on chain "unsupported"');
		});
	});

	describe('createTokenExplorerUrl', () => {
		const runCreateTokenExplorerUrlTest = (description, config, expected) => {
			it(description, () => {
				// Act:
				const result = createTokenExplorerUrl(config.chainName, config.networkIdentifier, config.tokenId);

				// Assert:
				expect(result).toBe(expected.url);
			});
		};

		const tests = [
			{
				description: 'creates token URL for symbol mainnet',
				config: {
					chainName: 'symbol',
					networkIdentifier: 'mainnet',
					tokenId: '6BED913FA20223F8'
				},
				expected: { url: 'https://symbol.fyi/mosaics/6BED913FA20223F8' }
			},
			{
				description: 'creates token URL for symbol testnet',
				config: {
					chainName: 'symbol',
					networkIdentifier: 'testnet',
					tokenId: '72C0212E67A08BCE'
				},
				expected: { url: 'https://testnet.symbol.fyi/mosaics/72C0212E67A08BCE' }
			},
			{
				description: 'creates token URL for ethereum mainnet',
				config: {
					chainName: 'ethereum',
					networkIdentifier: 'mainnet',
					tokenId: '0xtoken123'
				},
				expected: { url: 'https://etherscan.io/address/0xtoken123' }
			},
			{
				description: 'creates token URL for ethereum testnet',
				config: {
					chainName: 'ethereum',
					networkIdentifier: 'testnet',
					tokenId: '0xtoken456'
				},
				expected: { url: 'https://sepolia.etherscan.io/address/0xtoken456' }
			}
		];

		tests.forEach(test => {
			runCreateTokenExplorerUrlTest(test.description, test.config, test.expected);
		});
	});

	describe('createExplorerNamespaceUrl', () => {
		const runCreateExplorerNamespaceUrlTest = (description, config, expected) => {
			it(description, () => {
				// Act:
				const result = createExplorerNamespaceUrl(config.chainName, config.networkIdentifier, config.namespaceId);

				// Assert:
				expect(result).toBe(expected.url);
			});
		};

		const tests = [
			{
				description: 'creates namespace URL for symbol mainnet',
				config: {
					chainName: 'symbol',
					networkIdentifier: 'mainnet',
					namespaceId: 'symbol.xym'
				},
				expected: { url: 'https://symbol.fyi/namespaces/symbol.xym' }
			},
			{
				description: 'creates namespace URL for symbol testnet',
				config: {
					chainName: 'symbol',
					networkIdentifier: 'testnet',
					namespaceId: 'test.namespace'
				},
				expected: { url: 'https://testnet.symbol.fyi/namespaces/test.namespace' }
			}
		];

		tests.forEach(test => {
			runCreateExplorerNamespaceUrlTest(test.description, test.config, test.expected);
		});

		it('throws error for unsupported chain', () => {
			// Act & Assert:
			expect(() => createExplorerNamespaceUrl('ethereum', 'mainnet', 'namespace123'))
				.toThrow('Cannot create explorer URL for namespace on chain "ethereum"');
		});
	});
});

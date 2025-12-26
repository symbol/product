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

describe('explorer utils', () => {
	describe('createExplorerTransactionUrl', () => {
		const runCreateExplorerTransactionUrlTest = (config, expected) => {
			it(`creates transaction URL for ${config.chainName} ${config.networkIdentifier}`, () => {
				// Act:
				const result = createExplorerTransactionUrl(config.chainName, config.networkIdentifier, config.transactionHash);

				// Assert:
				expect(result).toBe(expected.url);
			});
		};

		const tests = [
			{
				chainName: 'symbol',
				networkIdentifier: 'mainnet',
				transactionHash: 'ABC123',
				expected: { url: 'https://symbol.fyi/transactions/ABC123' }
			},
			{
				chainName: 'symbol',
				networkIdentifier: 'testnet',
				transactionHash: 'DEF456',
				expected: { url: 'https://testnet.symbol.fyi/transactions/DEF456' }
			},
			{
				chainName: 'ethereum',
				networkIdentifier: 'mainnet',
				transactionHash: '0x123abc',
				expected: { url: 'https://etherscan.io/tx/0x123abc' }
			},
			{
				chainName: 'ethereum',
				networkIdentifier: 'testnet',
				transactionHash: '0x456def',
				expected: { url: 'https://sepolia.etherscan.io/tx/0x456def' }
			}
		];

		tests.forEach(test => {
			runCreateExplorerTransactionUrlTest(
				{ chainName: test.chainName, networkIdentifier: test.networkIdentifier, transactionHash: test.transactionHash },
				test.expected
			);
		});

		it('throws error for unsupported chain', () => {
			// Act & Assert:
			expect(() => createExplorerTransactionUrl('unsupported', 'mainnet', 'hash123'))
				.toThrow('Cannot create explorer URL for transaction on chain "unsupported"');
		});
	});

	describe('createExplorerAccountUrl', () => {
		const runCreateExplorerAccountUrlTest = (config, expected) => {
			it(`creates account URL for ${config.chainName} ${config.networkIdentifier}`, () => {
				// Act:
				const result = createExplorerAccountUrl(config.chainName, config.networkIdentifier, config.address);

				// Assert:
				expect(result).toBe(expected.url);
			});
		};

		const tests = [
			{
				chainName: 'symbol',
				networkIdentifier: 'mainnet',
				address: 'NABCDEF123456',
				expected: { url: 'https://symbol.fyi/accounts/NABCDEF123456' }
			},
			{
				chainName: 'symbol',
				networkIdentifier: 'testnet',
				address: 'TABCDEF789012',
				expected: { url: 'https://testnet.symbol.fyi/accounts/TABCDEF789012' }
			},
			{
				chainName: 'ethereum',
				networkIdentifier: 'mainnet',
				address: '0x1234567890abcdef',
				expected: { url: 'https://etherscan.io/address/0x1234567890abcdef' }
			},
			{
				chainName: 'ethereum',
				networkIdentifier: 'testnet',
				address: '0xfedcba0987654321',
				expected: { url: 'https://sepolia.etherscan.io/address/0xfedcba0987654321' }
			}
		];

		tests.forEach(test => {
			runCreateExplorerAccountUrlTest(
				{ chainName: test.chainName, networkIdentifier: test.networkIdentifier, address: test.address },
				test.expected
			);
		});

		it('throws error for unsupported chain', () => {
			// Act & Assert:
			expect(() => createExplorerAccountUrl('unsupported', 'mainnet', 'address123'))
				.toThrow('Cannot create explorer URL for account on chain "unsupported"');
		});
	});

	describe('createTokenExplorerUrl', () => {
		const runCreateTokenExplorerUrlTest = (config, expected) => {
			it(`creates token URL for ${config.chainName} ${config.networkIdentifier}`, () => {
				// Act:
				const result = createTokenExplorerUrl(config.chainName, config.networkIdentifier, config.tokenId);

				// Assert:
				expect(result).toBe(expected.url);
			});
		};

		const tests = [
			{
				chainName: 'symbol',
				networkIdentifier: 'mainnet',
				tokenId: '6BED913FA20223F8',
				expected: { url: 'https://symbol.fyi/mosaics/6BED913FA20223F8' }
			},
			{
				chainName: 'symbol',
				networkIdentifier: 'testnet',
				tokenId: '72C0212E67A08BCE',
				expected: { url: 'https://testnet.symbol.fyi/mosaics/72C0212E67A08BCE' }
			},
			{
				chainName: 'ethereum',
				networkIdentifier: 'mainnet',
				tokenId: '0xtoken123',
				expected: { url: 'https://etherscan.io/address/0xtoken123' }
			},
			{
				chainName: 'ethereum',
				networkIdentifier: 'testnet',
				tokenId: '0xtoken456',
				expected: { url: 'https://sepolia.etherscan.io/address/0xtoken456' }
			}
		];

		tests.forEach(test => {
			runCreateTokenExplorerUrlTest(
				{ chainName: test.chainName, networkIdentifier: test.networkIdentifier, tokenId: test.tokenId },
				test.expected
			);
		});
	});

	describe('createExplorerNamespaceUrl', () => {
		const runCreateExplorerNamespaceUrlTest = (config, expected) => {
			it(`creates namespace URL for ${config.chainName} ${config.networkIdentifier}`, () => {
				// Act:
				const result = createExplorerNamespaceUrl(config.chainName, config.networkIdentifier, config.namespaceId);

				// Assert:
				expect(result).toBe(expected.url);
			});
		};

		const tests = [
			{
				chainName: 'symbol',
				networkIdentifier: 'mainnet',
				namespaceId: 'symbol.xym',
				expected: { url: 'https://symbol.fyi/namespaces/symbol.xym' }
			},
			{
				chainName: 'symbol',
				networkIdentifier: 'testnet',
				namespaceId: 'test.namespace',
				expected: { url: 'https://testnet.symbol.fyi/namespaces/test.namespace' }
			}
		];

		tests.forEach(test => {
			runCreateExplorerNamespaceUrlTest(
				{ chainName: test.chainName, networkIdentifier: test.networkIdentifier, namespaceId: test.namespaceId },
				test.expected
			);
		});

		it('throws error for unsupported chain', () => {
			// Act & Assert:
			expect(() => createExplorerNamespaceUrl('ethereum', 'mainnet', 'namespace123'))
				.toThrow('Cannot create explorer URL for namespace on chain "ethereum"');
		});
	});
});

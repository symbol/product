import { chainIdToNetworkIdentifier, createWebSocketUrl, networkIdentifierToChainId } from '../../src/utils';


describe('utils/network', () => {
	describe('networkIdentifierToChainId', () => {
		it('returns the chain ID from a given network identifier', () => {
			// Arrange:
			const networkIdentifiersAndExpectedChainIds = [
				{ networkIdentifier: 'mainnet', expectedChainId: 1 },
				{ networkIdentifier: 'testnet', expectedChainId: 3151908 },
				{ networkIdentifier: 'sepolia', expectedChainId: 11155111 }
			];

			networkIdentifiersAndExpectedChainIds.map(({ networkIdentifier, expectedChainId }) => {
				// Act:
				const result = networkIdentifierToChainId(networkIdentifier);

				// Assert:
				expect(result).toBe(expectedChainId);
			});
		});

		it('throws for unsupported network identifier', () => {
			expect(() => networkIdentifierToChainId('custom')).toThrow('Unsupported network identifier');
			expect(() => networkIdentifierToChainId('devnet')).toThrow('Unsupported network identifier');
		});
	});

	describe('chainIdToNetworkIdentifier', () => {
		it('returns the network identifier from a given chain ID', () => {
			// Arrange:
			const chainIdsAndExpectedIdentifiers = [
				{ chainId: 1, expectedIdentifier: 'mainnet' },
				{ chainId: 3151908, expectedIdentifier: 'testnet' },
				{ chainId: 11155111, expectedIdentifier: 'sepolia' }
			];

			chainIdsAndExpectedIdentifiers.map(({ chainId, expectedIdentifier }) => {
				// Act:
				const result = chainIdToNetworkIdentifier(chainId);

				// Assert:
				expect(result).toBe(expectedIdentifier);
			});
		});

		it('throws for unsupported chain ID', () => {
			expect(() => chainIdToNetworkIdentifier(0)).toThrow('Unsupported chain ID');
			expect(() => chainIdToNetworkIdentifier(999)).toThrow('Unsupported chain ID');
		});
	});

	describe('createWebSocketUrl', () => {
		it('creates a WebSocket URL from a given node URL', () => {
			// Arrange:
			const wsPort = 8546;
			const nodeUrlsAndExpectedWsUrls = [
				{
					nodeUrl: 'http://node.url.com:8545',
					expectedWsUrl: 'ws://node.url.com:8546'
				},
				{
					nodeUrl: 'http://node.url.com:8546',
					expectedWsUrl: 'ws://node.url.com:8546'
				},
				{
					nodeUrl: 'https://node.url.com:8545',
					expectedWsUrl: 'wss://node.url.com:8546'
				},
				{
					nodeUrl: 'https://node.url.com:8546',
					expectedWsUrl: 'wss://node.url.com:8546'
				},
				{
					nodeUrl: 'http://node.url.com',
					expectedWsUrl: 'ws://node.url.com:8546'
				},
				{
					nodeUrl: 'https://node.url.com',
					expectedWsUrl: 'wss://node.url.com:8546'
				},
				{
					nodeUrl: 'http://node.url.com:80',
					expectedWsUrl: 'ws://node.url.com:8546'
				},
				{
					nodeUrl: 'https://httphttps:443',
					expectedWsUrl: 'wss://httphttps:8546'
				}
			];

			nodeUrlsAndExpectedWsUrls.forEach(({ nodeUrl, expectedWsUrl }) => {
				// Act:
				const result = createWebSocketUrl(nodeUrl, wsPort);

				// Assert:
				expect(result).toBe(expectedWsUrl);
			});
		});
	});
});

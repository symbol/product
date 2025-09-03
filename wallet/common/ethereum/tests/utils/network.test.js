import { chainIdToNetworkIdentifier, networkIdentifierToChainId } from '../../src/utils';


describe('utils/network', () => {
	describe('networkIdentifierToChainId', () => {
		it('returns the chain ID from a given network identifier', () => {
			// Arrange:
			const networkIdentifiersAndExpectedChainIds = [
				{ networkIdentifier: 'mainnet', expectedChainId: 1 },
				{ networkIdentifier: 'erigon_local', expectedChainId: 3151908 },
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
				{ chainId: 3151908, expectedIdentifier: 'erigon_local' },
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
});

		
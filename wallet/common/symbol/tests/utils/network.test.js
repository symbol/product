import { networkIdentifierToNetworkType, networkTypeToIdentifier } from '../../src/utils';


describe('utils/network', () => {
	describe('networkTypeToIdentifier', () => {
		it('returns the network identifier from a given network type', () => {
			// Arrange:
			const networkTypesAndExpectedIdentifiers = [
				{ networkType: 104, expectedIdentifier: 'mainnet' },
				{ networkType: 152, expectedIdentifier: 'testnet' }
			];

			networkTypesAndExpectedIdentifiers.map(({ networkType, expectedIdentifier }) => {
				// Act:
				const result = networkTypeToIdentifier(networkType);

				// Assert:
				expect(result).toBe(expectedIdentifier);
			});
		});

		it('throws for unsupported network type', () => {
			expect(() => networkTypeToIdentifier(0)).toThrow('Unsupported network type');
			expect(() => networkTypeToIdentifier(999)).toThrow('Unsupported network type');
		});
	});

	describe('networkIdentifierToNetworkType', () => {
		it('returns the network type from a given network identifier', () => {
			// Arrange:
			const networkIdentifiersAndExpectedTypes = [
				{ networkIdentifier: 'mainnet', expectedType: 104 },
				{ networkIdentifier: 'testnet', expectedType: 152 }
			];

			networkIdentifiersAndExpectedTypes.map(({ networkIdentifier, expectedType }) => {
				// Act:
				const result = networkIdentifierToNetworkType(networkIdentifier);

				// Assert:
				expect(result).toBe(expectedType);
			});
		});

		it('throws for unsupported network identifier', () => {
			expect(() => networkIdentifierToNetworkType('custom')).toThrow('Unsupported network identifier');
			expect(() => networkIdentifierToNetworkType('devnet')).toThrow('Unsupported network identifier');
		});
	});
});

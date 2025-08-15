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
	});
});

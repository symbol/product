import symbolClient from '../../src/services/symbolClient.js';
import fetchUtils from '../../src/utils/fetchUtils.js';
import { describe, expect, jest } from '@jest/globals';

describe('symbolClient', () => {
	jest.spyOn(fetchUtils, 'fetchData').mockImplementation();

	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('fetchNetworkCurrencyMosaicId', () => {
		it('can fetch network currency mosaic id successfully', async () => {
			// Arrange:
			const nodeUrl = 'http://localhost:3000';
			const chain = {
				currencyMosaicId: '0x72C0\'212E\'67A0\'8BCE'
			};

			fetchUtils.fetchData.mockResolvedValue({ chain });

			// Act:
			const result = await symbolClient(nodeUrl).fetchNetworkCurrencyMosaicId();

			// Assert:
			expect(result).toBe('72C0212E67A08BCE');
			expect(fetchUtils.fetchData).toHaveBeenCalledWith(`${nodeUrl}/network/properties`);
		});

		it('should throw an error when fetch fails', async () => {
			// Arrange:
			const nodeUrl = 'http://localhost:3000';
			fetchUtils.fetchData.mockRejectedValue(new Error('Failed to fetch'));

			// Assert:
			const errorMessage = 'Failed to fetch network properties info: Failed to fetch';
			await expect(symbolClient(nodeUrl).fetchNetworkCurrencyMosaicId()).rejects.toThrow(errorMessage);
		});
	});
});

import symbolClient from '../../src/services/symbolClient.js';
import fetchUtils from '../../src/utils/fetchUtils.js';
import { describe, expect, jest } from '@jest/globals';

describe('symbolClient', () => {
	jest.spyOn(fetchUtils, 'fetchData').mockImplementation();
	const nodeUrl = 'http://localhost:3000';
	let client;

	beforeEach(() => {
		jest.clearAllMocks();
		client = symbolClient(nodeUrl);
	});

	describe('fetchNetworkCurrencyMosaicId', () => {
		it('can fetch network currency mosaic id successfully', async () => {
			// Arrange:
			const chain = {
				currencyMosaicId: '0x72C0\'212E\'67A0\'8BCE'
			};

			fetchUtils.fetchData.mockResolvedValue({ chain });

			// Act:
			const result = await client.fetchNetworkCurrencyMosaicId();

			// Assert:
			expect(result).toBe('72C0212E67A08BCE');
			expect(fetchUtils.fetchData).toHaveBeenCalledWith(`${nodeUrl}/network/properties`);
		});

		it('should throw an error when fetch fails', async () => {
			// Arrange:
			fetchUtils.fetchData.mockRejectedValue(new Error('Failed to fetch'));

			// Assert:
			const errorMessage = 'Failed to fetch network properties info: Failed to fetch';
			await expect(client.fetchNetworkCurrencyMosaicId()).rejects.toThrow(errorMessage);
		});
	});
});

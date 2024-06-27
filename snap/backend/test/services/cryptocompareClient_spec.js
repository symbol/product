import cryptoCompareClient from '../../src/services/cryptocompareClient.js';
import fetchUtils from '../../src/utils/fetchUtils.js';
import { describe, expect, jest } from '@jest/globals';

jest.spyOn(fetchUtils, 'fetchData').mockImplementation();

describe('cryptocompareClient', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('fetchPrice', () => {
		it('can fetch price successfully', async () => {
			// Arrange:
			const prices = {
				USD: 0.25,
				JPY: 30
			};

			fetchUtils.fetchData.mockResolvedValue(prices);

			// Act:
			const result = await cryptoCompareClient.fetchPrice();

			// Assert:
			expect(result).toStrictEqual({
				usd: prices.USD,
				jpy: prices.JPY

			});
			expect(fetchUtils.fetchData).toHaveBeenCalledWith('https://min-api.cryptocompare.com/data/price?fsym=xym&tsyms=usd,jpy', 'GET');
		});

		it('should throw an error when fetch fails', async () => {
			// Arrange:
			fetchUtils.fetchData.mockRejectedValue(new Error('Failed to fetch'));

			// Assert:
			const errorMessage = 'Failed to fetch price from cryptoCompare service: Failed to fetch';
			await expect(cryptoCompareClient.fetchPrice()).rejects.toThrow(errorMessage);
		});
	});
});

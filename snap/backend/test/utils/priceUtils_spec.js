import cryptoCompareClient from '../../src/services/cryptocompareClient.js';
import stateManager from '../../src/stateManager.js';
import priceUtils from '../../src/utils/priceUtils.js';
import { describe, jest } from '@jest/globals';

jest.spyOn(cryptoCompareClient, 'fetchPrice').mockResolvedValue();
jest.spyOn(stateManager, 'update').mockResolvedValue();

describe('priceUtils', () => {
	describe('getPrice', () => {
		it('should get price successfully', async () => {
			// Arrange:
			const state = {
				currencies: {}
			};

			const prices = {
				USD: 0.25,
				JPY: 30
			};

			cryptoCompareClient.fetchPrice.mockResolvedValue(prices);

			// Act:
			await priceUtils.getPrice({ state });

			// Assert:
			expect(state.currencies).toStrictEqual(prices);
			expect(stateManager.update).toHaveBeenCalledWith(state);
		});
	});

	describe('getCurrencyPrice', () => {
		// Arrange:
		const state = {
			currencies: {
				USD: 0.25,
				JPY: 30
			}
		};

		it('should get currency price successfully', async () => {
			// Arrange:
			const requestParams = {
				currency: 'USD'
			};

			// Act:
			const result = await priceUtils.getCurrencyPrice({ state, requestParams });

			// Assert:
			expect(result).toStrictEqual({
				symbol: requestParams.currency,
				price: state.currencies[requestParams.currency]
			});
		});

		it('should throw an error when currency is not supported', async () => {
			// Arrange:
			const requestParams = {
				currency: 'EUR'
			};

			// Assert:
			await expect(priceUtils.getCurrencyPrice({ state, requestParams })).rejects.toThrow('Currency not supported.');
		});
	});
});

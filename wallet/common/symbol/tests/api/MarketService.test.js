import { MarketService } from '../../src/api/MarketService';
import { runApiTest } from '../test-utils';
import { expect, jest } from '@jest/globals';

describe('MarketService', () => {
	let marketService;
	let mockMakeRequest;
	const baseConfig = {
		marketCurrencies: ['USD', 'EUR', 'JPY', 'GBP', 'KRW', 'CNY', 'UAH'],
		marketDataURL: 'https://market.example.tld/data'
	};

	beforeEach(() => {
		mockMakeRequest = jest.fn();
		marketService = new MarketService({
			config: baseConfig,
			makeRequest: mockMakeRequest
		});
		jest.clearAllMocks();
	});

	describe('fetchPrices', () => {
		it('builds URL from config and returns prices with timestamp', async () => {
			// Arrange:
			const response = {
				USD: 0.031,
				EUR: 0.029,
				JPY: 4.5,
				GBP: 0.025,
				KRW: 41.2,
				CNY: 0.22,
				UAH: 1.2
			};
			const expectedUrl = `${baseConfig.marketDataURL}?fsym=XYM&tsyms=${baseConfig.marketCurrencies.join(',')}`;
			const mockNow = 1_700_000_000_000;
			jest.spyOn(Date, 'now').mockReturnValue(mockNow);

			// Act & Assert via helper
			await runApiTest(
				mockMakeRequest,
				async () => {
					const result = await marketService.fetchPrices();
					expect(result).toEqual({
						...response,
						requestTimestamp: mockNow
					});
				},
				[
					{
						url: expectedUrl,
						options: undefined,
						response
					}
				]
			);
		});

		it('ignores unexpected fields and preserves only known tickers', async () => {
			// Arrange:
			const customConfig = {
				...baseConfig,
				marketCurrencies: ['USD', 'EUR'] // URL uses only these; service still maps fixed ticker set
			};
			marketService = new MarketService({
				config: customConfig,
				makeRequest: mockMakeRequest
			});

			const response = {
				USD: 0.05,
				EXTRA: 999 // should be ignored
			};
			const expectedUrl = `${customConfig.marketDataURL}?fsym=XYM&tsyms=${customConfig.marketCurrencies.join(',')}`;
			const mockNow = 1_800_000_000_000;
			jest.spyOn(Date, 'now').mockReturnValue(mockNow);

			// Act & Assert via helper
			await runApiTest(
				mockMakeRequest,
				async () => {
					const result = await marketService.fetchPrices();

					// Known tickers exist; USD has value, others are undefined when not present in response
					expect(result.USD).toBe(0.05);
					expect(result.EUR).toBeUndefined();
					expect(result.JPY).toBeUndefined();
					expect(result.GBP).toBeUndefined();
					expect(result.KRW).toBeUndefined();
					expect(result.CNY).toBeUndefined();
					expect(result.UAH).toBeUndefined();

					// No unexpected fields
					expect(result.EXTRA).toBeUndefined();

					// Timestamp is provided
					expect(result.requestTimestamp).toBe(mockNow);
				},
				[
					{
						url: expectedUrl,
						options: undefined,
						response
					}
				]
			);
		});
	});
});

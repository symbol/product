import { MarketService } from '../../src/api/MarketService';
import { runApiTest } from '../test-utils';
import { jest } from '@jest/globals';

describe('MarketService', () => {
	let marketService;
	let mockMakeRequest;
	const baseConfig = {
		marketCurrencies: ['USD', 'EUR', 'JPY', 'GBP', 'KRW', 'CNY', 'UAH'],
		marketDataURL: 'https://market.example.tld/data'
	};
	const mockNow = 1_700_000_000_000;

	beforeEach(() => {
		mockMakeRequest = jest.fn();
		jest.clearAllMocks();
		jest.spyOn(Date, 'now').mockReturnValue(mockNow);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	describe('fetchPrices', () => {
		const runFetchPricesTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				const marketCurrencies = config.marketCurrencies || baseConfig.marketCurrencies;
				marketService = new MarketService({
					config: { ...baseConfig, marketCurrencies },
					makeRequest: mockMakeRequest
				});
				const requestCurrencies = marketCurrencies.map(currency => currency.toLowerCase()).join(',');
				const expectedUrl = `${baseConfig.marketDataURL}?ids=symbol&vs_currencies=${requestCurrencies}`;

				// Act & Assert:
				await runApiTest(
					mockMakeRequest,
					() => marketService.fetchPrices(),
					[
						{
							url: expectedUrl,
							options: undefined,
							response: config.response
						}
					],
					expected.result
				);
			});
		};

		const tests = [
			{
				description: 'builds URL from config and returns prices with timestamp',
				config: {
					response: {
						symbol: {
							usd: 0.031,
							eur: 0.029,
							jpy: 4.5,
							gbp: 0.025,
							krw: 41.2,
							cny: 0.22,
							uah: 1.2
						}
					}
				},
				expected: {
					result: {
						USD: 0.031,
						EUR: 0.029,
						JPY: 4.5,
						GBP: 0.025,
						KRW: 41.2,
						CNY: 0.22,
						UAH: 1.2,
						requestTimestamp: mockNow
					}
				}
			},
			{
				description: 'maps only known tickers and ignores unexpected fields',
				config: {
					marketCurrencies: ['USD', 'EUR'],
					response: {
						symbol: {
							usd: 0.05,
							extra: 999
						}
					}
				},
				expected: {
					result: {
						USD: 0.05,
						EUR: undefined,
						JPY: undefined,
						GBP: undefined,
						KRW: undefined,
						CNY: undefined,
						UAH: undefined,
						requestTimestamp: mockNow
					}
				}
			},
			{
				description: 'returns undefined prices when the coin data is missing from the response',
				config: {
					response: {} // empty payload, e.g. coin not found by the market API
				},
				expected: {
					result: {
						USD: undefined,
						EUR: undefined,
						JPY: undefined,
						GBP: undefined,
						KRW: undefined,
						CNY: undefined,
						UAH: undefined,
						requestTimestamp: mockNow
					}
				}
			}
		];

		tests.forEach(test => runFetchPricesTest(test.description, test.config, test.expected));
	});
});

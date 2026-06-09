import { runApiServiceTest } from '../test-utils';
import { jest } from '@jest/globals';

// Constants

const MARKET_DATA_URL = 'https://market.example/data';
const MARKET_CURRENCIES = ['USD', 'EUR', 'JPY', 'GBP', 'KRW', 'CNY', 'UAH'];
const FIXED_NOW = 1_700_000_000_000;

const apiConfig = { marketCurrencies: MARKET_CURRENCIES, marketDataURL: MARKET_DATA_URL };

// Fixtures

// A CryptoCompare-style XEM ticker response. EXTRA is an unknown field the service must drop.
const marketResponse = { 
	CNY: 0.22, 
	EUR: 0.029, 
	GBP: 0.025, 
	JPY: 4.5, 
	KRW: 41.2, 
	UAH: 1.2, 
	USD: 0.031, 
	EXTRA: 999 
};

describe('api/MarketService', () => {
	afterEach(() => {
		jest.restoreAllMocks();
	});

	describe('fetchPrices', () => {
		const runFetchPricesTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				jest.spyOn(Date, 'now').mockReturnValue(FIXED_NOW);
				const url = `${config.apiConfig.marketDataURL}?fsym=XEM&tsyms=${config.apiConfig.marketCurrencies.join(',')}`;

				// Act & Assert:
				await runApiServiceTest({
					requestMap: { [url]: config.response },
					config: config.apiConfig,
					call: api => api.market.fetchPrices(),
					expected: expected.prices
				});
			});
		};

		const fetchPricesTests = [
			{
				description: 'returns the configured currency prices and ignores unknown response fields',
				config: { apiConfig, response: marketResponse },
				expected: {
					prices: { 
						CNY: 0.22, 
						EUR: 0.029, 
						GBP: 0.025, 
						JPY: 4.5, 
						KRW: 41.2, 
						UAH: 1.2, 
						USD: 0.031, 
						requestTimestamp: FIXED_NOW 
					}
				}
			},
			{
				description: 'leaves currencies missing from the response undefined',
				config: { apiConfig, response: { USD: 0.05 } },
				expected: {
					prices: {
						CNY: undefined,
						EUR: undefined,
						GBP: undefined,
						JPY: undefined,
						KRW: undefined,
						UAH: undefined,
						USD: 0.05,
						requestTimestamp: FIXED_NOW
					}
				}
			}
		];

		fetchPricesTests.forEach(test => runFetchPricesTest(test.description, test.config, test.expected));
	});
});

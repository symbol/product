import { config } from '@/app/config';
import { makeRequest } from '@/app/utils/network';

export class MarketService {
	/**
	 * @typedef {Object} MarketData
	 * @property {number} CNY - Price in Chinese Yuan
	 * @property {number} EUR - Price in Euro
	 * @property {number} GBP - Price in British Pound
	 * @property {number} JPY - Price in Japanese Yen
	 * @property {number} KRW - Price in South Korean Won
	 * @property {number} UAH - Price in Ukrainian Hryvnia
	 * @property {number} USD - Price in US Dollar
	 * @property {number} requestTimestamp - Timestamp of the request
	 */

	/**
	 * Fetches the current XYM price in various fiat currencies.
	 * @returns {Promise<MarketData>} The current XYM price in various currencies
	 */
	static async fetchPrices() {
		const symbols = config.marketCurrencies.join(',');
		const url = `${config.marketDataURL}?fsym=XYM&tsyms=${symbols}`;
		const response = await makeRequest(url);
		const tickers = ['CNY', 'EUR', 'GBP', 'JPY', 'KRW', 'UAH', 'USD'];
		const marketData = tickers.reduce((acc, ticker) => {
			acc[ticker] = response[ticker];
			return acc;
		}, {});

		return {
			...marketData,
			requestTimestamp: Date.now()
		};
	}
}

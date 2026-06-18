const SYMBOL_COIN_ID = 'symbol';

export class MarketService {
	#config;
	#makeRequest;

	constructor(options) {
		this.#config = options.config;
		this.#makeRequest = options.makeRequest;
	}
	
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
	fetchPrices = async () => {
		const currencies = this.#config.marketCurrencies.map(currency => currency.toLowerCase()).join(',');
		const url = `${this.#config.marketDataURL}?ids=${SYMBOL_COIN_ID}&vs_currencies=${currencies}`;
		const response = await this.#makeRequest(url);
		const prices = response[SYMBOL_COIN_ID] || {};
		const tickers = ['CNY', 'EUR', 'GBP', 'JPY', 'KRW', 'UAH', 'USD'];
		const marketData = tickers.reduce((acc, ticker) => {
			acc[ticker] = prices[ticker.toLowerCase()];
			return acc;
		}, {});

		return {
			...marketData,
			requestTimestamp: Date.now()
		};
	};
}

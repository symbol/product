import { config } from '@/app/config';
import { makeRequest } from '@/app/utils/network';

export class MarketService {
    /**
     * Fetches the current XYM price in various fiat currencies.
     * @returns {Promise<{ CNY: number, EUR: number, GBP: number, JPY: number, KRW: number, UAH: number, USD: number, requestTimestamp: number }>} The current XYM price in various currencies
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
            requestTimestamp: Date.now(),
        };
    }
}

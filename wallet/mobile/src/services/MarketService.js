import { config } from '@/config';
import { makeRequest } from '@/utils/network';

export class MarketService {
    static async fetchPrices() {
        const symbols = config.marketCurrencies.join(',');
        const url = `${config.marketDataURL}?fsym=XYM&tsyms=${symbols}`;
        const response = await makeRequest(url);

        return {
            ...response,
            requestTimestamp: Date.now(),
        };
    }
}

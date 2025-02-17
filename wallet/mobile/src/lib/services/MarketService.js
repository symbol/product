import { config } from '@/app/config';
import { makeRequest } from '@/app/utils/network';

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

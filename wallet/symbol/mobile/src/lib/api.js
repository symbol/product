import { Api } from 'wallet-common-symbol';
import { makeRequest } from '@/app/utils';
import { config } from '@/app/config';

export const api = new Api({ 
    makeRequest, 
    config: {
        nodewatchURL: config.chains.symbol.nodewatchURL,
        marketCurrencies: config.marketCurrencies,
        marketDataURL: config.marketDataURL,
    }
});

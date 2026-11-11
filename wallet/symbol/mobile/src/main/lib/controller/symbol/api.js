import { config } from '@/app/config';
import { cachedMakeRequest } from '@/app/lib/cache';
import { Api } from 'wallet-common-symbol';

export const symbolNetworkApi = new Api({
	makeRequest: cachedMakeRequest,
	config: {
		nodewatchURL: config.chains.symbol.nodewatchURL,
		marketCurrencies: config.marketCurrencies,
		marketDataURL: config.marketDataURL
	}
});

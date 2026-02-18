import { config } from '@/app/config';
import { makeRequest } from '@/app/utils';
import { Api } from 'wallet-common-symbol';

export const symbolNetworkApi = new Api({ 
	makeRequest, 
	config: {
		nodewatchURL: config.chains.symbol.nodewatchURL,
		marketCurrencies: config.marketCurrencies,
		marketDataURL: config.marketDataURL
	}
});

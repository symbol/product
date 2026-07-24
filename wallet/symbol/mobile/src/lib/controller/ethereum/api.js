import { config } from '@/app/config';
import { cachedMakeRequest } from '@/app/lib/cache';
import { Api } from 'wallet-common-ethereum';

export const ethereumNetworkApi = new Api({
	makeRequest: cachedMakeRequest,
	config: {
		nodeList: config.chains.ethereum.nodeList,
		erc20TokensAddresses: config.chains.ethereum.erc20TokensAddresses
	}
});

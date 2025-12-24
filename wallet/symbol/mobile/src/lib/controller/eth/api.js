import { Api } from 'wallet-common-ethereum';
import { makeRequest } from '@/app/utils';
import { config } from '@/app/config';

export const ethereumNetworkApi = new Api({
	makeRequest,
	config: {
		nodeList: config.chains.ethereum.nodeList,
		erc20TokensAddresses: config.chains.ethereum.erc20TokensAddresses,
	}
});

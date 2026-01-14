import { config } from '@/app/config';
import { makeRequest } from '@/app/utils';
import { Api } from 'wallet-common-ethereum';

export const ethereumNetworkApi = new Api({
	makeRequest,
	config: {
		nodeList: config.chains.ethereum.nodeList,
		erc20TokensAddresses: config.chains.ethereum.erc20TokensAddresses
	}
});

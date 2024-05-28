import statisticsClient from './services/statisticsClient.js';
import stateManager from './stateManager.js';
import networkUtils from './utils/networkUtils.js';
import { SymbolFacade } from 'symbol-sdk/symbol';

// eslint-disable-next-line import/prefer-default-export
export const onRpcRequest = async ({ request }) => {
	const requestParams = request?.params || {};

	let state = await stateManager.getState();

	if (!state) {
		// initialize state if empty and set default data
		const nodeInfo = await statisticsClient.getNodeInfo('mainnet');

		state = {
			network: {
				...nodeInfo
			}
		};

		await stateManager.update(state);
	}

	const facade = new SymbolFacade(state.network.networkName);

	const apiParams = {
		state,
		requestParams,
		snap,
		facade
	};

	// handle request
	switch (request.method) {
	case 'getNetwork':
		return state.network;
	case 'switchNetwork':
		return networkUtils.switchNetwork(apiParams);
	default:
		throw new Error('Method not found.');
	}
};

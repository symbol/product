import stateManager from './stateManager.js';
import networkUtils from './utils/networkUtils.js';

// eslint-disable-next-line import/prefer-default-export
export const onRpcRequest = async ({ request }) => {
	const requestParams = request?.params || {};

	let state = await stateManager.getState();

	if (!state) {
		state = {
			network: {}
		};
	}

	const apiParams = {
		state,
		requestParams
	};

	// handle request
	switch (request.method) {
	case 'initialSnap':
		await networkUtils.switchNetwork(apiParams);
		return state;
	case 'getNetwork':
		return state.network;
	case 'switchNetwork':
		return networkUtils.switchNetwork(apiParams);
	default:
		throw new Error('Method not found.');
	}
};

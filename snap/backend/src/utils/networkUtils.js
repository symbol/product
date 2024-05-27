import statisticsClient from '../services/statisticsClient.js';
import stateManager from '../stateManager.js';

const networkUtils = {
	async switchNetwork({ state, requestParams }) {
		const { networkName } = requestParams;
		const nodeInfo = await statisticsClient.getNodeInfo(networkName);

		state.network = {
			...nodeInfo
		};

		await stateManager.update(state);

		return state.network;
	}
};

export default networkUtils;

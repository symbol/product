import statisticsClient from '../services/statisticsClient.js';
import symbolClient from '../services/symbolClient.js';
import stateManager from '../stateManager.js';

const networkUtils = {
	async switchNetwork({ state, requestParams }) {
		const { networkName } = requestParams;
		const nodeInfo = await statisticsClient.getNodeInfo(networkName);

		const client = symbolClient.create(nodeInfo.url);
		const currencyMosaicId = await client.fetchNetworkCurrencyMosaicId();

		state.network = {
			...nodeInfo,
			currencyMosaicId
		};

		await stateManager.update(state);

		return state.network;
	}
};

export default networkUtils;

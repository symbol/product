import config from '../config.js';
import fetchUtils from '../utils/fetchUtils.js';

const statisticsClient = {
	/**
     * Get the nodes from the network.
     * @param {'mainnet' | 'testnet'} networkName - The network name identifier.
     * @returns {Promise<NodeInfo>} The node information.
     */
	getNodeInfo: async networkName => {
		if (!networkName)
			throw new Error('Network is required');

		try {
			const queryString = '?filter=suggested&limit=1&ssl=true';
			const nodes = await fetchUtils.fetchData(`${config.statisticsServiceURL[networkName]}/nodes?${queryString}`, 'GET');

			return {
				identifier: nodes[0].networkIdentifier,
				networkName,
				url: nodes[0].apiStatus.restGatewayUrl
			};
		} catch (error) {
			throw new Error(`Failed to fetch nodes from statistics service: ${error.message}`);
		}
	}
};

export default statisticsClient;

// region type declarations

/**
 * Result of a node request.
 * @typedef {object} NodeInfo
 * @property {number} identifier - The network identifier.
 * @property {string} networkName - The network name.
 * @property {string} url - The node URL.
 */

// endregion

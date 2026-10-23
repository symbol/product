import config from '@/app/config';
import { makeRequest } from '@/app/utils/server';

/**
 * Fetches peer and API-only nodes from Nodewatch.
 * @returns {Promise<Array>} node list
 */
export const fetchNodeList = async () => {
	const baseURL = `${config.PUBLIC_NODEWATCH_URL}/api/symbol/nodes`;
	const [peerNodes, apiNodes] = await Promise.all([
		makeRequest(`${baseURL}/peer`),
		makeRequest(`${baseURL}/api`)
	]);

	return [...peerNodes, ...apiNodes].map(nodeInfoFromDTO);
};

/**
 * Maps the node info from the DTO.
 * @param {object} data - raw data from response
 * @returns {object} mapped node info
 */
const nodeInfoFromDTO = data => ({
	endpoint: data.endpoint,
	name: data.name,
	version: data.version,
	height: data.height,
	mainPublicKey: data.mainPublicKey,
	nodePublicKey: data.nodePublicKey,
	balance: data.balance,
	roles: data.roles
});

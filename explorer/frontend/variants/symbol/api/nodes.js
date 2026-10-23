import config from '@/app/config';
import { makeRequest } from '@/app/utils/server';

/**
 * Fetches the node list.
 * @returns {Promise<Array>} node list
 */
export const fetchNodeList = async () => {
	const url = `${config.PUBLIC_NODEWATCH_URL}/api/symbol/nodes/peer`;
	const nodes = await makeRequest(url);

	return nodes.map(nodeInfoFromDTO);
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

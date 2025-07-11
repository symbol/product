import config from '@/config';
import { makeRequest } from '@/utils/server';

/**
 * @typedef Page
 * @property {Array} data - the page data, an array of objects
 * @property {number} pageNumber The page number
 */

/**
 * Fetches the node list.
 * @returns {Promise<Array>} node list
 */
export const fetchNodeList = async () => {
	const url = config.SYMBOL_NODELIST_URL;
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

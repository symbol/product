import { namespaceFromDTO } from '../utils';

/** @typedef {import('../types/Namespace').Namespace} Namespace */
/** @typedef {import('../types/Network').NetworkProperties} NetworkProperties */

export class NamespaceService {
	#makeRequest;

	constructor(options) {
		this.#makeRequest = options.makeRequest;
	}

	/**
	 * Fetches namespaces owned by an account.
	 * @param {NetworkProperties} networkProperties
	 * @param {string} address
	 * @returns {Promise<Namespace[]>}
	 */
	fetchAccountNamespaces = async (networkProperties, address) => {
		const url = `${networkProperties.nodeUrl}/account/namespace/page?address=${address}`;
		const response = await this.#makeRequest(url);
		
		return response.data?.map(namespaceFromDTO) ?? [];
	};

	/**
	 * Fetches a single namespace info by ID.
	 * @param {NetworkProperties} networkProperties
	 * @param {string} namespaceId
	 * @returns {Promise<Namespace>}
	 */
	fetchNamespaceInfo = async (networkProperties, namespaceId) => {
		const url = `${networkProperties.nodeUrl}/namespace?namespace=${namespaceId}`;
		const response = await this.#makeRequest(url);
		
		return namespaceFromDTO(response);
	};

	/**
	 * Fetches namespace infos for a list of IDs.
	 * @param {NetworkProperties} networkProperties
	 * @param {string[]} namespaceIds
	 * @returns {Promise<Record<string, Namespace>>}
	 */
	fetchNamespaceInfos = async (networkProperties, namespaceIds) => {
		const results = {};
		const fetchAll = namespaceIds.map(async id => {
			try {
				results[id] = await this.fetchNamespaceInfo(networkProperties, id);
			} catch {}
		});
		await Promise.all(fetchAll);
		
		return results;
	};

}


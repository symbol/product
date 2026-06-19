import { namespaceFromDTO } from '../utils';
import { NotFoundError } from 'wallet-common-core';

/** @typedef {import('../types/Namespace').Namespace} Namespace */
/** @typedef {import('../types/Network').NetworkProperties} NetworkProperties */

export class NamespaceService {
	#makeRequest;

	constructor(options) {
		this.#makeRequest = options.makeRequest;
	}

	/**
	 * Fetches namespaces owned by an account.
	 * @param {NetworkProperties} networkProperties - Network properties.
	 * @param {string} address - The account address.
	 * @returns {Promise<Namespace[]>} The namespaces owned by the account.
	 */
	fetchAccountNamespaces = async (networkProperties, address) => {
		const url = `${networkProperties.nodeUrl}/account/namespace/page?address=${address}`;
		const response = await this.#makeRequest(url);
		
		return response.data?.map(namespaceFromDTO) ?? [];
	};

	/**
	 * Fetches a single namespace info by ID.
	 * @param {NetworkProperties} networkProperties - Network properties.
	 * @param {string} namespaceId - The fully-qualified namespace id.
	 * @returns {Promise<Namespace>} The namespace info.
	 */
	fetchNamespaceInfo = async (networkProperties, namespaceId) => {
		const url = `${networkProperties.nodeUrl}/namespace?namespace=${namespaceId}`;
		const response = await this.#makeRequest(url);
		
		return namespaceFromDTO(response);
	};

	/**
	 * Fetches namespace infos for a list of IDs.
	 * @param {NetworkProperties} networkProperties - Network properties.
	 * @param {string[]} namespaceIds - The namespace ids to resolve.
	 * @returns {Promise<Record<string, Namespace>>} The namespace infos keyed by id (not-found ids are omitted; other failures propagate).
	 */
	fetchNamespaceInfos = async (networkProperties, namespaceIds) => {
		const results = {};
		const fetchAll = namespaceIds.map(async id => {
			try {
				results[id] = await this.fetchNamespaceInfo(networkProperties, id);
			} catch (error) {
				if (error instanceof NotFoundError || error.statusCode === 404)
					return;

				throw error;
			}
		});
		await Promise.all(fetchAll);
		
		return results;
	};

}


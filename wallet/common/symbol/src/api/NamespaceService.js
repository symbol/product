import { addressFromRaw, createSearchUrl, namespaceFromDTO, namespaceIdFromRaw } from '../utils';
import _ from 'lodash';
import { ApiError } from 'wallet-common-core';

/** @typedef {import('../types/Namespace').Namespace} Namespace */
/** @typedef {import('../types/Network').NetworkProperties} NetworkProperties */
/** @typedef {import('../types/SearchCriteria').SearchCriteria} SearchCriteria */

export class NamespaceService {
	#makeRequest;

	constructor(options) {
		this.#makeRequest = options.makeRequest;
	}

	/**
	 * Fetches namespace list that is registered by a given account from the node.
	 * @param {NetworkProperties} networkProperties - Network properties.
	 * @param {string} address - Requested account address.
	 * @param {SearchCriteria} [searchCriteria] - Search criteria.
	 * @returns {Promise<Namespace[]>} - The account namespaces.
	 */
	fetchAccountNamespaces = async (networkProperties, address, searchCriteria) => {
		const endpoint = createSearchUrl(networkProperties.nodeUrl, '/namespaces', searchCriteria, {
			ownerAddress: address
		});
		const { data } = await this.#makeRequest(endpoint);
		const namespaces = data.map(el => el.namespace);
		const namespaceIds = namespaces
			.map(namespace => [namespace.level0, namespace.level1, namespace.level2])
			.flat()
			.filter(namespaceId => !!namespaceId);
		const namespaceNames = await this.fetchNamespaceNames(networkProperties, namespaceIds);

		return data.map(namespaceDTO => namespaceFromDTO(namespaceDTO, namespaceNames));
	};

	/**
	 * Fetches mosaic names for a given list of mosaic ids from the node.
	 * @param {NetworkProperties} networkProperties - Network properties.
	 * @param {string[]} mosaicIds - Requested mosaic ids.
	 * @returns {Promise<Record<string, string>>} - The mosaic names map.
	 */
	fetchMosaicNames = async (networkProperties, mosaicIds) => {
		const endpoint = `${networkProperties.nodeUrl}/namespaces/mosaic/names`;
		const payload = {
			mosaicIds
		};
		const { mosaicNames } = await this.#makeRequest(endpoint, {
			method: 'POST',
			body: JSON.stringify(payload),
			headers: {
				'Content-Type': 'application/json'
			}
		});

		return _.chain(mosaicNames).keyBy('mosaicId').mapValues('names').value();
	};

	/**
	 * Fetches namespace names for a given list of namespace ids from the node.
	 * @param {NetworkProperties} networkProperties - Network properties.
	 * @param {string[]} namespaceIds - Requested namespace ids.
	 * @returns {Promise<Record<string, string>>} - The namespace names map.
	 */
	fetchNamespaceNames = async (networkProperties, namespaceIds) => {
		const endpoint = `${networkProperties.nodeUrl}/namespaces/names`;
		const payload = {
			namespaceIds
		};
		const namespaceNames = await this.#makeRequest(endpoint, {
			method: 'POST',
			body: JSON.stringify(payload),
			headers: {
				'Content-Type': 'application/json'
			}
		});

		return _.chain(namespaceNames).keyBy('id').mapValues('name').value();
	};

	/**
	 * Fetches the namespaces by list of ids.
	 * @param {NetworkProperties} networkProperties - Network properties.
	 * @param {string[]} namespaceIds - Requested namespace ids.
	 * @returns {Promise<Record<string, Namespace>>} - The namespaces map.
	 */
	fetchNamespaceInfos = async (networkProperties, namespaceIds) => {
		const namespaceNames = await this.fetchNamespaceNames(networkProperties, namespaceIds);

		const namespaces = await Promise.all(namespaceIds.map(async namespaceId => {
			try {
				const endpoint = `${networkProperties.nodeUrl}/namespaces/${namespaceId}`;
				const namespaceDTO = await this.#makeRequest(endpoint);

				return {
					namespaceId,
					value: namespaceFromDTO(namespaceDTO, namespaceNames)
				};
			} catch {
				return;
			}
		}));

		return _.chain(_.compact(namespaces)).keyBy('namespaceId').mapValues('value').value();
	};

	/**
	 * Fetches the namespace by id.
	 * @param {NetworkProperties} networkProperties - Network properties.
	 * @param {string} namespaceId - Requested namespace id.
	 * @returns {Promise<Namespace>} - The namespace object.
	 */
	fetchNamespaceInfo = async (networkProperties, namespaceId) => {
		const endpoint = `${networkProperties.nodeUrl}/namespaces/${namespaceId}`;
		const namespaceDTO = await this.#makeRequest(endpoint);
		const namespaceNames = await this.fetchNamespaceNames(networkProperties, [namespaceId]);

		return namespaceFromDTO(namespaceDTO, namespaceNames);
	};

	/**
	 * Fetches the address linked to a namespace id at a given height for a given list.
	 * @param {NetworkProperties} networkProperties - Network properties.
	 * @param {{ namespaceId: string, height: number }[]} namespaceIdsWithHeight - Requested namespace ids with height.
	 * @returns {Promise<Record<string, string>>} - The resolved addresses map.
	 */
	resolveAddressesAtHeight = async (networkProperties, namespaceIdsWithHeight) => {
		const namespaceInfos = await Promise.all(namespaceIdsWithHeight.map(async namespaceIdWithHeight => {
			try {
				return {
					namespaceId: namespaceIdWithHeight.namespaceId,
					value: await this.resolveAddressAtHeight(networkProperties, namespaceIdWithHeight)
				};
			} catch (error) {
				return;
			}
		}));

		return _.chain(_.compact(namespaceInfos)).keyBy('namespaceId').mapValues('value').value();
	};

	/**
	 * Fetches the address linked to a namespace id at a given height.
	 * @param {NetworkProperties} networkProperties - Network properties.
	 * @param {string} namespaceId - Requested namespace id.
	 * @param {number} height - Requested height
	 * @returns {Promise<string>} - The resolved address.
	 */
	resolveAddressAtHeight = async (networkProperties, namespaceId, height) => {
		const endpoint = `${networkProperties.nodeUrl}/statements/resolutions/address?height=${height}&pageSize=100`;
		const { data } = await this.#makeRequest(endpoint);
		const statement = data.find(statement => namespaceIdFromRaw(statement.statement.unresolved) === namespaceId);

		if (!statement) 
			throw new ApiError(`Failed to resolve address. Statement for ${namespaceId} not found at height ${height}`);
		
		const { resolved } = statement.statement.resolutionEntries[0];

		return addressFromRaw(resolved);
	};

	/**
	 * Fetches the address currently linked to a namespace id.
	 * @param {NetworkProperties} networkProperties - Network properties.
	 * @param {string} namespaceId - Requested namespace id.
	 * @returns {Promise<string>} - The resolved address.
	 */
	resolveAddress = async (networkProperties, namespaceId) => {
		let namespace;

		try {
			namespace = await this.fetchNamespaceInfo(networkProperties, namespaceId);
		} catch (error) {
			if (error.code === 'error_fetch_not_found') {
				throw new ApiError(
					`Linked address for namespace ${namespaceId} not found. Namespace does not exist.`,
					'error_unknown_account_name'
				);
			} else {
				throw error;
			}
		}

		if (!namespace.alias.address) {
			throw new ApiError(
				`Linked address for namespace ${namespaceId} not found. No address alias found.`,
				'error_unknown_account_name'
			);
		}

		return addressFromRaw(namespace.alias.address);
	};
}

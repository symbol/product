import { addressFromRaw, createSearchUrl, namespaceFromDTO, namespaceIdFromRaw } from '../utils';
import _ from 'lodash';
import { ApiError } from 'wallet-common-core';

/** @typedef {import('../types/Account').UnresolvedAddressWithLocation} UnresolvedAddressWithLocation */
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
	 * Fetches the address linked to a namespace id. If the unresolved address object contains transaction location where it was found,
	 * the resolution is done at that height and transaction index. Otherwise, the current linked address is fetched.
	 * @param {NetworkProperties} networkProperties - Network properties.
	 * @param {UnresolvedAddressWithLocation[]} unresolvedAddressWithLocation - The list of unresolved addresses with transaction location.
	 * @returns {Promise<Record<string, string>>} - The resolved addresses map.
	 */
	resolveAddresses = async (networkProperties, unresolvedAddressWithLocation) => {
		const namespaceInfos = await Promise.all(unresolvedAddressWithLocation.map(async unresolvedAddress => {
			try {
				const resolvedAddress = unresolvedAddress.location
					? await this.resolveAddressAtHeight(networkProperties, unresolvedAddress)
					: await this.resolveAddress(networkProperties, unresolvedAddress.namespaceId);

				return {
					namespaceId: unresolvedAddress.namespaceId,
					value: resolvedAddress
				};
			} catch (error) {
				if (error.code === 'error_unknown_account_name') 
					return;
				else
					throw error;
			}
		}));

		return _.chain(_.compact(namespaceInfos)).keyBy('namespaceId').mapValues('value').value();
	};

	/**
	 * Fetches the address linked to a namespace id at a given height.
	 * @param {NetworkProperties} networkProperties - Network properties.
	 * @param {UnresolvedAddressWithLocation} unresolvedAddressWithLocation - The unresolved address with transaction location.
	 * @returns {Promise<string>} - The resolved address.
	 */
	resolveAddressAtHeight = async (networkProperties, unresolvedAddressWithLocation) => {
		const { namespaceId, location: transactionLocation } = unresolvedAddressWithLocation;
		const { height } = transactionLocation;
		const endpoint = `${networkProperties.nodeUrl}/statements/resolutions/address?height=${height}&pageSize=100`;
		const { data } = await this.#makeRequest(endpoint);
		const resolutionStatement = data.find(statement => namespaceIdFromRaw(statement.statement.unresolved) === namespaceId);

		if (!resolutionStatement) {
			throw new ApiError(
				`Failed to resolve address. Statement for ${namespaceId} not found at height ${height}`,
				'error_unknown_account_name'
			);
		}

		const isReceiptSourceLessThanEqual = (lhs, rhs) =>
			lhs.primaryId < rhs.primaryId || (lhs.primaryId === rhs.primaryId && lhs.secondaryId <= rhs.secondaryId);

		for (let i = resolutionStatement.statement.resolutionEntries.length - 1; 0 <= i; --i) {
			const resolutionEntry = resolutionStatement.statement.resolutionEntries[i];
			const { source } = resolutionEntry;

			if (isReceiptSourceLessThanEqual(source, transactionLocation))
				return addressFromRaw(resolutionEntry.resolved);
		}

		if (!resolutionStatement) {
			throw new ApiError(
				`Failed to resolve address. Statement for ${namespaceId} not found at height ${height}`,
				'error_unknown_account_name'
			);
		}
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

		if (!namespace.linkedAddress) {
			throw new ApiError(
				`Linked address for namespace ${namespaceId} not found. No address alias found.`,
				'error_unknown_account_name'
			);
		}

		return namespace.linkedAddress;
	};
}

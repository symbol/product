import { addressFromRaw, createSearchUrl, getMosaicAmount, mosaicInfoFromDTO } from '../utils';
import _ from 'lodash';
import { NotFoundError, absoluteToRelativeAmount } from 'wallet-common-core';

/** @typedef {import('../types/Mosaic').Mosaic} Mosaic */
/** @typedef {import('../types/Mosaic').MosaicInfo} MosaicInfo */
/** @typedef {import('../types/Mosaic').MosaicOwner} MosaicOwner */
/** @typedef {import('../types/Network').NetworkProperties} NetworkProperties */
/** @typedef {import('../types/SearchCriteria').SearchCriteria} SearchCriteria */

export class MosaicService {
	#api;
	#makeRequest;

	constructor(options) {
		this.#api = options.api;
		this.#makeRequest = options.makeRequest;
	}

	/**
	 * Fetches mosaic info from the node.
	 * @param {NetworkProperties} networkProperties - Network properties.
	 * @param {string} mosaicId - Requested mosaic id.
	 * @returns {Promise<Mosaic>} - The mosaic info.
	 */
	fetchMosaicInfo = async (networkProperties, mosaicId) => {
		const mosaicInfos = await this.fetchMosaicInfos(networkProperties, [mosaicId]);

		return mosaicInfos[mosaicId];
	};

	/**
	 * Fetches mosaic infos for the list of ids from the node.
	 * @param {NetworkProperties} networkProperties - Network properties.
	 * @param {string[]} mosaicIds - Requested mosaic ids.
	 * @returns {Promise<Record<string, Mosaic>>} - The mosaic infos map.
	 */
	fetchMosaicInfos = async (networkProperties, mosaicIds) => {
		// Fetch mosaic infos from API
		const endpoint = `${networkProperties.nodeUrl}/mosaics`;
		const payload = {
			mosaicIds
		};
		const data = await this.#makeRequest(endpoint, {
			method: 'POST',
			body: JSON.stringify(payload),
			headers: {
				'Content-Type': 'application/json'
			}
		});

		// Create map <id, info> from response
		const mosaicInfosEntires = data.map(mosaicInfos => [
			mosaicInfos.mosaic.id,
			mosaicInfoFromDTO(mosaicInfos.mosaic)
		]);
		const mosaicInfos = Object.fromEntries(mosaicInfosEntires);

		// Find namespace ids if there are some in the mosaic list. Mosaic infos are not available for namespace ids
		const fetchedMosaicIds = Object.keys(mosaicInfos);
		const namespaceIds = _.difference(mosaicIds, fetchedMosaicIds);

		// Fetch namespace infos to extract mosaic ids from there
		const namespaceInfos = await this.#api.namespace.fetchNamespaceInfos(networkProperties, namespaceIds);
		const remainedMosaicIds = Object.values(namespaceInfos).map(namespaceInfo => namespaceInfo.linkedMosaicId);
		const shouldFetchRemainedMosaicInfos = remainedMosaicIds.length > 0;

		// Fetch remained mosaic infos for extracted mosaics from namespace infos
		const remainedMosaicInfos = shouldFetchRemainedMosaicInfos
			? await this.fetchMosaicInfos(networkProperties, remainedMosaicIds)
			: {};

		// Fetch mosaic names
		const mosaicIdsToFetchNames = _.difference(mosaicIds, namespaceIds);
		const mosaicNames = await this.#api.namespace.fetchMosaicNames(networkProperties, mosaicIdsToFetchNames);

		for (const mosaicId in mosaicNames) 
			mosaicInfos[mosaicId].names = mosaicNames[mosaicId];


		for (const namespaceId of namespaceIds) {
			if (namespaceInfos[namespaceId]) {
				const mosaicId = namespaceInfos[namespaceId].linkedMosaicId;
				mosaicInfos[namespaceId] = remainedMosaicInfos[mosaicId];
			}
		}

		return { ...mosaicInfos, ...remainedMosaicInfos };
	};

	/**
	 * Fetches the list of mosaics created by a given account from the node.
	 * @param {NetworkProperties} networkProperties - Network properties.
	 * @param {string} address - The mosaic creator address.
	 * @param {SearchCriteria} [searchCriteria] - Search criteria.
	 * @returns {Promise<MosaicInfo[]>} - The created mosaics.
	 */
	fetchAccountMosaics = async (networkProperties, address, searchCriteria) => {
		const endpoint = createSearchUrl(networkProperties.nodeUrl, '/mosaics', searchCriteria, {
			ownerAddress: address
		});
		const { data } = await this.#makeRequest(endpoint);
		const mosaicInfos = data.map(mosaicDTO => mosaicInfoFromDTO(mosaicDTO.mosaic));
		const mosaicIds = mosaicInfos.map(mosaicInfo => mosaicInfo.id);
		const mosaicNames = await this.#api.namespace.fetchMosaicNames(networkProperties, mosaicIds);

		return mosaicInfos.map(mosaicInfo => ({
			...mosaicInfo,
			names: mosaicNames[mosaicInfo.id] || []
		}));
	};

	/**
	 * Fetches the list of accounts holding a given mosaic from the node.
	 * @param {NetworkProperties} networkProperties - Network properties.
	 * @param {string} mosaicId - The mosaic id to search holders for.
	 * @param {SearchCriteria} [searchCriteria] - Search criteria.
	 * @returns {Promise<MosaicOwner[]>} - The mosaic owners with their held amounts in relative units.
	 */
	fetchMosaicOwners = async (networkProperties, mosaicId, searchCriteria) => {
		const endpoint = createSearchUrl(networkProperties.nodeUrl, '/accounts', searchCriteria, {
			mosaicId
		});
		const { data } = await this.#makeRequest(endpoint);

		if (!data.length)
			return [];

		const divisibility = await this.#fetchMosaicDivisibility(networkProperties, mosaicId);

		return data.map(accountDTO => ({
			address: addressFromRaw(accountDTO.account.address),
			amount: absoluteToRelativeAmount(getMosaicAmount(accountDTO.account.mosaics, mosaicId), divisibility)
		}));
	};

	/**
	 * Fetches the balance of a given mosaic held by an account from the node. An account unknown
	 * to the network holds nothing, so a zero balance is returned instead of failing.
	 * @param {NetworkProperties} networkProperties - Network properties.
	 * @param {string} mosaicId - The mosaic id.
	 * @param {string} address - The account address.
	 * @returns {Promise<string>} - The held amount in relative units.
	 */
	fetchMosaicBalance = async (networkProperties, mosaicId, address) => {
		const mosaics = await this.#fetchAccountMosaics(networkProperties, address);
		const absoluteAmount = getMosaicAmount(mosaics, mosaicId);

		if (absoluteAmount === '0')
			return '0';

		const divisibility = await this.#fetchMosaicDivisibility(networkProperties, mosaicId);

		return absoluteToRelativeAmount(absoluteAmount, divisibility);
	};

	/**
	 * Fetches the mosaics held by an account from the node, treating an account unknown to the network as holding none.
	 * @param {NetworkProperties} networkProperties - Network properties.
	 * @param {string} address - The account address.
	 * @returns {Promise<Array<{id: string, amount: string}>>} - The held mosaics in absolute units.
	 */
	#fetchAccountMosaics = async (networkProperties, address) => {
		const endpoint = `${networkProperties.nodeUrl}/accounts/${address}`;

		try {
			const { account } = await this.#makeRequest(endpoint);

			return account.mosaics;
		} catch (error) {
			if (error instanceof NotFoundError || error.statusCode === 404)
				return [];

			throw error;
		}
	};

	/**
	 * Fetches the divisibility of a single mosaic directly from the node, skipping name and namespace resolution.
	 * @param {NetworkProperties} networkProperties - Network properties.
	 * @param {string} mosaicId - The mosaic id.
	 * @returns {Promise<number>} - The mosaic divisibility.
	 */
	#fetchMosaicDivisibility = async (networkProperties, mosaicId) => {
		const endpoint = `${networkProperties.nodeUrl}/mosaics`;
		const [mosaicInfoDTO] = await this.#makeRequest(endpoint, {
			method: 'POST',
			body: JSON.stringify({ mosaicIds: [mosaicId] }),
			headers: {
				'Content-Type': 'application/json'
			}
		});

		return mosaicInfoDTO.mosaic.divisibility;
	};
}

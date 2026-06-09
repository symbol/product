import {
	mosaicIdFromRaw,
	mosaicIdToRaw,
	mosaicInfoFromDTO,
	mosaicListFromDTO
} from '../utils';

/** @typedef {import('../types/Mosaic').Mosaic} Mosaic */
/** @typedef {import('../types/Mosaic').MosaicInfo} MosaicInfo */
/** @typedef {import('../types/Network').NetworkProperties} NetworkProperties */

export class MosaicService {
	#makeRequest;

	constructor(options) {
		this.#makeRequest = options.makeRequest;
	}

	/**
	 * Fetches mosaic info for a single mosaic ID.
	 * @param {NetworkProperties} networkProperties - Network properties.
	 * @param {string} mosaicId - The mosaic id ('namespace.name').
	 * @returns {Promise<MosaicInfo>} The mosaic info, or undefined when the mosaic is unknown.
	 */
	fetchMosaicInfo = async (networkProperties, mosaicId) => {
		const mosaicInfos = await this.fetchMosaicInfos(networkProperties, [mosaicId]);
		
		return mosaicInfos[mosaicId];
	};

	/**
	 * Fetches mosaic infos for a list of mosaic IDs.
	 * Groups IDs by namespace and queries /mosaic/definition/page per namespace.
	 * @param {NetworkProperties} networkProperties - Network properties.
	 * @param {string[]} mosaicIds - The mosaic ids to resolve.
	 * @returns {Promise<Record<string, MosaicInfo>>} The mosaic infos keyed by mosaic id (unknown ids are omitted).
	 */
	fetchMosaicInfos = async (networkProperties, mosaicIds) => {
		if (!mosaicIds.length)
			return {};

		const namespaceGroups = mosaicIds.reduce((groups, id) => {
			const { namespaceId } = mosaicIdToRaw(id);
			(groups[namespaceId] ??= []).push(id);
			
			return groups;
		}, {});

		const mosaicInfos = {};

		const fetchNamespaceDefinitions = Object.entries(namespaceGroups).map(async ([namespaceId, ids]) => {
			try {
				const endpoint = `${networkProperties.nodeUrl}/namespace/mosaic/definition/page?namespace=${namespaceId}&pageSize=100`;
				const response = await this.#makeRequest(endpoint);

				for (const wrapper of (response.data || [])) {
					const definition = wrapper.mosaic || wrapper;
					const id = mosaicIdFromRaw(definition.id);
					
					if (!ids.includes(id))
						continue;

					mosaicInfos[id] = mosaicInfoFromDTO(definition);
				}
			} catch {}
		});
		await Promise.all(fetchNamespaceDefinitions);

		return mosaicInfos;
	};

	/**
	 * Fetches owned mosaics for an account.
	 * @param {NetworkProperties} networkProperties - Network properties.
	 * @param {string} address - The account address.
	 * @returns {Promise<Mosaic[]>} The account's mosaics with resolved amounts and metadata.
	 */
	fetchAccountMosaics = async (networkProperties, address) => {
		const mosaicsDTO = await this.#makeRequest(`${networkProperties.nodeUrl}/account/mosaic/owned?address=${address}`);
		const ownedMosaics = mosaicsDTO.data || [];

		// Resolve definitions for the owned mosaic ids by their namespace. The native currency (nem.xem) has
		// no on-chain mosaic definition, so seed its info from networkProperties.networkCurrency.
		const mosaicIds = ownedMosaics.map(mosaic => mosaicIdFromRaw(mosaic.mosaicId));
		const mosaicInfos = await this.fetchMosaicInfos(networkProperties, mosaicIds);

		const { mosaicId: nativeId, name: nativeName, divisibility: nativeDivisibility } = networkProperties.networkCurrency;
		if (mosaicIds.includes(nativeId) && !mosaicInfos[nativeId])
			mosaicInfos[nativeId] = { id: nativeId, name: nativeName, divisibility: nativeDivisibility };

		return mosaicListFromDTO(ownedMosaics, mosaicInfos);
	};
}


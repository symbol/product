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
	 * @param {NetworkProperties} networkProperties
	 * @param {string} mosaicId
	 * @returns {Promise<MosaicInfo>}
	 */
	fetchMosaicInfo = async (networkProperties, mosaicId) => {
		const mosaicInfos = await this.fetchMosaicInfos(networkProperties, [mosaicId]);
		
		return mosaicInfos[mosaicId];
	};

	/**
	 * Fetches mosaic infos for a list of mosaic IDs.
	 * Groups IDs by namespace and queries /mosaic/definition/page per namespace.
	 * @param {NetworkProperties} networkProperties
	 * @param {string[]} mosaicIds
	 * @returns {Promise<Record<string, MosaicInfo>>}
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
				const endpoint = `${networkProperties.nodeUrl}/mosaic/definition/page?namespace=${namespaceId}&pageSize=100`;
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
	 * @param {NetworkProperties} networkProperties
	 * @param {string} address
	 * @returns {Promise<Mosaic[]>}
	 */
	fetchAccountMosaics = async (networkProperties, address) => {
		const [mosaicsDTO, definitionsDTO] = await Promise.all([
			this.#makeRequest(`${networkProperties.nodeUrl}/account/mosaic/owned?address=${address}`),
			this.#makeRequest(`${networkProperties.nodeUrl}/account/mosaic/owned/definition?address=${address}`)
		]);

		const mosaicInfos = Object.fromEntries(definitionsDTO.data.map(wrapper => {
			const info = mosaicInfoFromDTO(wrapper.mosaic || wrapper);

			return [info.id, info];
		}));

		return mosaicListFromDTO(mosaicsDTO.data, mosaicInfos);
	};
}


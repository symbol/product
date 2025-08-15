import { 
	absoluteToRelativeAmount, 
	addressFromRaw, 
	isRestrictableFlag, 
	isRevokableFlag, 
	isSupplyMutableFlag, 
	isTransferableFlag 
} from '../utils';
import _ from 'lodash';

/** @typedef {import('../types/Mosaic').Mosaic} Mosaic */
/** @typedef {import('../types/Network').NetworkProperties} NetworkProperties */

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
		const mosaicInfosEntires = data.map(mosaicInfos => {
			const duration = parseInt(mosaicInfos.mosaic.duration);
			const startHeight = parseInt(mosaicInfos.mosaic.startHeight);
			const endHeight = startHeight + duration;
			const isUnlimitedDuration = duration === 0;
			const creator = addressFromRaw(mosaicInfos.mosaic.ownerAddress);
			const supply = absoluteToRelativeAmount(parseInt(mosaicInfos.mosaic.supply), mosaicInfos.mosaic.divisibility);
			const { flags } = mosaicInfos.mosaic;

			return [
				mosaicInfos.mosaic.id,
				{
					id: mosaicInfos.mosaic.id,
					divisibility: mosaicInfos.mosaic.divisibility,
					names: [],
					duration,
					startHeight,
					endHeight,
					isUnlimitedDuration,
					creator,
					supply,
					isSupplyMutable: isSupplyMutableFlag(flags),
					isTransferable: isTransferableFlag(flags),
					isRestrictable: isRestrictableFlag(flags),
					isRevokable: isRevokableFlag(flags)
				}
			];
		});
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
}

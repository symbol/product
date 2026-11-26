import { stubMosaics } from './fixtures';
import { stubPage } from './stub';
import { createApiUrl, createTryFetchInfoFunction, makeRequest } from '@/app/utils/server';

export const fetchMosaicPage = stubPage(stubMosaics);

/**
 * Maps a Symbol mosaic REST DTO to the frontend mosaic shape.
 * @param {object} data - raw mosaic response data
 * @returns {object} mapped mosaic info
 */
const mosaicInfoFromDTO = data => {
	const mosaicInfo = {
		id: data.id,
		name: data.id,
		aliasNames: data.aliasNames,
		// Minimal no-information values keep the shared page's .split() safe and route its link to the namespace list.
		namespaceName: '',
		rootNamespaceName: null,
		creator: data.creator,
		supply: data.supply,
		divisibility: data.divisibility,
		registrationHeight: data.registrationHeight,
		expirationHeight: data.expirationHeight,
		value: data.value,
		isUnlimitedDuration: data.isUnlimitedDuration,
		isSupplyMutable: data.isSupplyMutable,
		isTransferable: data.isTransferable,
		isRestrictable: data.isRestrictable,
		isRevokable: data.isRevokable
	};

	if (Object.prototype.hasOwnProperty.call(data, 'registrationTimestamp'))
		mosaicInfo.registrationTimestamp = data.registrationTimestamp;

	return mosaicInfo;
};

/**
 * Fetches Symbol mosaic detail by canonical id or namespace alias.
 * @param {string} id - requested mosaic id or dotted namespace alias
 * @returns {Promise<object|null>} mapped mosaic info, or null for client/not-found errors
 */
export const fetchMosaicInfo = createTryFetchInfoFunction(async id => {
	const mosaic = await makeRequest(createApiUrl(`mosaic/${encodeURIComponent(id)}`));

	return mosaicInfoFromDTO(mosaic);
});

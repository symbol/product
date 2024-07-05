import { createMosaicName, getRootNamespaceName } from '@/utils/common';
import { createAPIURL, createPage, createSearchCriteria, createSearchURL, createTryFetchInfoFunction, makeRequest } from '@/utils/server';

/**
 * @typedef Page
 * @property {Array} data - the page data, an array of objects
 * @property {number} pageNumber The page number
 */

/**
 * Fetches the mosaic page.
 * @param {object} searchParams - search parameters
 * @returns {Promise<Page>} mosaic page
 */
export const fetchMosaicPage = async searchParams => {
	const searchCriteria = createSearchCriteria(searchParams);
	const url = createSearchURL(createAPIURL('mosaics'), searchCriteria);
	const mosaics = await makeRequest(url);

	return createPage(mosaics, searchCriteria.pageNumber, mosaicInfoFromDTO);
};

/**
 * Fetches the mosaic info.
 * @param {String} id - requested mosaic id
 * @returns {Promise<Object>} mosaic info
 */
export const fetchMosaicInfo = createTryFetchInfoFunction(async id => {
	const mosaic = await makeRequest(createAPIURL(`mosaic/${id}`));

	return mosaicInfoFromDTO(mosaic);
});

/**
 * Maps the mosaic info from the DTO.
 * @param {object} data - raw data from response
 * @returns {object} mapped mosaic info
 */
const mosaicInfoFromDTO = data => ({
	id: createMosaicName(data.namespaceName, data.mosaicName),
	name: createMosaicName(data.namespaceName, data.mosaicName),
	namespaceName: data.namespaceName,
	rootNamespaceName: getRootNamespaceName(data.namespaceName),
	creator: data.creator,
	description: data.description,
	divisibility: data.divisibility,
	initialSupply: data.initialSupply,
	supply: data.totalSupply,
	registrationHeight: data.registeredHeight,
	registrationTimestamp: data.registeredTimestamp,
	namespaceRegistrationHeight: data.rootNamespaceRegisteredHeight,
	namespaceExpirationHeight: data.rootNamespaceExpirationHeight,
	namespaceExpirationTimestamp: data.rootNamespaceRegisteredTimestamp,
	isUnlimitedDuration: !data.rootNamespaceExpirationHeight,
	isSupplyMutable: data.supplyMutable,
	isTransferable: data.transferable,
	levy: data.levyFee
		? {
			fee: data.levyFee,
			mosaic: data.levyNamespace,
			recipient: data.levyRecipient,
			type: data.levyType
		  }
		: null
});

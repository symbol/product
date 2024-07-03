import { createMosaicName } from '@/utils/common';
import { createAPIURL, createPage, createSearchCriteria, createSearchURL, createTryFetchInfoFunction, makeRequest } from '@/utils/server';

/**
 * @typedef Page
 * @property {Array} data - the page data, an array of objects
 * @property {number} pageNumber The page number
 */

/**
 * Fetches the namespace page.
 * @param {object} searchParams - search parameters
 * @returns {Promise<Page>} namespace page
 */
export const fetchNamespacePage = async searchParams => {
	const searchCriteria = createSearchCriteria(searchParams);
	const url = createSearchURL(createAPIURL('namespaces'), searchCriteria);
	const namespaces = await makeRequest(url);

	return createPage(namespaces, searchCriteria.pageNumber, namespaceInfoFromDTO);
};

/**
 * Fetches the namespace info.
 * @param {String} id - requested namespace id
 * @returns {Promise<Object>} namespace info
 */
export const fetchNamespaceInfo = createTryFetchInfoFunction(async id => {
	const namespace = await makeRequest(createAPIURL(`namespace/${id}`));

	return namespaceInfoFromDTO(namespace);
});

/**
 * Maps the namespace info from the DTO.
 * @param {object} data - raw data from response
 * @returns {object} mapped namespace info
 */
const namespaceInfoFromDTO = data => {
	const namespaceMosaicsMap = {};
	data.mosaics.forEach(item => {
		if (!namespaceMosaicsMap[item.namespaceName]) 
			namespaceMosaicsMap[item.namespaceName] = [];
		namespaceMosaicsMap[item.namespaceName].push({
			id: createMosaicName(item.namespaceName, item.mosaicName),
			name: createMosaicName(item.namespaceName, item.mosaicName),
			registrationHeight: item.registeredHeight,
			registrationTimestamp: item.registeredTimestamp,
			supply: item.totalSupply
		});
	});

	return {
		name: data.rootNamespace,
		id: data.rootNamespace,
		creator: data.owner,
		subNamespaceCount: data.subNamespaces.length,
		subNamespaces: data.subNamespaces,
		registrationTimestamp: data.registeredTimestamp,
		registrationHeight: data.registeredHeight,
		expirationHeight: data.expirationHeight,
		isUnlimitedDuration: !data.expirationHeight,
		namespaceMosaics: Object.entries(namespaceMosaicsMap).map(([namespaceName, mosaics]) => ({
			namespaceId: namespaceName,
			namespaceName,
			data: mosaics
		}))
	};
};

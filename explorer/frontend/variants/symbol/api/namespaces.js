import { createPage, createSearchCriteria, createTryFetchInfoFunction } from '@/utils/server';

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

	return createPage([], searchCriteria.pageNumber);
};

/**
 * Fetches the namespace info.
 * @param {String} id - requested namespace id
 * @returns {Promise<Object>} namespace info
 */
export const fetchNamespaceInfo = createTryFetchInfoFunction(async id => {
	return null;
});

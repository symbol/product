import { createPage, createSearchCriteria, createTryFetchInfoFunction } from '@/utils/server';

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

	return createPage([], searchCriteria.pageNumber);
};

/**
 * Fetches the mosaic info.
 * @param {String} id - requested mosaic id
 * @returns {Promise<Object>} mosaic info
 */
export const fetchMosaicInfo = createTryFetchInfoFunction(async id => {
	return null;
});

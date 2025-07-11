import { createPage, createSearchCriteria, createTryFetchInfoFunction } from '@/utils/server';

/**
 * @typedef Page
 * @property {Array} data - the page data, an array of objects
 * @property {number} pageNumber The page number
 */

/**
 * Fetches the transaction page.
 * @param {object} searchParams - search parameters
 * @returns {Promise<Page>} transaction page
 */
export const fetchTransactionPage = async searchParams => {
	const searchCriteria = createSearchCriteria(searchParams);
	
	return createPage([], searchCriteria.pageNumber);
};

/**
 * Fetches the transaction info.
 * @param {String} hash - requested transaction hash
 * @returns {Promise<Object>} transaction info
 */
export const fetchTransactionInfo = createTryFetchInfoFunction(async hash => {
	return null;
});

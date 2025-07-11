import config from '@/config';
import { addressFromPublicKey, createAPIURL, createSearchURL, formatTimestamp } from '@/_variants/symbol/utils';
import { createPage, createSearchCriteria, createTryFetchInfoFunction, makeRequest } from '@/utils/server';

/**
 * @typedef Page
 * @property {Array} data - the page data, an array of objects
 * @property {number} pageNumber The page number
 */

/**
 * Fetches the block page.
 * @param {object} searchParams - search parameters
 * @returns {Promise<Page>} block page
 */
export const fetchBlockPage = async searchParams => {
	const searchCriteria = createSearchCriteria(searchParams);
	const baseURL = createAPIURL('blocks');
	const url = createSearchURL(baseURL, searchCriteria, {
		orderBy: 'height',
	});
	const blocks = await makeRequest(url);

	return createPage(blocks.data, searchCriteria.pageNumber, blockInfoFromDTO);
};

/**
 * Fetches the chain height.
 * @returns {Promise<number>} the chain height
 */
export const fetchChainHight = async () => {
	const blockPage = await fetchBlockPage({ pageSize: 1 });

	return blockPage.data[0].height;
};

/**
 * Fetches the block info.
 * @param {number} height - requested block height
 * @returns {Promise<Object>} block info
 */
export const fetchBlockInfo = createTryFetchInfoFunction(async height => {
	const url = createAPIURL(`blocks/${height}`);
	const block = await makeRequest(url);

	return blockInfoFromDTO(block);
});

/**
 * Maps the block info from the DTO.
 * @param {object} data - raw data from response
 * @returns {object} mapped block info
 */
const blockInfoFromDTO = data => ({
	difficulty: ((data.block.difficulty / Math.pow(10, 14)) * 100).toFixed(2),
	hash: data.meta.hash,
	height: data.block.height,
	signature: data.block.signature,
	size: data.block.size,
	timestamp: formatTimestamp(data.block.timestamp),
	harvester: addressFromPublicKey(data.block.signerPublicKey, config.SYMBOL_NETWORK_IDENTIFIER),
	totalFee: data.meta.totalFee,
	transactionCount: data.meta.totalTransactionsCount,
});

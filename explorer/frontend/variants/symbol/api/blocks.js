import { stubBlocks } from './fixtures';
import { stubValue } from './stub';
import config from '@/app/config';
import { createApiUrl, createCursorURL, createSearchCriteria, makeRequest } from '@/app/utils/server';


/**
 * @typedef BlockPageParams
 * @property {number} fromHeight - next page starts from this height.
 */

/**
 * @typedef Page
 * @property {Array<BlockListItem>} data - the page data, an array of block list items.
 * @property {BlockPageParams|null} nextPageParams - the params to request the next page, null when the page is last.
 */

/**
 * Fetches the block page. Cursor - "fromHeight".
 * @param {object} [searchParams] - search parameters.
 * @returns {Promise<Page>} block page.
 */
export const fetchBlockPage = async searchParams => {
	const searchCriteria = createSearchCriteria(searchParams);
	const url = createCursorURL(createApiUrl('blocks'), searchCriteria);
	const blocks = await makeRequest(url);

	return createBlockPage(blocks);
};

/**
 * Fetches the chain height from Nodewatch.
 * @returns {Promise<number>} the chain height.
 */
export const fetchChainHight = async () => {
	const { height } = await fetchChainStatus();

	return height;
};

/**
 * @typedef ChainStatus
 * @property {number} height - the current chain height.
 * @property {number} finalizedHeight - the latest finalized block height.
 */

/**
 * Fetches the chain status from Nodewatch.
 * @returns {Promise<ChainStatus>} the chain status.
 */
export const fetchChainStatus = async () => {
	const { height, finalizedHeight } = await makeRequest(`${config.PUBLIC_NODEWATCH_URL}/api/symbol/height`);

	return { height: Number(height), finalizedHeight: Number(finalizedHeight) };
};

export const fetchBlockInfo = stubValue(stubBlocks[0]);

/**
 * Creates the block page with the params for the next page.
 * @param {Array} blocks - block list DTO from the response.
 * @returns {Page} block page.
 */
const createBlockPage = blocks => {
	const firstBlockHeight = 1;
	const lastBlock = blocks[blocks.length - 1];
	const hasNextPage = !!lastBlock && lastBlock.height > firstBlockHeight;
	const nextPageParams = hasNextPage ? { fromHeight: lastBlock.height - 1 } : null;

	return {
		data: blocks.map(blockListItemFromDTO),
		nextPageParams
	};
};

/**
 * @typedef BlockListItem
 * @property {number} height - the block height.
 * @property {string} timestamp - the block time.
 * @property {string} hash - the block hash.
 * @property {string} harvester - the block harvester address.
 * @property {string} difficulty - the block difficulty in percent.
 * @property {number} totalFee - the block transactions total fee.
 * @property {number} transactionCount - the number of transactions in the block.
 * @property {number} statementCount - the number of statements in the block.
 * @property {number} blockReward - the harvesting reward.
 */

/**
 * Maps the block list item from the DTO.
 * @param {object} data - raw data from response.
 * @returns {BlockListItem} mapped block list item.
 */
const blockListItemFromDTO = data => ({
	height: data.height,
	timestamp: data.timestamp,
	hash: data.hash,
	harvester: data.harvester,
	difficulty: ((data.difficulty / Math.pow(10, 14)) * 100).toFixed(2),
	totalFee: data.totalFee,
	transactionCount: data.transactionCount,
	statementCount: data.statementCount,
	blockReward: data.blockReward ?? 0
});

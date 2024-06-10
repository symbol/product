import config from '@/config';
import { truncateDecimals } from '@/utils/format';
import { createFetchInfoFunction, createSearchURL, createPage, createSearchCriteria, makeRequest } from '@/utils/server';

export const fetchBlockPage = async searchParams => {
	const searchCriteria = createSearchCriteria(searchParams);
	const url = createSearchURL(`${config.API_BASE_URL}/blocks`, searchCriteria);
	const blocks = await makeRequest(url);

	return createPage(blocks, searchCriteria.pageNumber, formatBlock);
};

export const fetchChainHight = async () => {
	const blockPage = await fetchBlockPage({ pageSize: 1 });

	return blockPage.data[0].height;
};

export const fetchBlockInfo = createFetchInfoFunction(async height => {
	const block = await makeRequest(`${config.API_BASE_URL}/block/${height}`);

	return formatBlock(block);
});

const formatBlock = block => ({
	...block,
	harvester: block.signer,
	totalFee: block.totalFees,
	transactionCount: block.totalTransactions,
	difficulty: ((block.difficulty / Math.pow(10, 14)) * 100).toFixed(2),
	averageFee: block.totalTransactions ? truncateDecimals(block.totalFees / block.totalTransactions, config.NATIVE_MOSAIC_DIVISIBILITY) : 0
});
